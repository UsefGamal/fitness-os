package com.usefgamal.fitnessos.timer;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** JS bridge for RestTimerService: start/stop from the app, events back when the shade buttons are used. */
@CapacitorPlugin(name = "RestTimer")
public class RestTimerPlugin extends Plugin {
    private static final long MAX_REST_MS = 60L * 60L * 1000L;

    @Override
    public void load() {
        RestTimerService.foreground = true;
        RestTimerService.listener = new RestTimerService.Listener() {
            @Override
            public void onChanged(long endsAt, long pausedLeft, String label) {
                JSObject o = new JSObject();
                o.put("endsAt", endsAt);
                o.put("pausedLeft", pausedLeft);
                o.put("label", label);
                notifyListeners("changed", o, true);
            }

            @Override
            public void onStopped(boolean finished) {
                JSObject o = new JSObject();
                o.put("finished", finished);
                notifyListeners("stopped", o, true);
            }
        };
    }

    @PluginMethod
    public void start(PluginCall call) {
        // Read numbers as Number: a time in ms (1.7e12) arrives as a Long, and
        // Capacitor's getDouble() returns null for a Long, which made every
        // start fail with "endsAt is required" (the shade never showed).
        Number endsAt = number(call, "endsAt");
        if (endsAt == null) {
            call.reject("endsAt is required");
            return;
        }
        // Never more than an hour from now (pentest AND-03), whatever JS sends.
        long now = System.currentTimeMillis();
        long ends = Math.max(now, Math.min(endsAt.longValue(), now + MAX_REST_MS));
        Number paused = number(call, "pausedLeft");
        Number total = number(call, "total"); // seconds
        long pausedMs = Math.max(0, Math.min(paused == null ? 0 : paused.longValue(), MAX_REST_MS));
        long totalMs = Math.max(0, Math.min(total == null ? 0 : (long) (total.doubleValue() * 1000), MAX_REST_MS));
        Number sets = number(call, "sets");
        RestTimerService.setTexts(call.getObject("texts"));
        RestTimerService.start(getContext(), ends, pausedMs, totalMs, call.getString("label", ""),
            call.getString("workout", ""), sets == null ? 0 : sets.intValue(), call.getBoolean("sound", true));
        call.resolve();
    }

    /** A number argument whatever JSON made of it (Integer, Long or Double), or null. */
    static Number number(PluginCall call, String name) {
        Object v = call.getData().opt(name);
        if (!(v instanceof Number)) return null;
        double d = ((Number) v).doubleValue();
        return Double.isNaN(d) || Double.isInfinite(d) ? null : (Number) v;
    }

    @PluginMethod
    public void stop(PluginCall call) {
        RestTimerService.stop(getContext());
        call.resolve();
    }

    /** Pause the shade countdown; it stays in the shade with Resume. */
    @PluginMethod
    public void pause(PluginCall call) {
        RestTimerService.send(getContext(), RestTimerService.ACTION_PAUSE);
        call.resolve();
    }

    /**
     * The shade timer: { endsAt (0 = none), pausedLeft (ms, 0 = running),
     * label, skipped (ended with Skip in the shade) }. If the phone killed the app mid-rest, the saved rest
     * is loaded and put back in the shade first.
     */
    @PluginMethod
    public void state(PluginCall call) {
        if (!RestTimerService.active() && RestTimerService.restore(getContext())) {
            RestTimerService.startSaved(getContext());
        }
        JSObject o = new JSObject();
        o.put("endsAt", RestTimerService.endsAt);
        o.put("pausedLeft", RestTimerService.pausedLeft);
        o.put("label", RestTimerService.label);
        o.put("skipped", RestTimerService.skipped);
        call.resolve(o);
    }

    /** { enabled }: false when the app's notifications or the rest timer channel are switched off. */
    @PluginMethod
    public void status(PluginCall call) {
        JSObject o = new JSObject();
        o.put("enabled", RestTimerService.canShow(getContext()));
        call.resolve(o);
    }

    /** Open Android's notification settings for the app (or the rest timer channel when only it is off). */
    @PluginMethod
    public void openSettings(PluginCall call) {
        android.content.Context c = getContext();
        android.content.Intent i;
        boolean appOn = androidx.core.app.NotificationManagerCompat.from(c).areNotificationsEnabled();
        if (android.os.Build.VERSION.SDK_INT >= 26 && appOn) {
            i = new android.content.Intent(android.provider.Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
                .putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, c.getPackageName())
                .putExtra(android.provider.Settings.EXTRA_CHANNEL_ID, RestTimerService.CHANNEL_RUNNING);
        } else if (android.os.Build.VERSION.SDK_INT >= 26) {
            i = new android.content.Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                .putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, c.getPackageName());
        } else {
            i = new android.content.Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                android.net.Uri.parse("package:" + c.getPackageName()));
        }
        try {
            i.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
            c.startActivity(i);
        } catch (Exception e) {
            try {
                c.startActivity(new android.content.Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    android.net.Uri.parse("package:" + c.getPackageName())).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK));
            } catch (Exception ignored) {
                // No settings screen: nothing to open.
            }
        }
        call.resolve();
    }

    /** A workout sound: { notes: [[hz, start s, length s]...], volume 0..1, soft }. */
    @PluginMethod
    public void tone(PluginCall call) {
        try {
            boolean played = TonePlayer.play(getContext(), call.getArray("notes"), call.getDouble("volume", 0.55), call.getBoolean("soft", false));
            JSObject out = new JSObject();
            out.put("played", played);
            call.resolve(out);
        } catch (Exception e) {
            call.reject("Could not play the sound", e);
        }
    }

    @Override
    protected void handleOnResume() {
        RestTimerService.foreground = true;
    }

    @Override
    protected void handleOnPause() {
        RestTimerService.foreground = false;
    }

    @Override
    protected void handleOnDestroy() {
        RestTimerService.foreground = false;
        RestTimerService.listener = null;
        TonePlayer.releaseAll();
    }
}
