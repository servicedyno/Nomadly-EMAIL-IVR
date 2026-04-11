package com.nomadly.sms;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.nomadly.sms.plugins.DirectSmsPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DirectSmsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
