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
            
            Log.d(TAG, "Loaded campaign: " + campaignName + ", contacts=" + totalContacts + 
                  ", currentIndex=" + currentIndex);
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
            
            sendSms(phoneNumber, message, new SmsCallback() {
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

    private void sendSms(String phoneNumber, String message, SmsCallback callback) {
        try {
            SmsManager smsManager;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                smsManager = getSystemService(SmsManager.class);
            } else {
                smsManager = SmsManager.getDefault();
            }

            // ✅ IMPROVED: Always use divideMessage for reliability
            // This handles both short and long messages, and properly segments based on encoding (GSM-7 vs UCS-2)
            java.util.ArrayList<String> parts = smsManager.divideMessage(message);
            
            if (parts.size() > 1) {
                // Multi-part message - send as concatenated SMS
                Log.d(TAG, "Sending multipart SMS: " + parts.size() + " parts");
                smsManager.sendMultipartTextMessage(phoneNumber, null, parts, null, null);
            } else {
                // Single part message
                smsManager.sendTextMessage(phoneNumber, null, message, null, null);
            }
            
            // Consider it successful if no exception thrown
            callback.onSuccess();
            
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
