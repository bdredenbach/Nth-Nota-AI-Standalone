package com.nth.notaai;

import java.io.*;
import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.nio.charset.*;
import java.util.*;
import java.util.zip.*;

final class AttachedFile {
    private static final int ARCHIVE_LIMIT = 16 * 1024 * 1024;
    private static final int TEXT_LIMIT = 12000, ENTRY_LIMIT = 60, EXCERPT_BYTES = 4096;
    final String name, detail, body;

    private AttachedFile(String name, String detail, String body) {
        this.name = name;
        this.detail = detail;
        this.body = body;
    }

    static String label(String raw) {
        String value = raw.replaceAll("[\\p{Cntrl}\\p{Cf}]", " ").trim();
        return value.length() > 120 ? value.substring(0, 117) + "…" : value;
    }

    private static boolean textName(String name) {
        return name.toLowerCase(Locale.ROOT).matches(".*\\.(txt|md|markdown|csv|log|json)");
    }

    static AttachedFile read(InputStream input, String name, String mime, File cache) throws IOException {
        String title = label(name);
        String lower = name.toLowerCase(Locale.ROOT);
        boolean zip = lower.endsWith(".zip") || "application/zip".equals(mime) || "application/x-zip-compressed".equals(mime);
        if (zip) return archive(input, title, cache);
        if (!textName(name) && !(mime.startsWith("text/") || "application/json".equals(mime)))
            throw new IOException("Choose a ZIP archive or a text file.");
        StringBuilder body = new StringBuilder();
        boolean clipped = appendText(input, TEXT_LIMIT, TEXT_LIMIT * 4, body);
        if (body.toString().trim().isEmpty()) throw new IOException("This file has no readable text.");
        return new AttachedFile(title, clipped ? "Text excerpt" : "Text file", body.toString() + (clipped ? "\n[Remaining text omitted]" : ""));
    }

    // Read at most one byte beyond the excerpt. A partial final UTF-8 character is left out.
    private static boolean appendText(InputStream input, int chars, int bytes, StringBuilder result) throws IOException {
        byte[] data = new byte[bytes + 1];
        int used = 0, n;
        while (used < data.length && (n = input.read(data, used, data.length - used)) != -1) used += n;
        boolean clipped = used > bytes;
        ByteBuffer buf = ByteBuffer.wrap(data, 0, Math.min(bytes, used));
        CharBuffer out = CharBuffer.allocate(buf.remaining() + 1);
        CharsetDecoder decoder = StandardCharsets.UTF_8.newDecoder();
        CoderResult status = decoder.decode(buf, out, !clipped);
        if (status.isError()) throw new IOException("This file needs to be saved as UTF-8 text.");
        out.flip();
        String value = out.toString().replaceFirst("^\uFEFF", "");
        if (value.chars().anyMatch(c -> c < 32 && c != '\r' && c != '\n' && c != '\t'))
            throw new IOException("This file does not contain plain text.");
        int end = Math.min(chars, value.length());
        if (end > 0 && Character.isHighSurrogate(value.charAt(end - 1))) end--;
        result.append(value, 0, end);
        return clipped || end < value.length();
    }

    private static AttachedFile archive(InputStream input, String title, File cache) throws IOException {
        File copy = File.createTempFile("nota-archive-", ".zip", cache);
        try {
            try (OutputStream out = new FileOutputStream(copy)) {
                byte[] block = new byte[16384];
                int size = 0;
                for (int n; (n = input.read(block)) != -1;) {
                    size += n;
                    if (size > ARCHIVE_LIMIT) throw new IOException("Choose a ZIP smaller than 16 MB.");
                    out.write(block, 0, n);
                }
            }
            try (ZipFile archive = new ZipFile(copy)) {
                if (archive.size() == 0) throw new IOException("This ZIP is empty.");
                StringBuilder names = new StringBuilder(), excerpts = new StringBuilder();
                Enumeration<? extends ZipEntry> entries = archive.entries();
                List<ZipEntry> readable = new ArrayList<>();
                int count = 0;
                while (entries.hasMoreElements() && count < ENTRY_LIMIT) {
                    ZipEntry entry = entries.nextElement();
                    String name = label(entry.getName());
                    names.append("\n").append(name);
                    if (!entry.isDirectory() && textName(entry.getName())) readable.add(entry);
                    count++;
                }
                String detail = count == archive.size() ? count + (count == 1 ? " entry" : " entries")
                    : count + " of " + archive.size() + " entries";
                names.insert(0, "Archive listing (" + detail + ")");
                int remaining = TEXT_LIMIT - names.length() - 120;
                for (ZipEntry entry : readable) {
                    String heading = "\n\n" + label(entry.getName()) + "\n";
                    int available = Math.min(3000, remaining - heading.length() - 35);
                    if (available < 80) break;
                    StringBuilder part = new StringBuilder();
                    try (InputStream content = archive.getInputStream(entry)) {
                        if (appendText(content, available, EXCERPT_BYTES, part)) part.append("\n[Excerpt]");
                    } catch (IOException | IllegalArgumentException unreadable) {
                        part.setLength(0);
                        part.append("[Text unavailable]");
                    }
                    excerpts.append(heading).append(part);
                    remaining -= heading.length() + part.length();
                }
                return new AttachedFile(title, detail, names + "\n\nOnly the text shown below is included. Other entries are listed by name." + excerpts);
            } catch (ZipException | IllegalArgumentException invalid) {
                throw new IOException("Couldn’t open this ZIP. Try an unencrypted ZIP archive.");
            }
        } finally {
            copy.delete();
        }
    }
}
