package com.nth.notaai;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;

import java.util.ArrayList;
import java.util.Locale;

/** Foreground-only speech capture, with one listener identity for each microphone turn. */
final class LiveVoice {
    static final int PERMISSION = 408;
    interface Host {
        void event(String session, String type, String token, String value);
        void ended(String session);
    }
    private final Activity activity;
    private final Host host;
    private final SpeechOutput output;
    private final AudioManager audio;
    private final Handler main = new Handler(Looper.getMainLooper());
    private AudioFocusRequest focus;
    private SpeechRecognizer recognizer;
    private Runnable watchdog;
    private String session = "", capture = "", recognized = "", speech = "";
    private String permissionOwner = "";
    private boolean foreground, pendingSetup, onDevice;
    private long lastLevel, lastWord;

    LiveVoice(Activity activity, Host host, SpeechOutput output) {
        this.activity = activity;
        this.host = host;
        this.output = output;
        audio = (AudioManager)activity.getSystemService(Context.AUDIO_SERVICE);
    }

    void begin(String id) {
        if (id.isEmpty()) return;
        end("", "");
        if (!foreground || !permissionOwner.isEmpty()) {
            host.event(id, "ended", "", "Return to Chat and finish any microphone permission prompt to start voice.");
            return;
        }
        session = id;
        output.stop();
        if (!microphoneAllowed()) {
            permissionOwner = id;
            activity.requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, PERMISSION);
        } else configure();
    }

    private boolean microphoneAllowed() {
        return activity.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
    }
    void permissionResult() {
        String owner = permissionOwner;
        permissionOwner = "";
        if (!matches(owner)) return;
        if (!microphoneAllowed()) {
            String message = activity.shouldShowRequestPermissionRationale(Manifest.permission.RECORD_AUDIO)
                ? "Microphone access is needed for live voice. You can still type here."
                : "To use live voice, enable Microphone in Android Settings → Apps → Nth Nota AI → Permissions.";
            end(owner, message);
        } else if (foreground) configure();
        else pendingSetup = true;
    }

    private void configure() {
        pendingSetup = false;
        onDevice = Build.VERSION.SDK_INT >= 31 && SpeechRecognizer.isOnDeviceRecognitionAvailable(activity);
        if (!onDevice && !SpeechRecognizer.isRecognitionAvailable(activity)) {
            end(session, "No Android speech recognition service is available. Enable a speech service or type your message.");
            return;
        }
        final String owner = session;
        AudioAttributes attrs = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANT)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build();
        focus = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
            .setAudioAttributes(attrs).setOnAudioFocusChangeListener(change -> {
                if (change < 0 && matches(owner)) end(owner, "Live voice ended because another app needs audio.");
            }, main).build();
        if (audio == null || audio.requestAudioFocus(focus) != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
            end(owner, "Audio is busy. Try live voice again when it’s available."); return;
        }
        host.event(owner, "ready", "", "");
    }

    void resumed() {
        foreground = true;
        if (pendingSetup && !session.isEmpty()) configure();
    }
    void paused() {
        foreground = false;
        if (permissionOwner.isEmpty()) end("", "Live voice ended when you left the app.");
    }
    void stopped() { end("", "Live voice ended when you left the app."); }
    private boolean matches(String id) { return !session.isEmpty() && session.equals(id); }
    private boolean usable(String id) { return matches(id) && foreground && microphoneAllowed(); }

    void listen(String id, String token) {
        if (!matches(id)) return;
        if (!usable(id)) { end(id, "Live voice needs microphone access and an open chat."); return; }
        cancelCapture();
        speech = "";
        output.stop();
        capture = token;
        try {
            if (onDevice && Build.VERSION.SDK_INT >= 31) recognizer = SpeechRecognizer.createOnDeviceSpeechRecognizer(activity);
            else recognizer = SpeechRecognizer.createSpeechRecognizer(activity);
            recognizer.setRecognitionListener(new Listener(id, token));
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                .putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault().toLanguageTag())
                .putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                .putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
            recognizer.startListening(intent);
            arm(id, token, 15000);
        } catch (RuntimeException failure) { end(id, "Android couldn’t start the microphone. Check your speech service and microphone permission."); }
    }

    private void arm(String id, String token, long delay) {
        disarm();
        watchdog = () -> {
            if (matches(id) && capture.equals(token)) {
                cancelCapture();
                host.event(id, "idle", token, "Listening timed out. Tap Resume to try again.");
            }
        };
        main.postDelayed(watchdog, delay);
    }
    private void disarm() { if (watchdog != null) main.removeCallbacks(watchdog); watchdog = null; }

    private final class Listener implements RecognitionListener {
        final String id, token;
        Listener(String id, String token) { this.id = id; this.token = token; }
        boolean current() { return usable(id) && capture.equals(token); }
        @Override public void onReadyForSpeech(Bundle params) {
            if (current()) { host.event(id,"listening",token,""); arm(id,token,25000); }
        }
        @Override public void onBeginningOfSpeech() { if (current()) arm(id,token,90000); }
        @Override public void onEndOfSpeech() {
            if (current()) { host.event(id,"finishing",token,""); arm(id,token,12000); }
        }
        @Override public void onRmsChanged(float rms) {
            long now = SystemClock.elapsedRealtime();
            if (current() && now - lastLevel >= 120) {
                lastLevel = now;
                host.event(id, "level", token, String.valueOf(Math.min(4, Math.max(0, Math.round(rms / 2)))));
            }
        }
        @Override public void onPartialResults(Bundle data) {
            if (current()) host.event(id, "partial", token, first(data));
        }
        @Override public void onResults(Bundle data) {
            if (!current()) return;
            String text = first(data).trim();
            cancelCapture();
            if (!text.isEmpty()) recognized = token;
            host.event(id, text.isEmpty() ? "quiet" : "final", token, text);
        }
        @Override public void onError(int error) {
            if (!current()) return;
            cancelCapture();
            if (error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) {
                host.event(id, "quiet", token, ""); return;
            }
            if (Build.VERSION.SDK_INT >= 31 && onDevice && (error == SpeechRecognizer.ERROR_LANGUAGE_UNAVAILABLE ||
                error == SpeechRecognizer.ERROR_LANGUAGE_NOT_SUPPORTED) && SpeechRecognizer.isRecognitionAvailable(activity)) {
                onDevice = false;
                listen(id,token);
                return;
            }
            String reason;
            switch (error) {
                case SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS: reason = "Android denied microphone access."; break;
                case SpeechRecognizer.ERROR_RECOGNIZER_BUSY: reason = "The speech service is busy. Try again in a moment."; break;
                case SpeechRecognizer.ERROR_NETWORK: case SpeechRecognizer.ERROR_NETWORK_TIMEOUT: reason = "Your speech service could not connect."; break;
                case SpeechRecognizer.ERROR_AUDIO: reason = "Android could not capture microphone audio."; break;
                default: reason = "Android’s speech service is unavailable. Check the speech language and service settings.";
            }
            host.event(id, "idle", token, reason);
        }
        @Override public void onBufferReceived(byte[] buffer) {}
        @Override public void onEvent(int event, Bundle data) {}
    }

    private static String first(Bundle data) {
        ArrayList<String> words = data == null ? null : data.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        return words == null || words.isEmpty() || words.get(0) == null ? "" : words.get(0);
    }
    private void cancelCapture() {
        disarm();
        capture = "";
        recognized = "";
        SpeechRecognizer old = recognizer;
        recognizer = null;
        if (old != null) { old.cancel(); old.destroy(); }
    }
    void mute(String id) { if (matches(id)) cancelCapture(); }

    boolean acceptTurn(String id, String token) {
        if (!usable(id) || token.isEmpty() || !recognized.equals(token)) return false;
        recognized = "";
        return true;
    }
    void interrupt(String id) {
        if (matches(id)) { cancelCapture(); speech = ""; output.stop(); }
    }

    void speak(String id, String token, String text) {
        if (!usable(id)) return;
        cancelCapture();
        speech = token;
        output.play(text, new SpeechOutput.Listener() {
            boolean current() { return matches(id) && speech.equals(token); }
            @Override public void started() { if (current()) host.event(id, "speaking", token, ""); }
            @Override public void word() {
                long now = SystemClock.elapsedRealtime();
                if (current() && now-lastWord >= 120) { lastWord=now; host.event(id,"beat",token,""); }
            }
            @Override public void finished(boolean success) {
                if (!current()) return;
                speech = "";
                host.event(id,success ? "spoken" : "speechError",token,success ? "" : "Couldn’t play this voice. The reply is in Chat. You can switch voices in Settings.");
            }
        });
    }

    void end(String id, String reason) {
        if (session.isEmpty() || (!id.isEmpty() && !matches(id))) return;
        String old = session;
        session = "";
        pendingSetup = false;
        cancelCapture();
        speech = "";
        output.stop();
        if (focus != null && audio != null) audio.abandonAudioFocusRequest(focus);
        focus = null;
        host.ended(old);
        host.event(old, "ended", "", reason);
    }
}
