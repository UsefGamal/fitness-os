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
            public void onChanged(long endsAt, String label) {
                JSObject o = new JSObject();
                o.put("endsAt", endsAt);
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
        Double endsAt = call.getDouble("endsAt");
        if (endsAt == null) {
            call.reject("endsAt is required");
            return;
        }
        // Never more than an hour from now (pentest AND-03), whatever JS sends.
        long now = System.currentTimeMillis();
        long ends = Math.max(now, Math.min(endsAt.longValue(), now + MAX_REST_MS));
        RestTimerService.setTexts(call.getObject("texts"));
        RestTimerService.start(getContext(), ends, call.getString("label", ""), call.getBoolean("sound", true));
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        RestTimerService.stop(getContext());
        call.resolve();
    }

    @PluginMethod
    public void state(PluginCall call) {
        JSObject o = new JSObject();
        o.put("endsAt", RestTimerService.endsAt);
        o.put("label", RestTimerService.label);
        call.resolve(o);
    }

    /** A workout sound: { notes: [[hz, start s, length s]...], volume 0..1, soft }. */
    @PluginMethod
    public void tone(PluginCall call) {
        try {
            TonePlayer.play(call.getArray("notes"), call.getDouble("volume", 0.55), call.getBoolean("soft", false));
            call.resolve();
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
    }
}
