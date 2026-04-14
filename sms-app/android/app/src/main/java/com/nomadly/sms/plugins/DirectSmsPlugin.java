package com.nomadly.sms.plugins;

import android.Manifest;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.telephony.SmsManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.nomadly.sms.services.SmsBackgroundService;

import org.json.JSONArray;
import org.json.JSONException;

@CapacitorPlugin(
    name = "DirectSms",
    permissions = {
        @Permission(
            strings = { Manifest.permission.SEND_SMS },
            alias = "sms"
        ),
        @Permission(
            strings = { Manifest.permission.READ_SMS },
            alias = "readSms"
        )
    }
)
public class DirectSmsPlugin extends Plugin {
    private static final String SMS_SENT = "SMS_SENT_";
    private static final int SEND_TIMEOUT_MS = 30000; // 30 second timeout
    private int requestCounter = 0;
    private boolean permissionRequestInFlight = false;

    @PluginMethod
    public void send(PluginCall call) {
        String phoneNumber = call.getString("phoneNumber");
        String message = call.getString("message");

        if (phoneNumber == null || phoneNumber.isEmpty()) {
            call.reject("Phone number is required");
            return;
        }
        if (message == null || message.isEmpty()) {
            call.reject("Message is required");
            return;
        }

        // Check permission using direct Android API (not Capacitor's hasPermission which can be stale)
        boolean hasSmsPermission = androidx.core.content.ContextCompat.checkSelfPermission(
            getContext(), Manifest.permission.SEND_SMS
        ) == android.content.pm.PackageManager.PERMISSION_GRANTED;
        
        android.util.Log.d("DirectSms", "send: SEND_SMS permission=" + hasSmsPermission + 
            " (Capacitor=" + hasPermission("sms") + ")");
        
        if (!hasSmsPermission) {
            android.util.Log.w("DirectSms", "SMS permission not granted — returning permission_needed");
            // Don't request permission from send() — let JS side handle it
            // This avoids the call.reject() issue when permission is denied
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("status", "permission_needed");
            result.put("errorCode", -20);
            result.put("errorReason", "permission_needed");
            result.put("error", "SMS permission not granted. Please grant permission in app settings.");
            call.resolve(result);
            return;
        }

        sendSmsDirectly(call, phoneNumber, message);
    }

