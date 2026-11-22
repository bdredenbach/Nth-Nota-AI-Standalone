package com.nth.notaai;

import java.io.*;
import java.net.URL;
import java.net.URLStreamHandler;
import java.net.URLConnection;
import java.nio.charset.StandardCharsets;
import java.security.cert.Certificate;
import javax.net.ssl.HttpsURLConnection;
import org.json.JSONObject;

/** Runs Gateway.request unchanged, exchanging the HTTP request and response with the local Worker over stdio. */
public final class GatewayLoopback {
    private static final BufferedReader input = new BufferedReader(new InputStreamReader(System.in, StandardCharsets.UTF_8));

    public static void main(String[] args) throws Exception {
        URL.setURLStreamHandlerFactory(protocol -> "https".equals(protocol) ? new URLStreamHandler() {
            protected URLConnection openConnection(URL url) { return new LocalConnection(url); }
        } : null);
        System.out.println(new Gateway().request(input.readLine()));
    }

    private static final class LocalConnection extends HttpsURLConnection {
        private final ByteArrayOutputStream request = new ByteArrayOutputStream();
        private String response;

        LocalConnection(URL url) { super(url); }
        public OutputStream getOutputStream() { return request; }
        public int getResponseCode() throws IOException {
            JSONObject wire = new JSONObject();
            try {
                wire.put("url", getURL().toString()).put("method", getRequestMethod())
                    .put("origin", getRequestProperty("Origin")).put("type", getRequestProperty("Content-Type"))
                    .put("body", request.toString(StandardCharsets.UTF_8));
            } catch (org.json.JSONException e) { throw new IOException(e); }
            System.out.println(wire);
            int status = Integer.parseInt(input.readLine());
            response = input.readLine();
            return status;
        }
        public InputStream getInputStream() { return new ByteArrayInputStream(response.getBytes(StandardCharsets.UTF_8)); }
        public void connect() {}
        public void disconnect() {}
        public boolean usingProxy() { return false; }
        public String getCipherSuite() { return null; }
        public Certificate[] getLocalCertificates() { return null; }
        public Certificate[] getServerCertificates() { return null; }
    }
}
