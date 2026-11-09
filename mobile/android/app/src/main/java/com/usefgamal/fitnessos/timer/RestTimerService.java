package com.usefgamal.fitnessos.timer;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.graphics.Color;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.ServiceCompat;

import com.usefgamal.fitnessos.MainActivity;
import com.usefgamal.fitnessos.R;

/**
 * The rest timer in the notification shade: an ongoing notification with the
 * workout's name, the next exercise, a countdown (Android draws it, so it
 * keeps going with the app closed), a progress bar, and Pause/Resume, +15s and
 * Skip buttons. On Android 16 it also asks to be a Live Update, so the
 * countdown shows as a chip in the status bar.
 *
 * When the time is up it posts a "Rest done" notification that buzzes and
 * plays the notification sound (or stays silent when sounds are off in the
 * app's settings), then stops. Running as a foreground service keeps the
 * process alive for the few minutes of a rest, and a partial wakelock held for
 * the length of the rest keeps the CPU awake, so the Handler's delayed "done"
 * fires on time with the screen locked (TL-02). The lock goes on Pause, Skip,
 * Stop, at the end, or by its timeout.
 *
 * The rest is also saved to SharedPreferences, so when a phone (Xiaomi,
 * Infinix...) kills the app mid-rest, Android's sticky restart, or the app's
 * next open (RestTimerPlugin.state), picks it up again.
 */
public class RestTimerService extends Service {
    public static final String ACTION_START = "com.usefgamal.fitnessos.timer.START";
    public static final String ACTION_ADD = "com.usefgamal.fitnessos.timer.ADD";
    public static final String ACTION_PAUSE = "com.usefgamal.fitnessos.timer.PAUSE";
    public static final String ACTION_RESUME = "com.usefgamal.fitnessos.timer.RESUME";
    public static final String ACTION_STOP = "com.usefgamal.fitnessos.timer.STOP";
    /** From "Rest done": another 30 s of rest. */
    public static final String ACTION_MORE_REST = "com.usefgamal.fitnessos.timer.MORE_REST";
    public static final String EXTRA_ENDS_AT = "endsAt";
    public static final String EXTRA_PAUSED_LEFT = "pausedLeft";
    public static final String EXTRA_TOTAL = "total";
    public static final String EXTRA_LABEL = "label";
    public static final String EXTRA_WORKOUT = "workout";
    public static final String EXTRA_SETS = "sets";
    public static final String EXTRA_DETAIL = "detail";
    public static final String EXTRA_SECONDS = "seconds";
    public static final String EXTRA_SOUND = "sound";

    // v2: the first channel was "low" importance, which many phones (Xiaomi,
    // Infinix) fold away as a silent notification with no status bar icon,
    // so the countdown looked missing. A channel's importance can't change
    // after it's made, hence the new id; the old one is deleted.
    static final String CHANNEL_RUNNING = "rest_timer_v2";
    static final String CHANNEL_RUNNING_OLD = "rest_timer";
    static final String CHANNEL_DONE = "rest_done";
    static final String CHANNEL_DONE_SILENT = "rest_done_silent";
    static final int ID_RUNNING = 9101;
    static final int ID_DONE = 9102;
    private static final String PREFS = "rest_timer";
    private static final long MAX_REST_MS = 60L * 60L * 1000L;

    /** Tells the app (RestTimerPlugin) when the shade buttons change the timer. */
    public interface Listener {
        /** pausedLeft is 0 while running. */
        void onChanged(long endsAt, long pausedLeft, String label);
        void onStopped(boolean finished);
    }

