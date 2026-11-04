package com.usefgamal.fitnessos.widget;

import android.content.Context;

import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Stores the widget's lines for the coming days and redraws it. */
@CapacitorPlugin(name = "Widget")
public class WidgetPlugin extends Plugin {
    @PluginMethod
    public void update(PluginCall call) {
        JSArray days = call.getArray("days");
        if (days == null) {
            call.reject("days is required");
            return;
        }
        getContext().getSharedPreferences(TodayWidget.PREFS, Context.MODE_PRIVATE)
            .edit().putString(TodayWidget.KEY_DAYS, days.toString()).apply();
        TodayWidget.refresh(getContext());
        call.resolve();
    }
}
