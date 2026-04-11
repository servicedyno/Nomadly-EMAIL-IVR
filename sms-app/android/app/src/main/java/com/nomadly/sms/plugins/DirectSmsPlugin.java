package com.nomadly.sms.plugins;

import android.Manifest;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
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
    private static final String SMS_SENT = "SMS_SENT";
    private static final String SMS_DELIVERED = "SMS_DELIVERED";

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

    private void sendSmsDirectly(PluginCall call, String phoneNumber, String message) {
        try {
            Context context = getContext();
            SmsManager smsManager;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                smsManager = context.getSystemService(SmsManager.class);
            } else {
                smsManager = SmsManager.getDefault();
            }

            Intent sentIntent = new Intent(SMS_SENT);
            PendingIntent sentPI = PendingIntent.getBroadcast(
                context, 0, sentIntent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
            );

            // Register receiver for sent status
            BroadcastReceiver sentReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    JSObject result = new JSObject();
                    if (getResultCode() == android.app.Activity.RESULT_OK) {
                        result.put("success", true);
                        result.put("status", "sent");
                    } else {
                        result.put("success", false);
                        result.put("status", "failed");
                        result.put("errorCode", getResultCode());
                    }
                    call.resolve(result);

                    try {
                        context.unregisterReceiver(this);
                    } catch (Exception e) { /* ignore */ }
                }
            };

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.registerReceiver(sentReceiver, new IntentFilter(SMS_SENT), Context.RECEIVER_NOT_EXPORTED);
            } else {
                context.registerReceiver(sentReceiver, new IntentFilter(SMS_SENT));
            }

            // Handle long messages
            if (message.length() > 160) {
                java.util.ArrayList<String> parts = smsManager.divideMessage(message);
                java.util.ArrayList<PendingIntent> sentIntents = new java.util.ArrayList<>();
                for (int i = 0; i < parts.size(); i++) {
                    sentIntents.add(sentPI);
                }
                smsManager.sendMultipartTextMessage(phoneNumber, null, parts, sentIntents, null);
            } else {
                smsManager.sendTextMessage(phoneNumber, null, message, sentPI, null);
            }

        } catch (Exception e) {
            JSObject result = new JSObject();
            result.put("success", false);
            result.put("error", e.getMessage());
            call.resolve(result);
        }
    }
}
