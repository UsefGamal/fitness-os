package com.usefgamal.fitnessos.device;

import android.app.KeyguardManager;
import android.content.Context;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Facts about the phone the app needs (P14-09). Android only backs the app
 * up to Google when the phone has a screen lock (res/xml backup rules), so
 * the backup reminder asks whether there is one.
 */
@CapacitorPlugin(name = "Device")
public class DevicePlugin extends Plugin {
    @PluginMethod
    public void security(PluginCall call) {
        KeyguardManager km = (KeyguardManager) getContext().getSystemService(Context.KEYGUARD_SERVICE);
        JSObject out = new JSObject();
        out.put("screenLock", km != null && km.isDeviceSecure());
        call.resolve(out);
    }
}
