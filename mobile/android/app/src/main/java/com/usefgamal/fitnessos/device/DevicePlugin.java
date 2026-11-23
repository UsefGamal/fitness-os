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

    /** Android's font size (Settings > Display > Font size): 1 is the
     * default, 1.3 is large. The WebView's own text zoom is fixed at 100
     * (MainActivity), so the app picks its starting text size from this. */
    @PluginMethod
    public void fontScale(PluginCall call) {
        JSObject out = new JSObject();
        out.put("fontScale", getContext().getResources().getConfiguration().fontScale);
        call.resolve(out);
    }

    /** Open Tafra's own Android settings page, where Battery > Unrestricted
     * lets reminders run, or the phone's battery list if that page won't
     * open. PLAY-1: Google Play only allows the one-tap "stop optimising"
     * dialog (REQUEST_IGNORE_BATTERY_OPTIMIZATIONS) for a few kinds of app,
     * and a workout planner isn't one, so the app no longer asks for it. */
    @PluginMethod
    public void allowBackground(PluginCall call) {
        Context c = getContext();
        Intent page = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + c.getPackageName()));
        if (!start(page)) start(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
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
