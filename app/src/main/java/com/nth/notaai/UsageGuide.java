package com.nth.notaai;

import android.content.res.AssetFileDescriptor;
import android.content.res.AssetManager;
import android.webkit.WebResourceResponse;

import java.io.ByteArrayInputStream;
import java.io.DataInputStream;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Serves the packaged setup movie, including the byte ranges used when seeking. */
final class UsageGuide {
    private static final Pattern RANGE = Pattern.compile("bytes=(\\d*)-(\\d*)", Pattern.CASE_INSENSITIVE);
    private byte[] movie;

    synchronized WebResourceResponse open(AssetManager assets, String range) throws IOException {
        if (movie == null) {
            try (AssetFileDescriptor fd = assets.openFd("usage-guide.webm");
                 DataInputStream in = new DataInputStream(fd.createInputStream())) {
                byte[] bytes = new byte[Math.toIntExact(fd.getLength())];
                in.readFully(bytes);
                movie = bytes;
            }
        }
        return response(movie, range);
    }

    static WebResourceResponse response(byte[] bytes, String range) {
        Map<String, String> headers = new HashMap<>();
        headers.put("Accept-Ranges", "bytes");
        int size = bytes.length;
        int start = 0, end = size - 1;
        Matcher match = RANGE.matcher(range == null ? "" : range.trim());
        boolean partial = match.matches();
        if (partial) {
            try {
                if (match.group(1).isEmpty()) {
                    long suffix = Long.parseLong(match.group(2));
                    start = (int) Math.max(0L, size - suffix);
                } else {
                    start = Integer.parseInt(match.group(1));
                    if (!match.group(2).isEmpty()) end = (int) Math.min(end, Long.parseLong(match.group(2)));
                }
            } catch (NumberFormatException ignored) {
                start = size;
            }
            if (start > end) {
                headers.put("Content-Range", "bytes */" + size);
                headers.put("Content-Length", "0");
                return new WebResourceResponse("video/webm", null, 416, "Range Not Satisfiable",
                        headers, new ByteArrayInputStream(new byte[0]));
            }
            headers.put("Content-Range", "bytes " + start + "-" + end + "/" + size);
        }
        int length = end - start + 1;
        headers.put("Content-Length", Integer.toString(length));
        return new WebResourceResponse("video/webm", null, partial ? 206 : 200, partial ? "Partial Content" : "OK",
                headers, new ByteArrayInputStream(bytes, start, length));
    }
}