    static volatile Listener listener;
    /** When the rest ends; 0 when there is none. Kept (stale) while paused. */
    static volatile long endsAt = 0;
    /** Time left while paused, else 0. */
    static volatile long pausedLeft = 0;
    /** The whole rest, for the progress bar (0 = unknown). */
    static volatile long totalMs = 0;
    static volatile String label = "";
    static volatile String workout = "";
    static volatile int sets = 0;
    /** The next set ("Set 3 of 4 · 60 kg × 8"); `workout` holds the workout so far. */
    static volatile String detail = "";
    /** The last rest was ended with Skip in the shade (the app reads it on return). */
    static volatile boolean skipped = false;
    static volatile boolean sound = true;
    /** The app is on screen: play the "rest done" chime directly instead of relying on the notification sound. */
    static volatile boolean foreground = false;

    static boolean active() {
        return endsAt > 0 || pausedLeft > 0;
    }

    // The shade texts in the app's language, sent from JS with each start
    // (P14-12: native text goes through i18n). English until the first start.
    private static final java.util.Map<String, String> TEXTS = new java.util.concurrent.ConcurrentHashMap<>();

    public static void setTexts(org.json.JSONObject texts) {
        if (texts == null) return;
        java.util.Iterator<String> keys = texts.keys();
        while (keys.hasNext()) {
            String k = keys.next();
            String v = texts.optString(k, null);
            if (v != null && !v.isEmpty()) TEXTS.put(k, v);
        }
    }

    static String tx(String key, String fallback) {
        String v = TEXTS.get(key);
        return v != null ? v : fallback;
    }

