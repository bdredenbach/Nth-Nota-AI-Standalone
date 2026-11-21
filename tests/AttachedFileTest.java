package com.nth.notaai;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.zip.*;

// Run with javac alongside AttachedFile.java, then run this class with assertions enabled.
public final class AttachedFileTest {
    private static AttachedFile read(File cache, String name, byte[] data) throws IOException {
        return AttachedFile.read(new ByteArrayInputStream(data), name, "application/octet-stream", cache);
    }
    private static void rejects(File cache, String name, byte[] data) throws IOException {
        try { read(cache, name, data); throw new AssertionError("Accepted invalid " + name); }
        catch (IOException expected) { assert expected.getMessage() != null; }
    }
    private static void put(ZipOutputStream zip, String name, String value) throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        zip.write(value.getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
    }
    public static void main(String[] args) throws IOException {
        File cache = Files.createTempDirectory("nota-file-test").toFile();
        try {
            ByteArrayOutputStream data = new ByteArrayOutputStream();
            try (ZipOutputStream zip = new ZipOutputStream(data)) {
                put(zip, "docs/notes.md", "The sample project is Harbor 27.");
                put(zip, "photo.jpg", "binary marker excluded");
                put(zip, "large.txt", "x".repeat(9000));
                put(zip, "bad.log", "\0INVALID_BINARY");
                put(zip, "../never-created.txt", "listed as data");
                for (int i = 0; i < 70; i++) put(zip, "empty/" + i + ".png", "");
            }
            AttachedFile result = read(cache,"sample.zip",data.toByteArray());
            assert result.detail.equals("60 of 75 entries");
            assert result.body.contains("docs/notes.md") && result.body.contains("Harbor 27");
            assert result.body.contains("photo.jpg") && !result.body.contains("binary marker excluded");
            assert result.body.contains("[Excerpt]") && result.body.contains("[Text unavailable]");
            assert !result.body.contains("INVALID_BINARY") && !result.body.contains("empty/69.png");
            assert result.body.length() <= 12000;
            assert cache.list().length == 0;
            assert read(cache, "data.json", "{\"unit\":\"café\"}".getBytes(StandardCharsets.UTF_8)).body.contains("café");
            assert read(cache, "big.txt", "🌲".repeat(15000).getBytes(StandardCharsets.UTF_8)).detail.equals("Text excerpt");
            rejects(cache, "image.txt", new byte[]{3, 0, -1});
            rejects(cache, "x.zip", new byte[]{0, 3, 5});
            rejects(cache, "large.zip", new byte[16 * 1024 * 1024 + 1]);
            rejects(cache, "document.pdf", new byte[]{1});
            assert cache.list().length == 0;
            System.out.println("File reading, archive bounds, invalid input and cleanup passed.");
        } finally { cache.delete(); }
    }
}
