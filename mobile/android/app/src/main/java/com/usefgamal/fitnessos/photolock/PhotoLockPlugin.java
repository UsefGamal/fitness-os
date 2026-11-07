package com.usefgamal.fitnessos.photolock;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.view.WindowManager;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Photo lock (P14-13). Progress photos open with the phone's own screen
 * lock (PIN, pattern, password or fingerprint, whatever the phone uses),
 * so the app keeps no password of its own that could be forgotten. While
 * Photos is open the window is FLAG_SECURE: no screenshots and a blank
 * preview in recent apps. Nothing here ever deletes a photo.
 */
@CapacitorPlugin(name = "PhotoLock")
public class PhotoLockPlugin extends Plugin {
    private KeyguardManager keyguard() {
        return (KeyguardManager) getContext().getSystemService(Context.KEYGUARD_SERVICE);
    }

    /** { lock: true } when the phone has a screen lock to ask for. */
    @PluginMethod
    public void available(PluginCall call) {
        KeyguardManager km = keyguard();
        JSObject out = new JSObject();
        out.put("lock", km != null && km.isDeviceSecure());
        call.resolve(out);
    }

    /** Ask for the phone's lock: { unlocked, noLock }. */
    @PluginMethod
    public void unlock(PluginCall call) {
        KeyguardManager km = keyguard();
        if (km == null || !km.isDeviceSecure()) {
            JSObject out = new JSObject();
            out.put("unlocked", true);
            out.put("noLock", true);
            call.resolve(out);
            return;
        }
        Intent intent = km.createConfirmDeviceCredentialIntent(call.getString("title", "Progress photos"), call.getString("subtitle", ""));
        if (intent == null) {
            JSObject out = new JSObject();
            out.put("unlocked", true);
            out.put("noLock", true);
            call.resolve(out);
            return;
        }
        startActivityForResult(call, intent, "unlockResult");
    }

    @ActivityCallback
    private void unlockResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject out = new JSObject();
        out.put("unlocked", result.getResultCode() == Activity.RESULT_OK);
        out.put("noLock", false);
        call.resolve(out);
    }

    /** FLAG_SECURE on (Photos open) or off (anywhere else). */
    @PluginMethod
    public void secure(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        Activity activity = getActivity();
        if (activity == null) {
            call.resolve();
            return;
        }
        activity.runOnUiThread(() -> {
            if (on) activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
            else activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            call.resolve();
        });
    }
}
