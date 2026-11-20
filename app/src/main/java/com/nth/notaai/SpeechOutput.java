package com.nth.notaai;

import android.content.Context;

/** Shared playback for both live views, read-aloud, and the Settings audition. */
final class SpeechOutput {
    interface Listener {
        void finished(boolean success);
        default void started() {}
        default void word() {}
    }

    static final int DEFAULT_PACE = 90;
    private final HeartVoice heart;
    private final AndroidVoice android;
    private boolean systemVoice;
    private int pace;

    SpeechOutput(Context context) {
        heart = new HeartVoice(context.getApplicationContext());
        android = new AndroidVoice(context);
        pace = DEFAULT_PACE;
    }

    void configure(boolean system, int percent) {
        if (percent < 75 || percent > 110) percent = DEFAULT_PACE;
        if (systemVoice == system && pace == percent) return;
        stop();
        systemVoice = system;
        pace = percent;
    }

    void play(String text, Listener listener) {
        stop();
        if (systemVoice) android.play(text, pace / 100f, listener);
        else heart.play(text, pace / 100f, listener);
    }

    void stop() { heart.stop(); android.stop(); }
    void close() { heart.close(); android.close(); }
}
