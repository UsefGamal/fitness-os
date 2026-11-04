package com.usefgamal.fitnessos.timer;

import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;

import org.json.JSONArray;

/**
 * Plays the app's short beeps natively, synthesised as PCM (no sound files).
 * The WebView's Web Audio needs a tap to start and stops after the app has
 * been in the background, so on the phone every workout sound comes from here.
 * Uses the media stream: the phone's media volume controls it.
 */
public final class TonePlayer {
    private static final int RATE = 44100;

    private TonePlayer() {}

    /** notes: [[freqHz, startSec, lengthSec], ...]; volume 0..1; soft = sine, else a brighter triangle. */
    public static void play(JSONArray notes, double volume, boolean soft) {
        new Thread(() -> {
            try {
                render(notes, volume, soft);
            } catch (Exception ignored) {
                // No audio device: stay silent.
            }
        }, "tone").start();
    }

    private static void render(JSONArray notes, double volume, boolean soft) throws Exception {
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
            .setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build())
            .setAudioFormat(new AudioFormat.Builder()
                .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                .setSampleRate(RATE)
                .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                .build())
            .setTransferMode(AudioTrack.MODE_STATIC)
            .setBufferSizeInBytes(pcm.length * 2)
            .build();
        track.write(pcm, 0, pcm.length);
        track.play();
        Thread.sleep((long) ((end + 0.1) * 1000));
        track.stop();
        track.release();
    }
}
