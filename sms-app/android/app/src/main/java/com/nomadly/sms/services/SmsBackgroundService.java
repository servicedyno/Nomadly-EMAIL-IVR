package com.nomadly.sms.services;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.telephony.SmsManager;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import com.nomadly.sms.MainActivity;
import com.nomadly.sms.R;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Background Service for SMS Sending - Replicates React Native MyTaskService functionality
 * Runs as a Foreground Service to survive app backgrounding and battery optimization
 */
public class SmsBackgroundService extends Service {
    private static final String TAG = "SmsBackgroundService";
    private static final String CHANNEL_ID = "nomadly_sms_channel";
    private static final int NOTIFICATION_ID = 1001;
    
    private Handler handler;
    private boolean isRunning = false;
    private SharedPreferences prefs;
    
    // Campaign state
    private String campaignId;
    private String campaignName;
    private JSONArray contacts;
    private JSONArray content;
    private int gapTimeMs;
    private int currentIndex;
    private int sentCount;
    private int failedCount;
    private int totalContacts;
    // SIM selection: either a single fixed subscriptionId, or a rotation list.
    private int singleSubscriptionId = -1;
    private int[] rotationSubscriptionIds = new int[0];
    
    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "Service created");
        handler = new Handler(Looper.getMainLooper());
        prefs = getSharedPreferences("nomadly_sms_queue", Context.MODE_PRIVATE);
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            Log.w(TAG, "Received null intent, stopping service");
            stopSelf();
            return START_NOT_STICKY;
        }

        String action = intent.getAction();
        Log.d(TAG, "onStartCommand: action=" + action);

        if ("START".equals(action)) {
            loadCampaignData();
            startForeground(NOTIFICATION_ID, buildNotification("Preparing to send SMS..."));
            isRunning = true;
            processSmsQueue();
        } else if ("STOP".equals(action)) {
            Log.d(TAG, "Stop action received");
            isRunning = false;
            saveCampaignProgress();
            stopForeground(true);
            stopSelf();
        } else if ("PAUSE".equals(action)) {
            Log.d(TAG, "Pause action received");
            isRunning = false;
            saveCampaignProgress();
            updateNotification("Paused");
        }

        return START_STICKY;
    }

    private void loadCampaignData() {
        try {
            campaignId = prefs.getString("campaignId", "");
            campaignName = prefs.getString("campaignName", "SMS Campaign");
            String contactsJson = prefs.getString("contacts", "[]");
            String contentJson = prefs.getString("content", "[]");
            gapTimeMs = prefs.getInt("gapTimeMs", 5000);
            currentIndex = prefs.getInt("currentIndex", 0);
            sentCount = prefs.getInt("sentCount", 0);
            failedCount = prefs.getInt("failedCount", 0);
            
            contacts = new JSONArray(contactsJson);
            content = new JSONArray(contentJson);
            totalContacts = contacts.length();

            // SIM selection
            singleSubscriptionId = prefs.getInt("subscriptionId", -1);
            String subIdsJson = prefs.getString("subscriptionIds", "[]");
            try {
                JSONArray arr = new JSONArray(subIdsJson);
                rotationSubscriptionIds = new int[arr.length()];
                for (int i = 0; i < arr.length(); i++) {
                    rotationSubscriptionIds[i] = arr.getInt(i);
                }
            } catch (Exception ignore) {
                rotationSubscriptionIds = new int[0];
            }

            Log.d(TAG, "Loaded campaign: " + campaignName + ", contacts=" + totalContacts +
                  ", currentIndex=" + currentIndex +
                  ", subId=" + singleSubscriptionId +
                  ", rotation=" + rotationSubscriptionIds.length);
        } catch (Exception e) {
            Log.e(TAG, "Failed to load campaign data", e);
            stopSelf();
        }
    }

    private void saveCampaignProgress() {
        SharedPreferences.Editor editor = prefs.edit();
        editor.putInt("currentIndex", currentIndex);
        editor.putInt("sentCount", sentCount);
        editor.putInt("failedCount", failedCount);
        editor.putString("status", isRunning ? "sending" : "paused");
        editor.apply();
        Log.d(TAG, "Progress saved: idx=" + currentIndex + ", sent=" + sentCount + ", failed=" + failedCount);
    }

    private void processSmsQueue() {
        if (!isRunning) {
            Log.d(TAG, "Not running, stopping queue processing");
            return;
        }

        if (currentIndex >= totalContacts) {
            Log.d(TAG, "Queue complete! Sent=" + sentCount + ", Failed=" + failedCount);
            onQueueComplete();
            return;
        }

        try {
            JSONObject contact = contacts.getJSONObject(currentIndex);
            String phoneNumber = contact.getString("phoneNumber");
            
            // Pick random message from content array
            int msgIndex = (int) (Math.random() * content.length());
            String message = content.getString(msgIndex);
            
            Log.d(TAG, "Sending SMS " + (currentIndex + 1) + "/" + totalContacts + " to " + phoneNumber);
            
            // Pick SIM: rotation (if any) > single fixed > default (-1)
            int subId = singleSubscriptionId;
            if (rotationSubscriptionIds != null && rotationSubscriptionIds.length > 0) {
                subId = rotationSubscriptionIds[currentIndex % rotationSubscriptionIds.length];
            }

            sendSms(phoneNumber, message, subId, new SmsCallback() {
                @Override
                public void onSuccess() {
                    sentCount++;
                    currentIndex++;
                    updateNotification("Sent " + sentCount + "/" + totalContacts);
                    saveCampaignProgress();
                    scheduleNextSms();
                }

                @Override
                public void onFailure(String reason) {
                    Log.w(TAG, "SMS failed: " + reason);
                    failedCount++;
                    currentIndex++;
                    saveCampaignProgress();
                    scheduleNextSms();
                }
            });
            
        } catch (Exception e) {
            Log.e(TAG, "Error processing SMS at index " + currentIndex, e);
            failedCount++;
            currentIndex++;
            scheduleNextSms();
        }
    }

    private void scheduleNextSms() {
        if (isRunning && currentIndex < totalContacts) {
            handler.postDelayed(this::processSmsQueue, gapTimeMs);
        } else if (currentIndex >= totalContacts) {
            onQueueComplete();
        }
    }

    private void onQueueComplete() {
        Log.d(TAG, "Campaign complete!");
        updateNotification("Complete: " + sentCount + " sent, " + failedCount + " failed");
        
        // Mark as complete in SharedPreferences
        prefs.edit()
            .putString("status", "completed")
            .putInt("currentIndex", currentIndex)
            .putInt("sentCount", sentCount)
            .putInt("failedCount", failedCount)
            .apply();
        
        // Stop service after 5 seconds
        handler.postDelayed(() -> {
            stopForeground(true);
            stopSelf();
        }, 5000);
    }

    private void sendSms(String phoneNumber, String message, int subscriptionId, SmsCallback callback) {
        try {
            SmsManager smsManager;
            if (subscriptionId >= 0) {
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                        SmsManager base = getSystemService(SmsManager.class);
                        smsManager = base != null ? base.createForSubscriptionId(subscriptionId) : SmsManager.getSmsManagerForSubscriptionId(subscriptionId);
                    } else {
                        smsManager = SmsManager.getSmsManagerForSubscriptionId(subscriptionId);
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Per-SIM SmsManager failed for subId=" + subscriptionId + ", using default", e);
                    smsManager = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                        ? getSystemService(SmsManager.class)
                        : SmsManager.getDefault();
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                smsManager = getSystemService(SmsManager.class);
            } else {
                smsManager = SmsManager.getDefault();
            }

            // Always use divideMessage for proper segmentation (GSM-7 vs UCS-2)
            java.util.ArrayList<String> parts = smsManager.divideMessage(message);
            final int totalParts = parts.size();

            if (totalParts > 1) {
                // ── MULTIPART: Track ALL parts with sentIntents ──
                Log.d(TAG, "Sending multipart SMS: " + totalParts + " parts, length=" + message.length());
                final int[] partResults = new int[totalParts]; // 0=pending, 1=ok, -1=fail
                final boolean[] callbackFired = { false };
                final int reqId = (int)(System.currentTimeMillis() % 100000);

                java.util.ArrayList<android.app.PendingIntent> sentIntents = new java.util.ArrayList<>();
                for (int i = 0; i < totalParts; i++) {
                    final int partIndex = i;
                    String action = "BG_SMS_SENT_" + reqId + "_part" + i;
                    Intent intent = new Intent(action);
                    android.app.PendingIntent pi = android.app.PendingIntent.getBroadcast(
                        this, reqId * 100 + i, intent,
                        android.app.PendingIntent.FLAG_IMMUTABLE | android.app.PendingIntent.FLAG_UPDATE_CURRENT
                    );
                    sentIntents.add(pi);

                    android.content.BroadcastReceiver partReceiver = new android.content.BroadcastReceiver() {
                        @Override
                        public void onReceive(android.content.Context ctx, Intent intent) {
                            int code = getResultCode();
                            partResults[partIndex] = (code == android.app.Activity.RESULT_OK) ? 1 : -1;
                            Log.d(TAG, "Multipart part " + (partIndex+1) + "/" + totalParts +
                                (code == android.app.Activity.RESULT_OK ? " OK" : " FAILED: code=" + code));
                            try { ctx.unregisterReceiver(this); } catch (Exception e) { /* ignore */ }

                            // Check if all parts resolved
                            boolean allDone = true;
                            int okCount = 0;
                            for (int r : partResults) {
                                if (r == 0) { allDone = false; break; }
                                if (r == 1) okCount++;
                            }
                            if (allDone && !callbackFired[0]) {
                                callbackFired[0] = true;
                                if (okCount == totalParts) {
                                    callback.onSuccess();
                                } else {
                                    callback.onFailure("multipart_partial: " + okCount + "/" + totalParts + " parts sent");
                                }
                            }
                        }
                    };

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        registerReceiver(partReceiver, new android.content.IntentFilter(action), android.content.Context.RECEIVER_NOT_EXPORTED);
                    } else {
                        registerReceiver(partReceiver, new android.content.IntentFilter(action));
                    }
                }

                // Timeout for multipart
                handler.postDelayed(() -> {
                    if (!callbackFired[0]) {
                        callbackFired[0] = true;
                        int okCount = 0;
                        for (int r : partResults) { if (r == 1) okCount++; }
                        if (okCount == totalParts) {
                            callback.onSuccess();
                        } else {
                            callback.onFailure("multipart_timeout: " + okCount + "/" + totalParts + " parts confirmed");
                        }
                    }
                }, 30000 + totalParts * 5000);

                smsManager.sendMultipartTextMessage(phoneNumber, null, parts, sentIntents, null);

            } else {
                // ── SINGLE PART: Track with sentIntent ──
                final boolean[] callbackFired = { false };
                final int reqId = (int)(System.currentTimeMillis() % 100000);
                String action = "BG_SMS_SENT_" + reqId;
                Intent intent = new Intent(action);
                android.app.PendingIntent sentPI = android.app.PendingIntent.getBroadcast(
                    this, reqId, intent,
                    android.app.PendingIntent.FLAG_IMMUTABLE | android.app.PendingIntent.FLAG_UPDATE_CURRENT
                );

                android.content.BroadcastReceiver sentReceiver = new android.content.BroadcastReceiver() {
                    @Override
                    public void onReceive(android.content.Context ctx, Intent intent) {
                        if (callbackFired[0]) return;
                        callbackFired[0] = true;
                        int code = getResultCode();
                        try { ctx.unregisterReceiver(this); } catch (Exception e) { /* ignore */ }
                        if (code == android.app.Activity.RESULT_OK) {
                            callback.onSuccess();
                        } else {
                            callback.onFailure("send_failed_code_" + code);
                        }
                    }
                };

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    registerReceiver(sentReceiver, new android.content.IntentFilter(action), android.content.Context.RECEIVER_NOT_EXPORTED);
                } else {
                    registerReceiver(sentReceiver, new android.content.IntentFilter(action));
                }

                // Timeout
                handler.postDelayed(() -> {
                    if (!callbackFired[0]) {
                        callbackFired[0] = true;
                        callback.onFailure("send_timeout");
                    }
                }, 30000);

                smsManager.sendTextMessage(phoneNumber, null, message, sentPI, null);
            }

        } catch (SecurityException e) {
            Log.e(TAG, "SMS permission denied", e);
            callback.onFailure("permission_denied");
        } catch (IllegalArgumentException e) {
            Log.e(TAG, "Invalid phone number or message", e);
            callback.onFailure("invalid_input");
        } catch (Exception e) {
            Log.e(TAG, "SMS send exception", e);
            callback.onFailure("send_exception");
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "SMS Sending Service",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Shows progress of bulk SMS campaigns");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildNotification(String status) {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, notificationIntent, PendingIntent.FLAG_IMMUTABLE
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Nomadly SMS")
            .setContentText(status)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .build();
    }

    private void updateNotification(String status) {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(NOTIFICATION_ID, buildNotification(status));
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        Log.d(TAG, "Service destroyed");
        isRunning = false;
        handler.removeCallbacksAndMessages(null);
        saveCampaignProgress();
        super.onDestroy();
    }

    interface SmsCallback {
        void onSuccess();
        void onFailure(String reason);
    }
}
