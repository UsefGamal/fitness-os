package com.usefgamal.fitnessos.device;

import android.app.KeyguardManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

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

    /**
     * P14-12: is the app exempt from battery optimisation, and which maker
     * made the phone (Xiaomi, Infinix, Tecno... add their own task killers),
     * so Settings can show the right guide.
     */
    @PluginMethod
    public void battery(PluginCall call) {
        PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        JSObject out = new JSObject();
        out.put("unrestricted", pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName()));
        out.put("manufacturer", Build.MANUFACTURER == null ? "" : Build.MANUFACTURER.toLowerCase());
        call.resolve(out);
    }

    /** Ask Android to let reminders run (one system dialog), or open the
     * app's battery list when that dialog isn't available. */
    @PluginMethod
    public void allowBackground(PluginCall call) {
        Context c = getContext();
        Intent ask = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + c.getPackageName()));
        if (!start(ask)) start(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
        call.resolve();
    }

    /**
     * Open the maker's own "autostart" / "app launch" screen, where Xiaomi
     * (MIUI, HyperOS) and Transsion phones (Infinix, Tecno, itel) stop apps
     * from waking up. Falls back to the app's own Android settings page.
     * Resolves { opened: "autostart" | "app" }.
     */
    @PluginMethod
    public void openAutostart(PluginCall call) {
        String[][] screens = {
            {"com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"},
            {"com.transsion.phonemaster", "com.cyin.himgr.autostart.AutoStartActivity"},
            {"com.transsion.phonemanager", "com.itel.autobootmanager.activity.AutoBootMgrActivity"},
            {"com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"},
            {"com.oplus.safecenter", "com.oplus.safecenter.permission.startup.StartupAppListActivity"},
            {"com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"},
            {"com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"},
        };
        JSObject out = new JSObject();
        for (String[] s : screens) {
            Intent i = new Intent();
            i.setComponent(new ComponentName(s[0], s[1]));
            if (start(i)) {
                out.put("opened", "autostart");
                call.resolve(out);
                return;
            }
        }
        start(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName())));
        out.put("opened", "app");
        call.resolve(out);
    }

    private boolean start(Intent i) {
        try {
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
