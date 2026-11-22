package com.nth.notaai;

import static org.junit.Assert.*;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.cert.Certificate;
import java.time.Instant;
import java.util.Locale;
import java.util.TimeZone;
import javax.net.ssl.HttpsURLConnection;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35, manifest = Config.NONE)
public class GatewayQuotaTest {
    private final long now = Instant.parse("2026-11-22T23:59:30Z").toEpochMilli();
    private final Locale originalLocale = Locale.getDefault();
    private final TimeZone originalZone = TimeZone.getDefault();

    @Before public void setDeviceLocale() {
        Locale.setDefault(Locale.US);
        TimeZone.setDefault(TimeZone.getTimeZone("America/New_York"));
    }
    @After public void restoreDeviceLocale() {
        Locale.setDefault(originalLocale);
        TimeZone.setDefault(originalZone);
    }

    private String message(int status, String body, String retryAfter) throws Exception {
        HttpsURLConnection http = new HttpsURLConnection(new URL("https://fixture.invalid")) {
            public InputStream getErrorStream() {
                return body == null ? null : new ByteArrayInputStream(body.getBytes(StandardCharsets.UTF_8));
            }
            public String getHeaderField(String key) { return "Retry-After".equalsIgnoreCase(key) ? retryAfter : null; }
            public void connect() {}
            public void disconnect() {}
            public boolean usingProxy() { return false; }
            public String getCipherSuite() { return null; }
            public Certificate[] getLocalCertificates() { return null; }
            public Certificate[] getServerCertificates() { return null; }
        };
        return Gateway.retryMessage(http, status, now);
    }

    @Test public void absoluteResetUsesDeviceTimeAndTakesPrecedence() throws Exception {
        String text = message(429, "{\"retryAt\":" + (now + 30000) + "}", "120");
        assertTrue(text, text.contains("Nov 22, 2026"));
        assertTrue(text, text.contains("7:00:00") && text.contains("PM") && text.contains("(local time)"));
    }

    @Test public void malformedBodyAndPastResetFallBackToHeaders() throws Exception {
        String expected = message(429, "{\"retryAt\":" + (now + 30000) + "}", null);
        assertEquals(expected, message(429, "<html>proxy</html>", "30"));
        assertEquals(expected, message(429, "{\"retryAt\":1}", "Mon, 23 Nov 2026 00:00:00 GMT"));
        assertEquals(expected, message(429, null, "30"));
    }

    @Test public void outageExplainsTheWaitUsingTheSameDeviceClockAsQuota() throws Exception {
        String quota = message(429, null, "30");
        String outage = message(503, "{\"retryAt\":" + (now + 30000) + "}", "120");
        assertTrue(outage, outage.contains("temporarily unavailable") && outage.contains("Your question is still here."));
        assertFalse(outage, outage.contains("usage limit"));
        assertEquals(quota.substring(quota.indexOf("Try again at")), outage.substring(outage.indexOf("Try again at")));
        assertEquals(outage, message(503, "<html>upstream error</html>", "30"));
        assertTrue(message(503, null, null).endsWith("Tap Retry to try again."));
    }

    @Test public void missingAndInvalidResetKeepUsableMessage() throws Exception {
        assertTrue(message(429, "{}", null).endsWith("Try again later."));
        assertTrue(message(429, null, "not a date").endsWith("Try again later."));
        assertTrue(message(429, null, "-4").endsWith("Try again later."));
        assertTrue(message(429, null, "0").endsWith("You can retry now."));
        assertTrue(message(429, "{\"retryAt\":1}", null).endsWith("You can retry now."));
    }
}
