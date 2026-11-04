package com.usefgamal.fitnessos.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.text.style.StyleSpan;
import android.view.View;
import android.widget.RemoteViews;

import com.usefgamal.fitnessos.MainActivity;
import com.usefgamal.fitnessos.R;

import org.json.JSONArray;
import org.json.JSONObject;

import java.time.LocalDate;
import java.time.LocalTime;

/**
 * Home-screen widget. The app hands it the next week of entries (one per
 * date, worked out in JS by lib/widget.js) through WidgetPlugin, so the
 * widget shows the right day after midnight even if the app hasn't been
 * opened. The next meal is picked here by the clock (the widget redraws
 * every 30 minutes), the same way as nextMeal() in lib/widget.js.
 */
public class TodayWidget extends AppWidgetProvider {
    static final String PREFS = "fitness_os_widget";
    static final String KEY_DAYS = "days";

    private static final int[] WEEK = {
        R.id.widget_w0, R.id.widget_w1, R.id.widget_w2, R.id.widget_w3, R.id.widget_w4, R.id.widget_w5, R.id.widget_w6,
    };
    private static final int GREEN = Color.parseColor("#30D158");
    private static final int ORANGE = Color.parseColor("#FF9F0A");
    private static final int GREY = Color.parseColor("#636366");
    private static final int MUTED = Color.parseColor("#8E8E93");

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
        String route = "";
        if (day != null) {
            v.setTextViewText(R.id.widget_kicker, day.optString("kicker", "Today"));
            v.setTextViewText(R.id.widget_title, day.optString("title", "Fitness OS"));
            v.setTextViewText(R.id.widget_subtitle, day.optString("subtitle", ""));
            String streak = day.optString("streak", "");
            v.setTextViewText(R.id.widget_streak, streak.isEmpty() ? "" : "🔥 " + streak);
            String tonight = day.optString("tonight", "");
            v.setTextViewText(R.id.widget_tonight, tonight);
            v.setViewVisibility(R.id.widget_tonight, tonight.isEmpty() ? View.GONE : View.VISIBLE);
            meal(v, day.optJSONArray("meals"));
            v.setTextViewText(R.id.widget_stats, day.optString("stats", ""));
            week(v, day.optJSONArray("week"));
            route = day.optString("route", "workout");
        } else {
            v.setViewVisibility(R.id.widget_meal, View.GONE);
        }
        v.setOnClickPendingIntent(R.id.widget_root, open(context, "", 1));
        v.setOnClickPendingIntent(R.id.widget_top, open(context, route, 2));
        v.setOnClickPendingIntent(R.id.widget_meal, open(context, "meals", 3));
        return v;
    }

    /** The first meal not eaten whose time hasn't passed by more than an hour. */
    private static void meal(RemoteViews v, JSONArray meals) {
        if (meals == null || meals.length() == 0) {
            v.setViewVisibility(R.id.widget_meal, View.GONE);
            return;
        }
        v.setViewVisibility(R.id.widget_meal, View.VISIBLE);
        LocalTime now = LocalTime.now();
        int nowMin = now.getHour() * 60 + now.getMinute();
        int eaten = 0;
        JSONObject next = null;
        for (int i = 0; i < meals.length(); i++) {
            JSONObject m = meals.optJSONObject(i);
            if (m == null) continue;
            if (m.optBoolean("done")) {
                eaten++;
                continue;
            }
            if (next == null && minutes(m.optString("time")) + 60 >= nowMin) next = m;
        }
        if (next == null) {
            v.setTextViewText(R.id.widget_meal_title, "Meals done for today");
            v.setTextViewText(R.id.widget_meal_what, eaten + " of " + meals.length() + " logged");
            return;
        }
        v.setTextViewText(R.id.widget_meal_title, "Next meal · " + next.optString("time") + " " + next.optString("name"));
        v.setTextViewText(R.id.widget_meal_what, next.optString("what"));
    }

    private static int minutes(String hhmm) {
        try {
            String[] p = hhmm.split(":");
            return Integer.parseInt(p[0]) * 60 + Integer.parseInt(p[1]);
        } catch (RuntimeException e) {
            return -1000; // no time: never "next"
        }
    }

    /** Weekday letter over a dot: green done, white planned, orange missed, grey rest. */
    private static void week(RemoteViews v, JSONArray week) {
        for (int i = 0; i < WEEK.length; i++) {
            JSONObject d = week == null ? null : week.optJSONObject(i);
            if (d == null) {
                v.setTextViewText(WEEK[i], "");
                continue;
            }
            String s = d.optString("s");
            boolean today = d.optBoolean("today");
            SpannableStringBuilder b = new SpannableStringBuilder();
            b.append(d.optString("d"));
            if (today) {
                b.setSpan(new StyleSpan(Typeface.BOLD), 0, b.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
                b.setSpan(new ForegroundColorSpan(Color.WHITE), 0, b.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            }
            b.append('\n');
            int from = b.length();
            int color;
            switch (s) {
                case "done": b.append("●"); color = GREEN; break;
                case "missed": b.append("○"); color = ORANGE; break;
                case "rest": b.append("·"); color = GREY; break;
                default: b.append("○"); color = today ? Color.WHITE : MUTED; break;
            }
            b.setSpan(new ForegroundColorSpan(color), from, b.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
            v.setTextViewText(WEEK[i], b);
        }
    }

    /** Opens the app on a screen: fitnessos://open/<route>, read by openDeepLink() in store/phoneSync.js. */
    private static PendingIntent open(Context context, String route, int code) {
        Intent i = new Intent(context, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        if (!route.isEmpty()) {
            i.setAction(Intent.ACTION_VIEW);
            i.setData(Uri.parse("fitnessos://open/" + route));
        }
        return PendingIntent.getActivity(context, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
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
