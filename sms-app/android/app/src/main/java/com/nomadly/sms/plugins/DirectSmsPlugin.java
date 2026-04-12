package com.nomadly.sms.plugins;

import android.Manifest;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.telephony.SmsManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

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

        // Check permission
        if (!hasPermission("sms")) {
            requestAllPermissions(call, "smsPermissionCallback");
            return;
        }

        sendSmsDirectly(call, phoneNumber, message);
    }

    @PluginMethod
    public void checkPermission(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", hasPermission("sms"));
        call.resolve(result);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (hasPermission("sms")) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
        } else {
            requestAllPermissions(call, "smsPermissionCallback");
        }
    }

    @com.getcapacitor.annotation.PermissionCallback
    private void smsPermissionCallback(PluginCall call) {
        if (hasPermission("sms")) {
            String phoneNumber = call.getString("phoneNumber");
            String message = call.getString("message");
            if (phoneNumber != null && message != null) {
                sendSmsDirectly(call, phoneNumber, message);
            } else {
                JSObject result = new JSObject();
                result.put("granted", true);
                call.resolve(result);
            }
        } else {
            call.reject("SMS permission denied");
        }
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

            // Unique intent action per send to avoid receiver collisions
            final String intentAction = SMS_SENT + (++requestCounter);
            final boolean[] resolved = { false };

            Intent sentIntent = new Intent(intentAction);
            PendingIntent sentPI = PendingIntent.getBroadcast(
                context, requestCounter, sentIntent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
            );

            // Register receiver for sent status
            BroadcastReceiver sentReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
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
                    call.resolve(result);

                    try {
                        context.unregisterReceiver(this);
                    } catch (Exception e) { /* ignore */ }
                }
            };

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.registerReceiver(sentReceiver, new IntentFilter(intentAction), Context.RECEIVER_NOT_EXPORTED);
            } else {
                context.registerReceiver(sentReceiver, new IntentFilter(intentAction));
            }

            // Timeout handler — resolve with error if broadcast never fires
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                if (!resolved[0]) {
                    resolved[0] = true;
                    JSObject result = new JSObject();
                    result.put("success", false);
                    result.put("status", "timeout");
                    result.put("errorCode", -1);
                    result.put("errorReason", "send_timeout");
                    call.resolve(result);

                    try {
                        context.unregisterReceiver(sentReceiver);
                    } catch (Exception e) { /* ignore */ }
                }
            }, SEND_TIMEOUT_MS);

            // Handle long messages
            if (message.length() > 160) {
                java.util.ArrayList<String> parts = smsManager.divideMessage(message);
                java.util.ArrayList<PendingIntent> sentIntents = new java.util.ArrayList<>();
                // Only track the last part to determine overall success
                for (int i = 0; i < parts.size() - 1; i++) {
                    sentIntents.add(null);
                }
                sentIntents.add(sentPI);
                smsManager.sendMultipartTextMessage(phoneNumber, null, parts, sentIntents, null);
            } else {
                smsManager.sendTextMessage(phoneNumber, null, message, sentPI, null);
            }

        } catch (Exception e) {
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("status", "exception");
            result.put("error", e.getMessage());
            result.put("errorReason", "send_exception");
            call.resolve(result);
        }
    }
}
