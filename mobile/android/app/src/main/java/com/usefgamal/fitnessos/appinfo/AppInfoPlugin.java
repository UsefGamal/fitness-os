package com.usefgamal.fitnessos.appinfo;

import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.os.Build;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.security.MessageDigest;

/**
 * The SHA-256 of the certificate this APK is signed with, read from Android
 * itself (P14-08, SEC-04). Settings > About shows its first 8 characters,
 * which the release notes also list, so a friend can tell a real APK from a
 * re-signed copy.
 */
@CapacitorPlugin(name = "AppInfo")
public class AppInfoPlugin extends Plugin {
    @PluginMethod
    public void signing(PluginCall call) {
        try {
            PackageManager pm = getContext().getPackageManager();
            String pkg = getContext().getPackageName();
            Signature[] sigs;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                PackageInfo info = pm.getPackageInfo(pkg, PackageManager.GET_SIGNING_CERTIFICATES);
                sigs = info.signingInfo.hasMultipleSigners()
                    ? info.signingInfo.getApkContentsSigners()
                    : info.signingInfo.getSigningCertificateHistory();
            } else {
                PackageInfo info = pm.getPackageInfo(pkg, PackageManager.GET_SIGNATURES);
                sigs = info.signatures;
            }
            if (sigs == null || sigs.length == 0) {
                call.reject("No signature");
                return;
            }
            // The newest certificate (the last in the rotation history).
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(sigs[sigs.length - 1].toByteArray());
            StringBuilder hex = new StringBuilder();
            for (byte b : digest) hex.append(String.format("%02X", b));
            JSObject out = new JSObject();
            out.put("sha256", hex.toString());
            call.resolve(out);
        } catch (Exception e) {
            call.reject(e.getMessage());
        }
    }

    /**
     * PROOF-1: writes the app's start line ("OK 0.9.8 W 12 · S 140 · M 61 ·
     * B 3 · 3F9A-12CD") to logcat under one tag, so the release update test
     * (scripts/update-over-install.sh) can compare the data before and after
     * an update without touching the screen. Counts and a hash only; other
     * apps can't read this app's log lines.
     */
    @PluginMethod
    public void dataCheck(PluginCall call) {
        String line = call.getString("line", "");
        if (line.length() > 200) line = line.substring(0, 200);
        Log.i("FitnessOSData", line.replaceAll("[\\r\\n]", " "));
        call.resolve();
    }
}
