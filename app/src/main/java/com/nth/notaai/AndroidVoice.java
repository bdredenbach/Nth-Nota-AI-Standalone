package com.nth.notaai;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;

/** One device speaker for both read-aloud and live conversation. All state belongs to the UI thread. */
final class AndroidVoice {
    private final Context context;
    private final Handler main = new Handler(Looper.getMainLooper());
    private TextToSpeech engine;
    private boolean ready, closed;
    private long generation;
    private float rate;
    private String pendingText, prefix, lastId;
    private SpeechOutput.Listener listener;

    AndroidVoice(Context context) { this.context = context.getApplicationContext(); }

    void play(String text, float pace, SpeechOutput.Listener callback) {
        stop();
        if (closed || text.trim().isEmpty()) { callback.finished(false); return; }
        pendingText = text;
        rate = pace;
        listener = callback;
        if (engine == null) {
            try {
                engine = new TextToSpeech(context, status -> main.post(() -> initialized(status)));
            } catch (RuntimeException unavailable) { finish(false); }
        } else if (ready) enqueue();
    }

    private void initialized(int status) {
        if (closed) return;
        if (status != TextToSpeech.SUCCESS) {
            if (engine != null) engine.shutdown();
            engine = null;
            finish(false);
            return;
        }
        ready = true;
        engine.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String id) { main.post(() -> { if (current(id)) listener.started(); }); }
            @Override public void onRangeStart(String id, int start, int end, int frame) {
                main.post(() -> { if (current(id)) listener.word(); });
            }
            @Override public void onDone(String id) { main.post(() -> { if (current(id) && id.equals(lastId)) finish(true); }); }
            @Override public void onError(String id) { main.post(() -> { if (current(id)) finish(false); }); }
            @Override public void onStop(String id, boolean interrupted) { main.post(() -> { if (current(id)) finish(false); }); }
        });
        if (listener != null) enqueue();
    }

    private boolean current(String id) { return listener != null && prefix != null && id != null && id.startsWith(prefix); }

    private void enqueue() {
        engine.setSpeechRate(rate);
        String text = pendingText;
        pendingText = null;
        prefix = "nota-" + generation + "-";
        int at = 0;
        int maximum = Math.min(2800, TextToSpeech.getMaxSpeechInputLength());
        while (at < text.length()) {
            int end = Math.min(at + maximum, text.length());
            if (end < text.length()) {
                int space = text.lastIndexOf(' ', end);
                if (space > at + maximum / 2) end = space + 1;
                else if (Character.isHighSurrogate(text.charAt(end - 1))) end--;
            }
            lastId = prefix + at;
            if (engine.speak(text.substring(at, end), TextToSpeech.QUEUE_ADD, null, lastId) == TextToSpeech.ERROR) {
                finish(false);
                return;
            }
            at = end;
        }
    }

    private void finish(boolean success) {
        SpeechOutput.Listener callback = listener;
        stop();
        if (callback != null) callback.finished(success);
    }

    void stop() {
        generation++;
        pendingText = null;
        listener = null;
        prefix = null;
        if (engine != null && ready) engine.stop();
    }

    void close() {
        closed = true;
        stop();
        if (engine != null) engine.shutdown();
        engine = null;
    }
}
