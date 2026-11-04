package com.usefgamal.fitnessos.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import com.usefgamal.fitnessos.MainActivity;
import com.usefgamal.fitnessos.R;

import org.json.JSONArray;
import org.json.JSONObject;

import java.time.LocalDate;

/**
 * Home-screen widget. The app hands it the next week of lines (one per date,
 * worked out in JS by lib/widget.js) through WidgetPlugin, so the widget
 * shows the right day after midnight even if the app hasn't been opened.
 */
public class TodayWidget extends AppWidgetProvider {
    static final String PREFS = "fitness_os_widget";
    static final String KEY_DAYS = "days";

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) manager.updateAppWidget(id, views(context));
    }

    public static void refresh(Context context) {
        AppWidgetManager m = AppWidgetManager.getInstance(context);
        int[] ids = m.getAppWidgetIds(new ComponentName(context, TodayWidget.class));
        if (ids.length > 0) m.updateAppWidget(ids, views(context));
    }

    static RemoteViews views(Context context) {
        RemoteViews v = new RemoteViews(context.getPackageName(), R.layout.widget_today);
        JSONObject day = today(context);
        if (day != null) {
            v.setTextViewText(R.id.widget_kicker, day.optString("kicker", "Today"));
            v.setTextViewText(R.id.widget_title, day.optString("title", "Fitness OS"));
            v.setTextViewText(R.id.widget_subtitle, day.optString("subtitle", ""));
            v.setTextViewText(R.id.widget_footer, day.optString("footer", ""));
        }
        Intent open = new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        v.setOnClickPendingIntent(R.id.widget_root, PendingIntent.getActivity(context, 1, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        return v;
    }

    private static JSONObject today(Context context) {
        SharedPreferences p = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String raw = p.getString(KEY_DAYS, null);
        if (raw == null) return null;
        String date = LocalDate.now().toString();
        try {
            JSONArray days = new JSONArray(raw);
            for (int i = 0; i < days.length(); i++) {
                JSONObject d = days.getJSONObject(i);
                if (date.equals(d.optString("date"))) return d;
            }
        } catch (org.json.JSONException e) {
            return null; // a bad snapshot shows the default text until the app writes a new one
        }
        return null;
    }
}
