package com.usefgamal.fitnessos.widget;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Stores the widget's lines for the coming days and redraws it. Also tells
 * the first-week card (FIRST-1) whether a widget is on the home screen and
 * asks the launcher to pin one where it can. */
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

    /** { count, canPin }: widgets placed now, and whether the launcher
     * takes a pin request (many Samsung ones do; some HyperOS/XOS don't). */
    @PluginMethod
    public void status(PluginCall call) {
        AppWidgetManager m = AppWidgetManager.getInstance(getContext());
        JSObject out = new JSObject();
        out.put("count", m.getAppWidgetIds(new ComponentName(getContext(), TodayWidget.class)).length);
        out.put("canPin", m.isRequestPinAppWidgetSupported());
        call.resolve(out);
    }

    /** Asks the launcher to show its "add widget" prompt. { asked } is false
     * when the launcher doesn't support it; the card then shows the steps. */
    @PluginMethod
    public void pin(PluginCall call) {
        AppWidgetManager m = AppWidgetManager.getInstance(getContext());
        boolean asked = m.isRequestPinAppWidgetSupported()
            && m.requestPinAppWidget(new ComponentName(getContext(), TodayWidget.class), null, null);
        JSObject out = new JSObject();
        out.put("asked", asked);
        call.resolve(out);
    }
}
