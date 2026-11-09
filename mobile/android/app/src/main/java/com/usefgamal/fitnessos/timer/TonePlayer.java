package com.usefgamal.fitnessos.timer;

import android.app.NotificationManager;
import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioDeviceInfo;
import android.media.AudioFocusRequest;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioTrack;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONException;

import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Plays the app's short sounds natively, synthesised as PCM (no sound files).
 * The WebView's Web Audio needs a tap to start and stops after the app has
 * been in the background, so on the phone every app sound comes from here.
 *
 * SA-01 (sound engine):
 * - Fast: one audio thread, and each sound is rendered once and kept as a
 *   ready AudioTrack, so a repeat (a set tick, a countdown beep) starts in a
 *   few ms instead of building a thread, the samples and a track each time.
 * - Polite: when the phone is on silent or vibrate, or Do Not Disturb is on,
 *   a sound plays only into connected headphones; otherwise it is skipped and
 *   the caller vibrates instead. Long cues (300 ms or more) duck music for
 *   their length; short ticks leave it alone so music doesn't pump.
 * Uses the media stream: the phone's media volume controls it.
 */
public final class TonePlayer {
    private static final int RATE = 44100;
    private static final int CACHE = 16;
    private static final double DUCK_FROM_SEC = 0.3;

    private static final ScheduledExecutorService AUDIO = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "tone");
        t.setPriority(Thread.MAX_PRIORITY);
        return t;
    });

    /** Ready tracks by sound, least recently used first. Touched only on AUDIO. */
    private static final LinkedHashMap<String, Ready> TRACKS = new LinkedHashMap<>(CACHE, 0.75f, true);

    private static final class Ready {
        final AudioTrack track;
        final double seconds;

        Ready(AudioTrack track, double seconds) {
            this.track = track;
            this.seconds = seconds;
        }
    }

    private TonePlayer() {}

    /**
     * notes: [[freqHz, startSec, lengthSec], ...]; volume 0..1; soft = sine, else a brighter triangle.
     * Returns false when the phone is silenced and nothing will play, so the caller can vibrate.
     */
    public static boolean play(Context ctx, JSONArray notes, double volume, boolean soft) {
        Context app = ctx.getApplicationContext();
        if (!allowed(app)) return false;
        String key = notes.toString() + '|' + Math.round(volume * 100) + '|' + soft;
        AUDIO.execute(() -> {
            try {
                Ready ready = TRACKS.get(key);
                if (ready == null) {
                    ready = build(notes, volume, soft);
                    TRACKS.put(key, ready);
                    trim();
                }
                start(app, ready);
            } catch (Exception ignored) {
                // No audio device, or a bad note list: stay silent.
            }
        });
        return true;
    }

    /** Is sound welcome right now? Silent, vibrate or Do Not Disturb: only into headphones. */
    public static boolean allowed(Context ctx) {
        AudioManager am = (AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE);
        if (am == null) return true;
        boolean quiet = am.getRingerMode() != AudioManager.RINGER_MODE_NORMAL;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null && nm.getCurrentInterruptionFilter() > NotificationManager.INTERRUPTION_FILTER_ALL) quiet = true;
        return !quiet || headphones(am);
    }

    private static boolean headphones(AudioManager am) {
        for (AudioDeviceInfo d : am.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) {
            int t = d.getType();
            if (t == AudioDeviceInfo.TYPE_WIRED_HEADPHONES || t == AudioDeviceInfo.TYPE_WIRED_HEADSET
                || t == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP || t == AudioDeviceInfo.TYPE_USB_HEADSET) return true;
            if (Build.VERSION.SDK_INT >= 31 && (t == AudioDeviceInfo.TYPE_BLE_HEADSET || t == AudioDeviceInfo.TYPE_BLE_SPEAKER)) return true;
        }
        return false;
    }

    private static void start(Context ctx, Ready ready) {
        AudioTrack track = ready.track;
        if (track.getPlayState() == AudioTrack.PLAYSTATE_PLAYING) track.stop();
        track.reloadStaticData();
        if (ready.seconds >= DUCK_FROM_SEC) duck(ctx, ready.seconds);
        track.play();
    }

    /** Lower other apps' music for the length of a long cue. */
    private static void duck(Context ctx, double seconds) {
        AudioManager am = (AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE);
        if (am == null) return;
        AudioFocusRequest req = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
            .setAudioAttributes(attributes())
            .build();
        if (am.requestAudioFocus(req) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
            AUDIO.schedule(() -> am.abandonAudioFocusRequest(req), (long) (seconds * 1000) + 100, TimeUnit.MILLISECONDS);
        }
    }

    private static AudioAttributes attributes() {
        return new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_MEDIA)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
    }

    private static void trim() {
        Iterator<Map.Entry<String, Ready>> it = TRACKS.entrySet().iterator();
        while (TRACKS.size() > CACHE && it.hasNext()) {
            it.next().getValue().track.release();
            it.remove();
        }
    }

    /** Free every ready track (the app is going away). */
    public static void releaseAll() {
        AUDIO.execute(() -> {
            for (Ready r : TRACKS.values()) r.track.release();
            TRACKS.clear();
        });
    }

    private static Ready build(JSONArray notes, double volume, boolean soft) throws JSONException {
        double end = 0;
        for (int i = 0; i < notes.length(); i++) {
            JSONArray n = notes.getJSONArray(i);
            end = Math.max(end, n.getDouble(1) + n.getDouble(2));
        }
        int total = (int) ((end + 0.05) * RATE);
        float[] mix = new float[total];
        double peak = Math.max(0, Math.min(1, volume)) * (soft ? 0.5 : 0.7);
        for (int i = 0; i < notes.length(); i++) {
            JSONArray n = notes.getJSONArray(i);
            double f = soft ? n.getDouble(0) * 0.75 : n.getDouble(0);
            int start = (int) (n.getDouble(1) * RATE);
            int len = (int) (n.getDouble(2) * RATE);
            int attack = Math.max(1, RATE / 100); // 10 ms
            for (int s = 0; s < len && start + s < total; s++) {
                double t = (double) s / RATE;
                double phase = (f * t) % 1.0;
                double wave = soft ? Math.sin(2 * Math.PI * phase) : 1 - 4 * Math.abs(phase - 0.5);
                double env = s < attack ? (double) s / attack : Math.exp(-6.0 * (s - attack) / Math.max(1, len - attack));
                mix[start + s] += (float) (wave * env * peak);
            }
        }
        short[] pcm = new short[total];
        for (int i = 0; i < total; i++) {
            float v = Math.max(-1f, Math.min(1f, mix[i]));
            pcm[i] = (short) (v * Short.MAX_VALUE);
        }
        AudioTrack track = new AudioTrack.Builder()
            .setAudioAttributes(attributes())
            .setAudioFormat(new AudioFormat.Builder()
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setSampleRate(RATE)
                .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                .build())
            .setTransferMode(AudioTrack.MODE_STATIC)
            .setBufferSizeInBytes(pcm.length * 2)
            .build();
        track.write(pcm, 0, pcm.length);
        return new Ready(track, end);
    }
}
