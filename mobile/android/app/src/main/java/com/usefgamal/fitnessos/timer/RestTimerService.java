package com.usefgamal.fitnessos.timer;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Color;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

import com.usefgamal.fitnessos.MainActivity;
import com.usefgamal.fitnessos.R;

/**
 * The rest timer in the notification shade: an ongoing notification that
 * counts down (Android draws the countdown itself, so nothing ticks here),
 * with +15s and Skip buttons. When the time is up it posts a "Rest done"
 * notification that buzzes and plays the notification sound (or stays
 * silent when sounds are off in the app's settings), then stops. Running as a foreground service
 * keeps the process alive for the few minutes of a rest, so the alert fires
 * on time with the screen off.
 */
public class RestTimerService extends Service {
    public static final String ACTION_START = "com.usefgamal.fitnessos.timer.START";
    public static final String ACTION_ADD = "com.usefgamal.fitnessos.timer.ADD";
    public static final String ACTION_STOP = "com.usefgamal.fitnessos.timer.STOP";
    public static final String EXTRA_ENDS_AT = "endsAt";
    public static final String EXTRA_LABEL = "label";
    public static final String EXTRA_SECONDS = "seconds";
    public static final String EXTRA_SOUND = "sound";

    static final String CHANNEL_RUNNING = "rest_timer";
    static final String CHANNEL_DONE = "rest_done";
    static final String CHANNEL_DONE_SILENT = "rest_done_silent";
    static final int ID_RUNNING = 9101;
    static final int ID_DONE = 9102;

    /** Tells the app (RestTimerPlugin) when the shade buttons change the timer. */
    public interface Listener {
        void onChanged(long endsAt, String label);
        void onStopped(boolean finished);
    }

    static volatile Listener listener;
    static volatile long endsAt = 0;
    static volatile String label = "";
    static volatile boolean sound = true;
    /** The app is on screen: play the "rest done" chime directly instead of relying on the notification sound. */
    static volatile boolean foreground = false;
    private static final String DONE_NOTES = "[[660,0,0.35],[990,0.18,0.5]]";

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable finish = this::finish;

    public static void start(Context context, long endsAt, String label, boolean sound) {
        Intent i = new Intent(context, RestTimerService.class).setAction(ACTION_START)
            .putExtra(EXTRA_ENDS_AT, endsAt).putExtra(EXTRA_LABEL, label).putExtra(EXTRA_SOUND, sound);
        androidx.core.content.ContextCompat.startForegroundService(context, i);
    }

    public static void stop(Context context) {
        if (endsAt == 0) return;
        context.startService(new Intent(context, RestTimerService.class).setAction(ACTION_STOP));
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : null;
        if (ACTION_START.equals(action)) {
            endsAt = intent.getLongExtra(EXTRA_ENDS_AT, 0);
            String l = intent.getStringExtra(EXTRA_LABEL);
            label = l != null ? l : "";
            sound = intent.getBooleanExtra(EXTRA_SOUND, true);
            nm().cancel(ID_DONE);
            show(true);
        } else if (ACTION_ADD.equals(action) && endsAt > 0) {
            endsAt = Math.max(System.currentTimeMillis(), endsAt) + intent.getIntExtra(EXTRA_SECONDS, 15) * 1000L;
            show(false);
            Listener ls = listener;
            if (ls != null) ls.onChanged(endsAt, label);
        } else if (ACTION_STOP.equals(action)) {
            boolean fromShade = intent.getBooleanExtra("fromShade", false);
            end(false);
            Listener ls = listener;
            if (fromShade && ls != null) ls.onStopped(false);
        } else {
            // Restarted by the system with no timer to show.
            end(false);
        }
        return START_NOT_STICKY;
    }

    private void show(boolean first) {
        ensureChannels();
        long left = endsAt - System.currentTimeMillis();
        if (left <= 0) {
            finish();
            return;
        }
        Notification n = new NotificationCompat.Builder(this, CHANNEL_RUNNING)
            .setSmallIcon(R.drawable.ic_stat_bolt)
            .setColor(Color.parseColor("#30d158"))
            .setContentTitle("Rest")
            .setContentText(label.isEmpty() ? "Rest timer" : "Then " + label)
            .setWhen(endsAt)
            .setShowWhen(true)
            .setUsesChronometer(true)
            .setChronometerCountDown(true)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(openApp())
            .addAction(0, "+15s", self(ACTION_ADD, 1).putExtra(EXTRA_SECONDS, 15).let())
            .addAction(0, "Skip", self(ACTION_STOP, 2).putExtra("fromShade", true).let())
            .build();
        if (first) {
            int type = Build.VERSION.SDK_INT >= 34 ? ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE : 0;
            ServiceCompat.startForeground(this, ID_RUNNING, n, type);
        } else {
            nm().notify(ID_RUNNING, n);
        }
        handler.removeCallbacks(finish);
        handler.postDelayed(finish, left);
    }

    private void finish() {
        boolean chime = sound && foreground;
        if (chime) {
            try {
                TonePlayer.play(new org.json.JSONArray(DONE_NOTES), 0.9, false);
            } catch (org.json.JSONException ignored) {
                // Fixed notes: can't happen.
            }
        }
        Notification done = new NotificationCompat.Builder(this, sound && !chime ? CHANNEL_DONE : CHANNEL_DONE_SILENT)
            .setSmallIcon(R.drawable.ic_stat_bolt)
            .setColor(Color.parseColor("#30d158"))
            .setContentTitle("Rest done")
            .setContentText(label.isEmpty() ? "Time for your next set" : "Next set: " + label)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVibrate(new long[] {0, 300, 150, 300})
            .setAutoCancel(true)
            .setTimeoutAfter(5 * 60 * 1000L)
            .setContentIntent(openApp())
            .build();
        nm().notify(ID_DONE, done);
        end(true);
        Listener ls = listener;
        if (ls != null) ls.onStopped(true);
    }

    private void end(boolean finished) {
        handler.removeCallbacks(finish);
        endsAt = 0;
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        nm().cancel(ID_RUNNING);
        stopSelf();
    }

    private void ensureChannels() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager m = nm();
        if (m.getNotificationChannel(CHANNEL_RUNNING) == null) {
            NotificationChannel c = new NotificationChannel(CHANNEL_RUNNING, "Rest timer", NotificationManager.IMPORTANCE_LOW);
            c.setDescription("The countdown between sets");
            c.setShowBadge(false);
            m.createNotificationChannel(c);
        }
        if (m.getNotificationChannel(CHANNEL_DONE) == null) {
            NotificationChannel c = new NotificationChannel(CHANNEL_DONE, "Rest done", NotificationManager.IMPORTANCE_HIGH);
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
        Intent i = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
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
        super.onDestroy();
    }
}
