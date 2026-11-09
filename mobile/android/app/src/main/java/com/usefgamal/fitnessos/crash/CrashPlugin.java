package com.usefgamal.fitnessos.crash;

import android.app.Activity;
import android.app.ActivityManager;
import android.app.ApplicationExitInfo;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.WebViewListener;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.List;

/**
 * Crashes leave a trace (P14-15). Native crashes, a dead WebView renderer
 * and Android's own exit reasons (native crash, ANR, killed for memory) are
 * kept here as short lines, and the app's bug report picks them up on the
 * next start. A renderer crash reopens the app instead of leaving a blank
 * screen. Only the error class, message and top of the stack are kept:
 * never any of the person's data.
 */
@CapacitorPlugin(name = "Crash")
public class CrashPlugin extends Plugin {
    private static final String PREFS = "fitness-os-crash";
    private static final String KEY = "lines";
    private static final String SEEN = "exit_seen";
    private static final int MAX = 10;
    private static boolean handlerSet = false;

    @Override
    public void load() {
        Context ctx = getContext().getApplicationContext();
        if (!handlerSet) {
            handlerSet = true;
            final Thread.UncaughtExceptionHandler next = Thread.getDefaultUncaughtExceptionHandler();
            Thread.setDefaultUncaughtExceptionHandler((thread, e) -> {
                try {
                    StringBuilder msg = new StringBuilder("Native crash: ").append(e.getClass().getName());
                    if (e.getMessage() != null) msg.append(": ").append(e.getMessage());
                    StackTraceElement[] st = e.getStackTrace();
                    for (int i = 0; i < Math.min(4, st.length); i++) msg.append("\n").append(st[i].toString());
                    add(ctx, msg.toString(), true);
                } catch (Throwable ignored) {
                    // Never make a crash worse.
                }
                if (next != null) next.uncaughtException(thread, e);
            });
        }
        bridge.addWebViewListener(new WebViewListener() {
            @Override
            public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                boolean crashed = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && detail != null && detail.didCrash();
                add(ctx, crashed ? "WebView renderer crashed; the app reopened" : "WebView renderer was stopped by Android (memory); the app reopened", true);
                reopen();
                return true;
            }
        });
    }

    // Pentest AND-06: a page that kills the renderer on every start must not
    // turn into an endless reopen loop. At most 3 reopens a minute.
    private static final int MAX_REOPENS = 3;
    private static final long REOPEN_WINDOW_MS = 60_000L;
    private static final long[] reopenedAt = new long[MAX_REOPENS];
    private static int reopenNext = 0;

    private static synchronized boolean mayReopen() {
        long now = System.currentTimeMillis();
        long oldest = reopenedAt[reopenNext];
        if (oldest != 0 && now - oldest < REOPEN_WINDOW_MS) return false;
        reopenedAt[reopenNext] = now;
        reopenNext = (reopenNext + 1) % MAX_REOPENS;
        return true;
    }

    private void reopen() {
        Activity activity = getActivity();
        if (activity == null) return;
        if (!mayReopen()) {
            activity.finish();
            return;
        }
        Intent intent = activity.getPackageManager().getLaunchIntentForPackage(activity.getPackageName());
        if (intent != null) {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            activity.startActivity(intent);
        }
        activity.finish();
    }

    private static synchronized void add(Context ctx, String line, boolean now) {
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        try {
            JSONArray list = new JSONArray(prefs.getString(KEY, "[]"));
            JSONObject entry = new JSONObject();
            entry.put("at", System.currentTimeMillis());
            entry.put("message", line.length() > 900 ? line.substring(0, 900) : line);
            list.put(entry);
            JSONArray kept = new JSONArray();
            for (int i = Math.max(0, list.length() - MAX); i < list.length(); i++) kept.put(list.get(i));
            SharedPreferences.Editor ed = prefs.edit().putString(KEY, kept.toString());
            // A crash may end the process at once, so write synchronously.
            if (now) ed.commit(); else ed.apply();
        } catch (Exception ignored) {
            // Nothing else to do.
        }
    }

    /** Android's own record of how the app last ended (Android 11+). */
    private void exitReasons(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return;
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        long seen = prefs.getLong(SEEN, 0);
        if (seen == 0) {
            // The first run only marks where to start, so old exits aren't reported.
            prefs.edit().putLong(SEEN, System.currentTimeMillis()).apply();
            return;
        }
        long newest = seen;
        ActivityManager am = (ActivityManager) ctx.getSystemService(Context.ACTIVITY_SERVICE);
        if (am == null) return;
        List<ApplicationExitInfo> infos = am.getHistoricalProcessExitReasons(null, 0, 5);
        for (ApplicationExitInfo info : infos) {
            if (info.getTimestamp() <= seen) continue;
            newest = Math.max(newest, info.getTimestamp());
            String what = null;
            switch (info.getReason()) {
                case ApplicationExitInfo.REASON_CRASH_NATIVE: what = "Native (C/C++) crash"; break;
                case ApplicationExitInfo.REASON_ANR: what = "App not responding (ANR)"; break;
                case ApplicationExitInfo.REASON_LOW_MEMORY: what = "Stopped by Android for low memory"; break;
                case ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE: what = "Stopped by Android for using too much battery or CPU"; break;
                default: break;
            }
            if (what == null) continue;
            String desc = info.getDescription();
            add(ctx, what + (desc != null && !desc.isEmpty() ? ": " + desc : ""), false);
        }
        prefs.edit().putLong(SEEN, newest).apply();
    }

    /** Return the saved lines and clear them: { crashes: [{ at, message }] }. */
    @PluginMethod
    public void take(PluginCall call) {
        Context ctx = getContext().getApplicationContext();
        try {
            exitReasons(ctx);
        } catch (Exception ignored) {
            // Older or unusual Android: skip the exit reasons.
        }
        SharedPreferences prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        JSArray out = new JSArray();
        try {
            JSONArray list = new JSONArray(prefs.getString(KEY, "[]"));
            for (int i = 0; i < list.length(); i++) out.put(list.get(i));
        } catch (Exception ignored) {
            // A broken list is dropped.
        }
        prefs.edit().remove(KEY).apply();
        JSObject res = new JSObject();
        res.put("crashes", out);
        call.resolve(res);
    }
}