    @PluginMethod
    public void checkPermission(PluginCall call) {
        JSObject result = new JSObject();
        // Use direct Android API instead of Capacitor's hasPermission() which can be unreliable
        boolean granted = androidx.core.content.ContextCompat.checkSelfPermission(
            getContext(), Manifest.permission.SEND_SMS
        ) == android.content.pm.PackageManager.PERMISSION_GRANTED;
        
        android.util.Log.d("DirectSms", "checkPermission: SEND_SMS granted=" + granted + 
            " (Capacitor hasPermission=" + hasPermission("sms") + ")");
        
        result.put("granted", granted);
        if (!granted && getActivity() != null) {
            result.put("canRequest", getActivity().shouldShowRequestPermissionRationale(Manifest.permission.SEND_SMS));
        }
        call.resolve(result);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        boolean granted = androidx.core.content.ContextCompat.checkSelfPermission(
            getContext(), Manifest.permission.SEND_SMS
        ) == android.content.pm.PackageManager.PERMISSION_GRANTED;
        
        if (granted) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
        } else {
            permissionRequestInFlight = true;
            requestAllPermissions(call, "smsPermissionCallback");
        }
    }

    /**
     * Opens the app's Android Settings page where the user can manually enable permissions.
     * Essential for when the user has permanently denied SMS permission ("Don't ask again").
     */
    @PluginMethod
    public void openSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            Uri uri = Uri.fromParts("package", getContext().getPackageName(), null);
            intent.setData(uri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject result = new JSObject();
            result.put("opened", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to open settings: " + e.getMessage());
        }
    }

    @com.getcapacitor.annotation.PermissionCallback
    private void smsPermissionCallback(PluginCall call) {
        permissionRequestInFlight = false;
        // Use direct Android API for permission check (more reliable than Capacitor's)
        boolean granted = androidx.core.content.ContextCompat.checkSelfPermission(
            getContext(), Manifest.permission.SEND_SMS
        ) == android.content.pm.PackageManager.PERMISSION_GRANTED;
        
        android.util.Log.d("DirectSms", "smsPermissionCallback: granted=" + granted);
        
        JSObject result = new JSObject();
        if (granted) {
            // Permission was granted — if this was a send() call, proceed with sending
            String phoneNumber = call.getString("phoneNumber");
            String message = call.getString("message");
            if (phoneNumber != null && message != null) {
                sendSmsDirectly(call, phoneNumber, message);
                return;
            }
            result.put("granted", true);
        } else {
            // Permission denied — resolve (don't reject) so JS can handle gracefully
            result.put("granted", false);
            result.put("permanentlyDenied", !getActivity().shouldShowRequestPermissionRationale(Manifest.permission.SEND_SMS));
        }
        call.resolve(result);
    }

    private String getErrorReason(int resultCode) {
        switch (resultCode) {
            case android.app.Activity.RESULT_OK:
                return "sent";
            case SmsManager.RESULT_ERROR_GENERIC_FAILURE:
                return "generic_failure";
            case SmsManager.RESULT_ERROR_NO_SERVICE:
                return "no_service";
            case SmsManager.RESULT_ERROR_NULL_PDU:
                return "null_pdu";
            case SmsManager.RESULT_ERROR_RADIO_OFF:
                return "radio_off";
            default:
                return "unknown_error_" + resultCode;
        }
    }

    private void sendSmsDirectly(PluginCall call, String phoneNumber, String message) {
        try {
            Context context = getContext();
            SmsManager smsManager;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                smsManager = context.getSystemService(SmsManager.class);
            } else {
                smsManager = SmsManager.getDefault();
            }

            // Always use divideMessage for proper SMS segmentation
            // Handles GSM-7 (160 chars) vs UCS-2/Unicode (70 chars) automatically
            java.util.ArrayList<String> parts = smsManager.divideMessage(message);
            final int totalParts = parts.size();

            android.util.Log.d("DirectSms", "Sending SMS: " + totalParts + " part(s), total length: " + message.length() + " chars");

            // Unique intent action base per send to avoid receiver collisions
            final int reqId = ++requestCounter;
            final boolean[] resolved = { false };

            if (totalParts > 1) {
                // ── MULTIPART: Track ALL parts, only resolve when all are confirmed ──
                final int[] partResults = new int[totalParts]; // 0=pending, 1=ok, -1=fail
                final String[] partErrors = new String[totalParts];

                java.util.ArrayList<PendingIntent> sentIntents = new java.util.ArrayList<>();
                for (int i = 0; i < totalParts; i++) {
                    final int partIndex = i;
                    String action = SMS_SENT + reqId + "_part" + i;
                    Intent intent = new Intent(action);
                    PendingIntent pi = PendingIntent.getBroadcast(
                        context, reqId * 100 + i, intent,
                        PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
                    );
                    sentIntents.add(pi);

                    BroadcastReceiver partReceiver = new BroadcastReceiver() {
                        @Override
                        public void onReceive(Context ctx, Intent intent) {
                            int code = getResultCode();
                            if (code == android.app.Activity.RESULT_OK) {
                                partResults[partIndex] = 1;
                                android.util.Log.d("DirectSms", "Part " + (partIndex+1) + "/" + totalParts + " sent OK");
                            } else {
                                partResults[partIndex] = -1;
                                partErrors[partIndex] = getErrorReason(code);
                                android.util.Log.w("DirectSms", "Part " + (partIndex+1) + "/" + totalParts + " FAILED: " + getErrorReason(code));
                            }
                            try { ctx.unregisterReceiver(this); } catch (Exception e) { /* ignore */ }

                            // Check if all parts are resolved
                            boolean allDone = true;
                            int okCount = 0, failCount = 0;
                            for (int r : partResults) {
                                if (r == 0) { allDone = false; break; }
                                if (r == 1) okCount++;
                                if (r == -1) failCount++;
                            }

                            if (allDone && !resolved[0]) {
                                resolved[0] = true;
                                JSObject result = new JSObject();
                                if (failCount == 0) {
                                    result.put("success", true);
                                    result.put("status", "sent");
                                    result.put("parts", totalParts);
                                } else {
                                    // Some parts failed — report partial failure
                                    result.put("success", false);
                                    result.put("status", "partial_failure");
                                    result.put("parts", totalParts);
                                    result.put("partsSent", okCount);
                                    result.put("partsFailed", failCount);
                                    result.put("errorCode", -2);
                                    result.put("errorReason", "multipart_partial_failure");
                                    // Collect first error detail
                                    for (String err : partErrors) {
                                        if (err != null) { result.put("error", err); break; }
                                    }
                                }
                                call.resolve(result);
                            }
                        }
                    };

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        context.registerReceiver(partReceiver, new IntentFilter(action), Context.RECEIVER_NOT_EXPORTED);
                    } else {
                        context.registerReceiver(partReceiver, new IntentFilter(action));
                    }
                }

                // Timeout for multipart — longer timeout for more parts
                int multipartTimeout = SEND_TIMEOUT_MS + (totalParts * 5000);
                new Handler(Looper.getMainLooper()).postDelayed(() -> {
                    if (!resolved[0]) {
                        resolved[0] = true;
                        int okCount = 0, pendingCount = 0;
                        for (int r : partResults) {
                            if (r == 1) okCount++;
                            if (r == 0) pendingCount++;
                        }
                        JSObject result = new JSObject();
                        if (okCount > 0 && okCount == totalParts) {
                            result.put("success", true);
                            result.put("status", "sent");
                        } else {
                            result.put("success", false);
                            result.put("status", "timeout");
                            result.put("errorCode", -1);
                            result.put("errorReason", "multipart_timeout");
                            result.put("error", okCount + "/" + totalParts + " parts confirmed, " + pendingCount + " timed out");
                        }
                        result.put("parts", totalParts);
                        result.put("partsSent", okCount);
                        call.resolve(result);
                    }
                }, multipartTimeout);

                android.util.Log.d("DirectSms", "Sending multipart SMS: " + totalParts + " parts, tracking ALL parts");
                smsManager.sendMultipartTextMessage(phoneNumber, null, parts, sentIntents, null);

            } else {
                // ── SINGLE PART: Simple tracking ──
                String intentAction = SMS_SENT + reqId;
                Intent sentIntent = new Intent(intentAction);
                PendingIntent sentPI = PendingIntent.getBroadcast(
                    context, reqId, sentIntent,
                    PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
                );

                BroadcastReceiver sentReceiver = new BroadcastReceiver() {
                    @Override
                    public void onReceive(Context ctx, Intent intent) {
                        if (resolved[0]) return;
                        resolved[0] = true;
                        JSObject result = new JSObject();
                        int code = getResultCode();
                        if (code == android.app.Activity.RESULT_OK) {
                            result.put("success", true);
                            result.put("status", "sent");
                        } else {
                            result.put("success", false);
                            result.put("status", "failed");
                            result.put("errorCode", code);
                            result.put("errorReason", getErrorReason(code));
                        }
                        result.put("parts", 1);
                        call.resolve(result);
                        try { ctx.unregisterReceiver(this); } catch (Exception e) { /* ignore */ }
                    }
                };

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    context.registerReceiver(sentReceiver, new IntentFilter(intentAction), Context.RECEIVER_NOT_EXPORTED);
                } else {
                    context.registerReceiver(sentReceiver, new IntentFilter(intentAction));
                }

                new Handler(Looper.getMainLooper()).postDelayed(() -> {
                    if (!resolved[0]) {
                        resolved[0] = true;
                        JSObject result = new JSObject();
                        result.put("success", false);
                        result.put("status", "timeout");
                        result.put("errorCode", -1);
                        result.put("errorReason", "send_timeout");
                        result.put("parts", 1);
                        call.resolve(result);
                        try { context.unregisterReceiver(sentReceiver); } catch (Exception e) { /* ignore */ }
                    }
                }, SEND_TIMEOUT_MS);

                smsManager.sendTextMessage(phoneNumber, null, message, sentPI, null);
            }

        } catch (SecurityException e) {
            // Permission was revoked or never granted
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("status", "exception");
            result.put("errorCode", -10);
            result.put("error", "SMS permission denied by Android. Go to Settings > Apps > Nomadly SMS > Permissions > enable SMS.");
            result.put("errorReason", "permission_denied");
            call.resolve(result);
        } catch (IllegalArgumentException e) {
            // Invalid phone number or message format
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("status", "exception");
            result.put("errorCode", -11);
            result.put("error", "Invalid input: " + e.getMessage());
            result.put("errorReason", "invalid_input");
            call.resolve(result);
        } catch (Exception e) {
            // Generic exception - return full details
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("status", "exception");
            result.put("errorCode", -12);
            String errMsg = e.getMessage();
            if (errMsg == null || errMsg.isEmpty()) {
                errMsg = e.getClass().getName() + " (no message)";
            }
            result.put("error", errMsg);
            result.put("errorReason", "send_exception");
            result.put("exceptionType", e.getClass().getSimpleName());
            call.resolve(result);
        }
    }

    /**
     * Start background SMS sending service (replicates React Native MyTaskService)
     * @param call - expects: campaignId, campaignName, contacts (JSONArray), content (JSONArray), gapTimeMs
     */
    @PluginMethod
    public void startBackgroundSending(PluginCall call) {
        try {
            String campaignId = call.getString("campaignId", "");
            String campaignName = call.getString("campaignName", "SMS Campaign");
            String contactsJson = call.getString("contacts", "[]");
            String contentJson = call.getString("content", "[]");
            int gapTimeMs = call.getInt("gapTimeMs", 5000);
            int startIndex = call.getInt("startIndex", 0);
            
            // Validate inputs
            JSONArray contacts = new JSONArray(contactsJson);
            JSONArray content = new JSONArray(contentJson);
            
            if (contacts.length() == 0 || content.length() == 0) {
                call.reject("Contacts and content are required");
                return;
            }
            
            // Save campaign data to SharedPreferences for service to read
            SharedPreferences prefs = getContext().getSharedPreferences("nomadly_sms_queue", Context.MODE_PRIVATE);
            prefs.edit()
                .putString("campaignId", campaignId)
                .putString("campaignName", campaignName)
                .putString("contacts", contactsJson)
                .putString("content", contentJson)
                .putInt("gapTimeMs", gapTimeMs)
                .putInt("currentIndex", startIndex)
                .putInt("sentCount", 0)
                .putInt("failedCount", 0)
                .putString("status", "sending")
                .apply();
            
            // Start foreground service
            Intent serviceIntent = new Intent(getContext(), SmsBackgroundService.class);
            serviceIntent.setAction("START");
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(serviceIntent);
            } else {
                getContext().startService(serviceIntent);
            }
            
            android.util.Log.d("DirectSms", "Background service started for campaign: " + campaignName);
            
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("message", "Background sending started");
            call.resolve(result);
            
        } catch (JSONException e) {
            call.reject("Invalid JSON data: " + e.getMessage());
        } catch (Exception e) {
            call.reject("Failed to start background service: " + e.getMessage());
        }
    }

    /**
     * Stop background SMS sending service
     */
    @PluginMethod
    public void stopBackgroundSending(PluginCall call) {
        try {
            Intent serviceIntent = new Intent(getContext(), SmsBackgroundService.class);
            serviceIntent.setAction("STOP");
            getContext().startService(serviceIntent);
            
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("message", "Background sending stopped");
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to stop service: " + e.getMessage());
        }
    }

    /**
     * Pause background SMS sending
     */
    @PluginMethod
    public void pauseBackgroundSending(PluginCall call) {
        try {
            Intent serviceIntent = new Intent(getContext(), SmsBackgroundService.class);
            serviceIntent.setAction("PAUSE");
            getContext().startService(serviceIntent);
            
            JSObject result = new JSObject();
            result.put("success", true);
            result.put("message", "Background sending paused");
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to pause service: " + e.getMessage());
        }
    }

    /**
     * Get current background sending status
     */
    @PluginMethod
    public void getBackgroundStatus(PluginCall call) {
        try {
            SharedPreferences prefs = getContext().getSharedPreferences("nomadly_sms_queue", Context.MODE_PRIVATE);
            
            JSObject result = new JSObject();
            result.put("status", prefs.getString("status", "idle"));
            result.put("currentIndex", prefs.getInt("currentIndex", 0));
            result.put("sentCount", prefs.getInt("sentCount", 0));
            result.put("failedCount", prefs.getInt("failedCount", 0));
            result.put("campaignId", prefs.getString("campaignId", ""));
            result.put("campaignName", prefs.getString("campaignName", ""));
            
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to get status: " + e.getMessage());
        }
    }
}
