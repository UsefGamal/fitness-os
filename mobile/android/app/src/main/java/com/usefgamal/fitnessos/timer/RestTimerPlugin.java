package com.usefgamal.fitnessos.timer;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** JS bridge for RestTimerService: start/stop from the app, events back when the shade buttons are used. */
@CapacitorPlugin(name = "RestTimer")
public class RestTimerPlugin extends Plugin {
    @Override
    public void load() {
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
        RestTimerService.start(getContext(), endsAt.longValue(), call.getString("label", ""));
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

    @Override
    protected void handleOnDestroy() {
        RestTimerService.listener = null;
    }
}
