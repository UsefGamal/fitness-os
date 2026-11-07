package com.usefgamal.fitnessos;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.usefgamal.fitnessos.appinfo.AppInfoPlugin;
import com.usefgamal.fitnessos.device.DevicePlugin;
import com.usefgamal.fitnessos.health.HealthPlugin;
import com.usefgamal.fitnessos.photolock.PhotoLockPlugin;
import com.usefgamal.fitnessos.timer.RestTimerPlugin;
import com.usefgamal.fitnessos.widget.WidgetPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The app's own plugins (phase 4); registered before the bridge starts.
        registerPlugin(RestTimerPlugin.class);
        registerPlugin(WidgetPlugin.class);
        registerPlugin(HealthPlugin.class);
        registerPlugin(AppInfoPlugin.class);
        registerPlugin(DevicePlugin.class);
        registerPlugin(PhotoLockPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
