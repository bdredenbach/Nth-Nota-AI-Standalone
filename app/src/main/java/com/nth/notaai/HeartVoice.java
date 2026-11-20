package com.nth.notaai;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioTrack;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;

import com.google.mediapipe.tasks.audio.texttospeech.AudioChunk;
import com.google.mediapipe.tasks.audio.texttospeech.TextToSpeech;
import com.google.mediapipe.tasks.audio.texttospeech.TextToSpeechOptions;
import com.google.mediapipe.tasks.audio.texttospeech.TtsStream;
import com.google.mediapipe.tasks.core.BaseOptions;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.zip.GZIPInputStream;

/** Local Kokoro inference. A canceled generation can never resume playback or reopen the mic. */
final class HeartVoice {
    private static final String ASSET = "voice/kokoro-v1.pack";
    private static final long MODEL_SIZE = 294783298L;
    private final Context context;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private volatile long generation;
    private volatile boolean closed;
    // The stream and track are also visible to stop(), under this lock. Creation and disposal run on worker.
    private final Object playback = new Object();
    private TtsStream currentStream;
    private AudioTrack currentTrack;
    private TextToSpeech engine;
    private float enginePace;

    HeartVoice(Context context) { this.context = context; }

    private static synchronized File install(Context context) throws IOException {
        File root = context.getNoBackupFilesDir();
        File target = new File(root, "kokoro-v1-e7b931ee.litertlm");
        if (target.length() == MODEL_SIZE) return target;
        File partial = File.createTempFile("kokoro-", ".tmp", root);
        try {
            try (InputStream input = new GZIPInputStream(context.getAssets().open(ASSET), 65536);
                 FileOutputStream out = new FileOutputStream(partial)) {
                byte[] buffer = new byte[65536];
                int n;
                while ((n = input.read(buffer)) != -1) out.write(buffer, 0, n);
            }
            if (partial.length() != MODEL_SIZE) throw new IOException("Incomplete bundled model");
            Files.move(partial.toPath(), target.toPath(), StandardCopyOption.ATOMIC_MOVE,
                    StandardCopyOption.REPLACE_EXISTING);
            return target;
        } finally { Files.deleteIfExists(partial.toPath()); }
    }

    private void load(float pace) throws IOException {
        if (engine != null && enginePace == pace) return;
        if (engine != null) { engine.close(); engine = null; }
        File model = install(context);
        BaseOptions base = BaseOptions.builder().setModelAssetPath(model.getAbsolutePath()).build();
        engine = TextToSpeech.create(new TextToSpeechOptions(base, "af_heart", "en-US", pace, 0,
                context.getCacheDir().getAbsolutePath()));
        enginePace = pace;
    }

    void play(String text, float pace, SpeechOutput.Listener listener) {
        if (closed || text.trim().isEmpty()) { listener.finished(false); return; }
        long token = ++generation;
        worker.execute(() -> {
            if (generation != token) return;
            boolean played = false;
            try {
                load(pace);
                if (generation == token) played = stream(token, text, listener);
            } catch (IOException | RuntimeException | LinkageError | OutOfMemoryError e) {
                Log.w("NotaHeart", "Local speech unavailable", e);
            }
            final boolean result = played;
            main.post(() -> { if (generation == token) listener.finished(result); });
        });
    }

    private boolean stream(long token, String text, SpeechOutput.Listener listener) {
        AudioTrack track = null;
        long frames = 0;
        try (TtsStream stream = engine.openStream(text, null, true)) {
            synchronized (playback) {
                if (generation != token) return false;
                currentStream = stream;
            }
            try {
                while (generation == token) {
                    AudioChunk chunk = stream.readNext();
                    if (chunk == null) break;
                    float[] samples = chunk.getSamples();
                    if (samples.length != 0) {
                        if (track == null) {
                            track = speaker(chunk.getSampleRateHz());
                            synchronized (playback) {
                                if (generation != token) return false;
                                currentTrack = track;
                                track.play();
                            }
                            main.post(() -> { if (generation == token) listener.started(); });
                        }
                        int offset = 0;
                        while (offset < samples.length && generation == token) {
                            int n = track.write(samples, offset, samples.length-offset, AudioTrack.WRITE_NON_BLOCKING);
                            if (n < 0) throw new IllegalStateException("Audio output error " + n);
                            if (n == 0) SystemClock.sleep(12);
                            else {
                                long before = frames;
                                offset += n;
                                frames += n;
                                if (frames / 6000 != before / 6000)
                                    main.post(() -> { if (generation == token) listener.word(); });
                            }
                        }
                    }
                    if (chunk.isFinal()) break;
                }
                // Wait until the speaker has actually played the final samples before listening again.
                if (track == null || frames == 0) return false;
                long remaining = Math.max(0, frames - Integer.toUnsignedLong(track.getPlaybackHeadPosition()));
                long timeout = SystemClock.elapsedRealtime() + 2500 + 1000 * remaining / track.getSampleRate();
                while (generation == token && Integer.toUnsignedLong(track.getPlaybackHeadPosition()) < frames) {
                    if (SystemClock.elapsedRealtime() >= timeout) return false;
                    SystemClock.sleep(12);
                }
                return generation == token;
            } finally {
                synchronized (playback) { currentStream = null; currentTrack = null; }
            }
        } finally { if (track != null) track.release(); }
    }

    private static AudioTrack speaker(int hz) {
        int encoding = AudioFormat.ENCODING_PCM_FLOAT, channel = AudioFormat.CHANNEL_OUT_MONO;
        int buffer = Math.max(AudioTrack.getMinBufferSize(hz, channel, encoding), hz / 4 * 4);
        return new AudioTrack.Builder()
            .setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
            .setAudioFormat(new AudioFormat.Builder().setSampleRate(hz).setChannelMask(channel).setEncoding(encoding).build())
            .setBufferSizeInBytes(buffer).setTransferMode(AudioTrack.MODE_STREAM).build();
    }

    void stop() {
        generation++;
        synchronized (playback) {
            if (currentTrack != null) { currentTrack.pause(); currentTrack.flush(); }
            if (currentStream != null) currentStream.cancel();
        }
    }

    void close() {
        closed = true;
        stop();
        worker.execute(() -> { if (engine != null) { engine.close(); engine = null; } });
        worker.shutdown();
    }
}