    private static final String DONE_NOTES = "[[660,0,0.35],[990,0.18,0.5]]";

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable finish = this::finish;
    /** Moves the progress bar once a second while the rest runs. */
    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            if (endsAt <= 0 || pausedLeft > 0) return;
            show(false);
        }
    };
    private PowerManager.WakeLock wakeLock;
    /** Slack on the wakelock's own timeout: it outlives the rest by a little, never by much. */
    private static final long WAKE_SLACK_MS = 10_000L;

    public static void start(Context context, long endsAt, long pausedLeft, long totalMs, String label, String workout, String detail, int sets, boolean sound) {
        Intent i = new Intent(context, RestTimerService.class).setAction(ACTION_START)
            .putExtra(EXTRA_ENDS_AT, endsAt).putExtra(EXTRA_PAUSED_LEFT, pausedLeft).putExtra(EXTRA_TOTAL, totalMs)
            .putExtra(EXTRA_LABEL, label).putExtra(EXTRA_WORKOUT, workout).putExtra(EXTRA_DETAIL, detail).putExtra(EXTRA_SETS, sets)
            .putExtra(EXTRA_SOUND, sound);
        androidx.core.content.ContextCompat.startForegroundService(context, i);
    }

    /** Put the saved rest back in the shade (after the process was killed). */
    static void startSaved(Context context) {
        start(context, endsAt, pausedLeft, totalMs, label, workout, detail, sets, sound);
    }

    public static void send(Context context, String action) {
        if (!active()) return;
        context.startService(new Intent(context, RestTimerService.class).setAction(action));
    }

    public static void stop(Context context) {
        send(context, ACTION_STOP);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        long now = System.currentTimeMillis();
        if (ACTION_START.equals(action)) {
            endsAt = intent.getLongExtra(EXTRA_ENDS_AT, 0);
            pausedLeft = Math.max(0, Math.min(intent.getLongExtra(EXTRA_PAUSED_LEFT, 0), MAX_REST_MS));
            totalMs = Math.max(0, Math.min(intent.getLongExtra(EXTRA_TOTAL, 0), MAX_REST_MS));
            label = orEmpty(intent.getStringExtra(EXTRA_LABEL));
            workout = orEmpty(intent.getStringExtra(EXTRA_WORKOUT));
            detail = orEmpty(intent.getStringExtra(EXTRA_DETAIL));
            sets = intent.getIntExtra(EXTRA_SETS, 0);
            sound = intent.getBooleanExtra(EXTRA_SOUND, true);
            skipped = false;
            nm().cancel(ID_DONE);
            save(this);
            show(true);
        } else if (ACTION_ADD.equals(action) && active()) {
            long add = intent.getIntExtra(EXTRA_SECONDS, 15) * 1000L;
            if (pausedLeft > 0) {
                pausedLeft = Math.min(pausedLeft + add, MAX_REST_MS);
            } else {
                endsAt = Math.min(Math.max(now, endsAt) + add, now + MAX_REST_MS);
            }
            if (pausedLeft > 0 && pausedLeft < 1000L) pausedLeft = 1000L;
            if (totalMs > 0) totalMs += add; // the bar keeps its place
            save(this);
            show(false);
            changed();
        } else if (ACTION_PAUSE.equals(action) && endsAt > 0 && pausedLeft == 0) {
            pausedLeft = Math.max(1000L, endsAt - now);
            save(this);
            show(false);
            changed();
        } else if (ACTION_RESUME.equals(action) && pausedLeft > 0) {
            endsAt = now + pausedLeft;
            pausedLeft = 0;
            save(this);
            show(false);
            changed();
        } else if (ACTION_MORE_REST.equals(action)) {
            // "+30s rest" on the Rest done notification: a short new rest.
            endsAt = now + 30_000L;
            pausedLeft = 0;
            totalMs = 30_000L;
            skipped = false;
            nm().cancel(ID_DONE);
            save(this);
            show(true);
            changed();
        } else if (ACTION_STOP.equals(action)) {
            boolean fromShade = intent.getBooleanExtra("fromShade", false);
            if (fromShade) skipped = true;
            end();
            Listener ls = listener;
            if (fromShade && ls != null) ls.onStopped(false);
        } else if (action == null && restore(this) && (pausedLeft > 0 || endsAt > now)) {
            // The phone killed the app mid-rest and Android restarted the
            // service: carry on with the saved rest.
            show(true);
        } else if (!active()) {
            // Restarted by the system with no timer to show.
            end();
        }
        // Sticky: if the phone kills the process mid-rest, Android starts the
        // service again and the saved rest comes back (above).
        return START_STICKY;
    }

    private static String orEmpty(String s) {
        return s != null ? s : "";
    }

    private void changed() {
        Listener ls = listener;
        if (ls != null) ls.onChanged(endsAt, pausedLeft, label);
    }

    private static String clock(long ms) {
        long s = Math.max(0, (ms + 999) / 1000);
        return (s / 60) + ":" + (s % 60 < 10 ? "0" : "") + (s % 60);
    }

    private void show(boolean first) {
        ensureChannels();
        long now = System.currentTimeMillis();
        boolean paused = pausedLeft > 0;
        long left = paused ? pausedLeft : endsAt - now;
        if (left <= 0) {
            if (first) startForegroundWith(placeholder()); // a foreground start must post a notification
            finish();
            return;
        }
        String rest = paused ? tx("paused", "Paused") : tx("rest", "Rest");
        String title = label.isEmpty() ? rest : tx("next", "Next: {label}").replace("{label}", label);
        String sub = !detail.isEmpty() ? detail : (paused ? rest : tx("restTimer", "Rest timer"));
        long whole = Math.max(totalMs, left);
        int max = (int) Math.max(1, Math.min(Integer.MAX_VALUE, (whole + 999) / 1000));
        int leftS = (int) Math.max(0, Math.min(max, (left + 999) / 1000));

        // Our own dark layout: a big countdown, the next exercise and set, a
        // bar that drains, and -15s / Pause / +15s / Skip (Yusuf, 9 Nov: the
        // system look was too plain). The colour fills the card because the
        // notification belongs to a foreground service (setColorized).
        RemoteViews small = new RemoteViews(getPackageName(), R.layout.notif_timer);
        RemoteViews big = new RemoteViews(getPackageName(), R.layout.notif_timer_big);
        for (RemoteViews v : new RemoteViews[] {small, big}) {
            if (paused) {
                v.setViewVisibility(R.id.n_clock, View.GONE);
                v.setViewVisibility(R.id.n_clock_paused, View.VISIBLE);
                v.setTextViewText(R.id.n_clock_paused, clock(left));
            } else {
                v.setViewVisibility(R.id.n_clock, View.VISIBLE);
                v.setViewVisibility(R.id.n_clock_paused, View.GONE);
                v.setChronometer(R.id.n_clock, SystemClock.elapsedRealtime() + left, null, true);
                if (Build.VERSION.SDK_INT >= 24) v.setChronometerCountDown(R.id.n_clock, true);
            }
            v.setTextViewText(R.id.n_title, title);
            v.setTextViewText(R.id.n_detail, sub);
        }
        big.setProgressBar(R.id.n_bar, max, leftS, false);
        String prog = workout.isEmpty() ? "" : workout;
        big.setTextViewText(R.id.n_progress, prog);
        big.setViewVisibility(R.id.n_progress, prog.isEmpty() ? View.GONE : View.VISIBLE);
        big.setTextViewText(R.id.n_pause, paused ? tx("resume", "Resume") : tx("pause", "Pause"));
        big.setTextViewText(R.id.n_skip, tx("skip", "Skip"));
        big.setOnClickPendingIntent(R.id.n_less, self(ACTION_ADD, 4).putExtra(EXTRA_SECONDS, -15).let());
        big.setOnClickPendingIntent(R.id.n_pause, self(paused ? ACTION_RESUME : ACTION_PAUSE, 3).let());
        big.setOnClickPendingIntent(R.id.n_more, self(ACTION_ADD, 1).putExtra(EXTRA_SECONDS, 15).let());
        big.setOnClickPendingIntent(R.id.n_skip, self(ACTION_STOP, 2).putExtra("fromShade", true).let());

        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL_RUNNING)
            .setSmallIcon(R.drawable.ic_stat_bolt)
            .setColor(Color.parseColor("#1c1c1e"))
            .setColorized(true)
            .setStyle(new NotificationCompat.DecoratedCustomViewStyle())
            .setCustomContentView(small)
            .setCustomBigContentView(big)
            .setContentTitle(title)
            .setContentText(sub)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setShowWhen(false)
            .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .setContentIntent(openApp());
        Notification n = b.build();
        if (first) startForegroundWith(n);
        else nm().notify(ID_RUNNING, n);

        handler.removeCallbacks(finish);
        handler.removeCallbacks(tick);
        if (paused) {
            releaseAwake(); // nothing to wake for while paused
            return;
        }
        holdAwake(left + WAKE_SLACK_MS);
        handler.postDelayed(finish, left);
        handler.postDelayed(tick, Math.min(1000L, left));
    }

    private Notification placeholder() {
        return new NotificationCompat.Builder(this, CHANNEL_RUNNING)
            .setSmallIcon(R.drawable.ic_stat_bolt)
            .setContentTitle(tx("rest", "Rest"))
            .setSilent(true)
            .build();
    }

    private void startForegroundWith(Notification n) {
        int type = Build.VERSION.SDK_INT >= 34 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE : 0;
        ServiceCompat.startForeground(this, ID_RUNNING, n, type);
    }

    /** (Re)take the partial wakelock for `ms`. The timeout means it can never be left held. */
    private void holdAwake(long ms) {
        try {
            if (wakeLock == null) {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm == null) return;
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "fitnessos:rest");
                wakeLock.setReferenceCounted(false);
            }
            wakeLock.acquire(ms);
        } catch (RuntimeException ignored) {
            // No lock: the timer still runs, the buzz may just come late.
        }
    }

    private void releaseAwake() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        } catch (RuntimeException ignored) {
            // Already released by its timeout.
        }
    }

    private void finish() {
        boolean chime = sound && foreground;
        if (chime) {
            try {
                TonePlayer.play(this, new org.json.JSONArray(DONE_NOTES), 0.9, false);
            } catch (org.json.JSONException ignored) {
                // Fixed notes: can't happen.
            }
        }
        String doneTitle = label.isEmpty() ? tx("done", "Rest done") : label;
        String doneSub = !detail.isEmpty() ? detail : (label.isEmpty() ? tx("nextSet", "Time for your next set") : tx("done", "Rest done"));
        RemoteViews dSmall = new RemoteViews(getPackageName(), R.layout.notif_done);
        RemoteViews dBig = new RemoteViews(getPackageName(), R.layout.notif_done_big);
        for (RemoteViews v : new RemoteViews[] {dSmall, dBig}) {
            v.setTextViewText(R.id.d_go, tx("go", "GO"));
            v.setTextViewText(R.id.d_title, doneTitle);
            v.setTextViewText(R.id.d_detail, doneSub);
        }
        dBig.setTextViewText(R.id.d_progress, workout);
        dBig.setViewVisibility(R.id.d_progress, workout.isEmpty() ? View.GONE : View.VISIBLE);
        dBig.setTextViewText(R.id.d_more, tx("moreRest", "+30s rest"));
        dBig.setTextViewText(R.id.d_open, tx("openWorkout", "Open workout"));
        dBig.setOnClickPendingIntent(R.id.d_more, self(ACTION_MORE_REST, 5).let());
        dBig.setOnClickPendingIntent(R.id.d_open, openApp());
        Notification done = new NotificationCompat.Builder(this, sound && !chime ? CHANNEL_DONE : CHANNEL_DONE_SILENT)
            .setSmallIcon(R.drawable.ic_stat_bolt)
            .setColor(Color.parseColor("#30d158"))
            .setStyle(new NotificationCompat.DecoratedCustomViewStyle())
            .setCustomContentView(dSmall)
            .setCustomBigContentView(dBig)
            .setCustomHeadsUpContentView(dSmall)
            .setContentTitle(tx("done", "Rest done") + " · " + doneTitle)
            .setContentText(doneSub)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVibrate(new long[] {0, 300, 150, 300})
            .setAutoCancel(true)
            .setTimeoutAfter(5 * 60 * 1000L)
            .setContentIntent(openApp())
            .build();
        nm().notify(ID_DONE, done);
        end();
        Listener ls = listener;
        if (ls != null) ls.onStopped(true);
    }

    private void end() {
        handler.removeCallbacks(finish);
        handler.removeCallbacks(tick);
        releaseAwake();
        endsAt = 0;
        pausedLeft = 0;
        save(this);
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        nm().cancel(ID_RUNNING);
        stopSelf();
    }

    /** Keep the rest on disk, so it survives the process being killed (endsAt 0 = none). */
    static void save(Context c) {
        try {
            c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putLong(EXTRA_ENDS_AT, endsAt).putLong(EXTRA_PAUSED_LEFT, pausedLeft).putLong(EXTRA_TOTAL, totalMs)
                .putString(EXTRA_LABEL, label).putString(EXTRA_WORKOUT, workout).putString(EXTRA_DETAIL, detail).putInt(EXTRA_SETS, sets)
                .putBoolean(EXTRA_SOUND, sound).apply();
        } catch (RuntimeException ignored) {
            // No storage: the rest just isn't kept.
        }
    }

    /** Load the saved rest when nothing is in memory (a new process). True if one is on. */
    static boolean restore(Context c) {
        if (active()) return true;
        try {
            SharedPreferences p = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            long now = System.currentTimeMillis();
            long savedEnds = p.getLong(EXTRA_ENDS_AT, 0);
            long savedPaused = p.getLong(EXTRA_PAUSED_LEFT, 0);
            if (savedPaused <= 0 && savedEnds <= now) return false;
            if (savedEnds > now + MAX_REST_MS) return false;
            endsAt = savedEnds;
            pausedLeft = Math.min(Math.max(0, savedPaused), MAX_REST_MS);
            totalMs = Math.min(Math.max(0, p.getLong(EXTRA_TOTAL, 0)), MAX_REST_MS);
            label = orEmpty(p.getString(EXTRA_LABEL, ""));
            workout = orEmpty(p.getString(EXTRA_WORKOUT, ""));
            detail = orEmpty(p.getString(EXTRA_DETAIL, ""));
            sets = p.getInt(EXTRA_SETS, 0);
            sound = p.getBoolean(EXTRA_SOUND, true);
            return true;
        } catch (RuntimeException e) {
            return false;
        }
    }

    /** Can the countdown show? False when the app's notifications or the rest timer channel are off. */
    static boolean canShow(Context c) {
        if (!NotificationManagerCompat.from(c).areNotificationsEnabled()) return false;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = (NotificationManager) c.getSystemService(NOTIFICATION_SERVICE);
            NotificationChannel ch = nm != null ? nm.getNotificationChannel(CHANNEL_RUNNING) : null;
            if (ch != null && ch.getImportance() == NotificationManager.IMPORTANCE_NONE) return false;
        }
        return true;
    }

    private void ensureChannels() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager m = nm();
        if (m.getNotificationChannel(CHANNEL_RUNNING_OLD) != null) m.deleteNotificationChannel(CHANNEL_RUNNING_OLD);
        if (m.getNotificationChannel(CHANNEL_RUNNING) == null) {
            // Default importance so it sits with the other notifications and
            // shows its icon in the status bar, but with no sound or buzz:
            // the countdown itself is silent, only "Rest done" alerts.
            NotificationChannel c = new NotificationChannel(CHANNEL_RUNNING, tx("restTimer", "Rest timer"), NotificationManager.IMPORTANCE_DEFAULT);
            c.setDescription("The countdown between sets");
            c.setShowBadge(false);
            c.setSound(null, null);
            c.enableVibration(false);
            c.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            m.createNotificationChannel(c);
        }
        if (m.getNotificationChannel(CHANNEL_DONE) == null) {
            NotificationChannel c = new NotificationChannel(CHANNEL_DONE, tx("done", "Rest done"), NotificationManager.IMPORTANCE_HIGH);
            c.setDescription("Buzzes when a rest is over");
            c.enableVibration(true);
            c.setVibrationPattern(new long[] {0, 300, 150, 300});
            m.createNotificationChannel(c);
        }
        if (m.getNotificationChannel(CHANNEL_DONE_SILENT) == null) {
            NotificationChannel c = new NotificationChannel(CHANNEL_DONE_SILENT, "Rest done (no sound)", NotificationManager.IMPORTANCE_HIGH);
            c.setDescription("Buzzes when a rest is over, used when sounds are off in the app");
            c.enableVibration(true);
            c.setVibrationPattern(new long[] {0, 300, 150, 300});
            c.setSound(null, null);
            m.createNotificationChannel(c);
        }
    }

    private PendingIntentBuilder self(String action, int code) {
        return new PendingIntentBuilder(new Intent(this, RestTimerService.class).setAction(action), code);
    }

    /** Tiny helper so extras can be chained before the PendingIntent is made. */
    private class PendingIntentBuilder {
        private final Intent intent;
        private final int code;

        PendingIntentBuilder(Intent intent, int code) {
            this.intent = intent;
            this.code = code;
        }

        PendingIntentBuilder putExtra(String k, int v) {
            intent.putExtra(k, v);
            return this;
        }

        PendingIntentBuilder putExtra(String k, boolean v) {
            intent.putExtra(k, v);
            return this;
        }

        PendingIntent let() {
            return PendingIntent.getService(RestTimerService.this, code, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        }
    }

    private PendingIntent openApp() {
        // Straight to the workout (the app's fitnessos://open/<route> link).
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("fitnessos://open/workout"), this, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(this, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private NotificationManager nm() {
        return (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(finish);
        handler.removeCallbacks(tick);
        releaseAwake();
        super.onDestroy();
    }
}
