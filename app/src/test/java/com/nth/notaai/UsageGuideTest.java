package com.nth.notaai;

import static org.junit.Assert.*;
import android.webkit.WebResourceResponse;
import java.io.IOException;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35, manifest = Config.NONE)
public class UsageGuideTest {
    private final byte[] contents = {10, 20, 30, 40};

    @Test public void seekReturnsOnlyRequestedBytes() throws IOException {
        WebResourceResponse response = UsageGuide.response(contents, "bytes=1-2");
        assertEquals(206, response.getStatusCode());
        assertEquals("bytes 1-2/4", response.getResponseHeaders().get("Content-Range"));
        assertEquals(20, response.getData().read());
        assertEquals(30, response.getData().read());
        assertEquals(-1, response.getData().read());
    }

    @Test public void supportsFullOpenEndedSuffixAndInvalidRanges() throws IOException {
        assertEquals(200, UsageGuide.response(contents, null).getStatusCode());
        assertEquals(30, UsageGuide.response(contents, "bytes=2-").getData().read());
        assertEquals(40, UsageGuide.response(contents, "bytes=-1").getData().read());
        assertEquals(416, UsageGuide.response(contents, "bytes=4-").getStatusCode());
        assertEquals(416, UsageGuide.response(contents, "bytes=2-1").getStatusCode());
    }
}
