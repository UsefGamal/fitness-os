package com.usefgamal.fitnessos;

import android.os.Build;
import android.os.Bundle;

import androidx.activity.BackEventCompat;
import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;
import com.usefgamal.fitnessos.appinfo.AppInfoPlugin;
import com.usefgamal.fitnessos.backup.BackupFolderPlugin;
import com.usefgamal.fitnessos.crash.CrashPlugin;
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
        registerPlugin(CrashPlugin.class);
        registerPlugin(BackupFolderPlugin.class);
        super.onCreate(savedInstanceState);
        addPredictiveBack();
    }

    /**
     * MOVE-1, predictive back (Android 14+): while the back swipe moves, the
     * page shrinks towards the edge (motionFx.js, window.fosBack). This
     * callback sits on top only to hear the swipe's progress; when the swipe
     * completes it steps aside and hands the back press on, so Capacitor's
     * backButton (close a sheet, go back, leave the app) works as before.
     */
    private void addPredictiveBack() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return;
        OnBackPressedCallback cb = new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackStarted(BackEventCompat e) { send("progress", 0f, e.getSwipeEdge()); }

            @Override
            public void handleOnBackProgressed(BackEventCompat e) { send("progress", e.getProgress(), e.getSwipeEdge()); }

            @Override
            public void handleOnBackCancelled() { send("cancel", 0f, 0); }

            @Override
            public void handleOnBackPressed() {
                send("end", 1f, 0);
                setEnabled(false);
                getOnBackPressedDispatcher().onBackPressed();
                setEnabled(true);
            }
        };
        getOnBackPressedDispatcher().addCallback(this, cb);
    }

    private void send(String phase, float progress, int edge) {
        if (getBridge() == null || getBridge().getWebView() == null) return;
        String js = "window.fosBack&&window.fosBack('" + phase + "'," + progress + "," + edge + ")";
        getBridge().getWebView().post(() -> getBridge().getWebView().evaluateJavascript(js, null));
    }
}
