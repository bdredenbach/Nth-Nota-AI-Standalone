package com.nth.notaai;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.TimeZone;
import javax.net.ssl.HttpsURLConnection;

final class Gateway {
    static final String ROOT = "https://nth-nota-free-ai.bdredenbach.workers.dev/v1/";
    private volatile HttpsURLConnection connection;
    private volatile boolean canceled;

    void cancel() {
        canceled = true;
        HttpsURLConnection current = connection;
        if (current != null) current.disconnect();
    }

    JSONObject request(String encoded) throws Exception {
        JSONObject input = new JSONObject(encoded);
        String route = input.getString("route");
        JSONObject body = new JSONObject().put("consentAccepted", true);
        if ("write".equals(route)) {
            String prompt = input.getString("prompt");
            if (prompt.trim().isEmpty() || prompt.length() > 16000) throw new IOException("Shorten the passage to fit this writing request.");
            body.put("task", "generate").put("prompt", prompt);
        } else if ("chat".equals(route)) {
            String question = input.getString("question");
            String mode = input.getString("mode");
            JSONArray turns = input.getJSONArray("messages");
            if (question.trim().isEmpty() || question.length() > 2000 || turns.length() > 12 || turns.length() % 2 != 0 ||
                !("auto".equals(mode) || "search".equals(mode))) throw new IOException("This question exceeds the conversation limits.");
            body.put("question", question).put("mode", mode).put("messages", turns).put("timezone", TimeZone.getDefault().getID());
        } else throw new IOException("Unknown request type.");
        byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
        if (bytes.length > 65536) throw new IOException("Shorten the text and try again.");
        HttpsURLConnection http = (HttpsURLConnection)new URL(ROOT + route).openConnection();
        connection = http;
        try {
            if (canceled) throw new IOException("Stopped.");
            http.setInstanceFollowRedirects(false);
            http.setUseCaches(false);
            http.setConnectTimeout(12000);
            http.setReadTimeout(100000);
            http.setRequestMethod("POST");
            http.setDoOutput(true);
            http.setRequestProperty("Content-Type", "application/json");
            http.setRequestProperty("Accept", "application/json");
            http.setRequestProperty("Origin", "https://appassets.androidplatform.net");
            http.setRequestProperty("User-Agent", "NthNotaAI/0.4.0 (Android)");
            http.setFixedLengthStreamingMode(bytes.length);
            try (OutputStream out = http.getOutputStream()) {
                if (canceled) throw new IOException("Stopped.");
                out.write(bytes);
            }
            int status = http.getResponseCode();
            if (status < 200 || status >= 300) {
                if (status == 429) throw new IOException("The free service has reached a usage limit. Try again later.");
                if (status == 400 || status == 413) throw new IOException("The service could not accept this request. Shorten it and try again.");
                throw new IOException("The service returned HTTP " + status + ". You can retry this question.");
            }
            try (InputStream in = http.getInputStream()) {
                JSONObject result = new JSONObject(readUtf8(in, 262144));
                if (result.optString("text").trim().isEmpty()) throw new JSONException("Missing answer");
                return result;
            }
        } finally {
            http.disconnect();
            connection = null;
        }
    }

    static String readUtf8(InputStream in, int limit) throws IOException {
        if (in == null) throw new IOException("This file could not be opened.");
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        byte[] block = new byte[4096];
        int count;
        while ((count = in.read(block)) != -1) {
            if (bytes.size() + count > limit) throw new IOException("This text is too large.");
            bytes.write(block, 0, count);
        }
        return bytes.toString("UTF-8");
    }
}
