package com.nth.notaai;

import androidx.annotation.RequiresApi;
import android.content.Context;
import android.location.Address;
import android.location.Geocoder;
import android.location.Location;
import android.os.Build;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.*;

/** Finds an area label for a coarse position. Street addresses never enter the chat. */
final class AreaName {
    private static final ExecutorService legacy = new ThreadPoolExecutor(0, 1, 10, TimeUnit.SECONDS,
        new SynchronousQueue<>());
    private AreaName() {}

    static double rounded(double degrees) { return Math.round(degrees * 100) / 100.0; }

    static String lookup(Context context, Location point) throws InterruptedException {
        Future<List<Address>> pending = null;
        try {
            if (!Geocoder.isPresent()) return "";
            Geocoder geocoder = new Geocoder(context.getApplicationContext(), Locale.getDefault());
            double lat = rounded(point.getLatitude());
            double lon = rounded(point.getLongitude());
            pending = Build.VERSION.SDK_INT >= 33 ? lookupAsync(geocoder, lat, lon)
                : legacy.submit(() -> geocoder.getFromLocation(lat, lon, 1));
            List<Address> matches = pending.get(4, TimeUnit.SECONDS);
            return matches == null || matches.isEmpty() ? "" : label(matches.get(0));
        } catch (ExecutionException | TimeoutException | RuntimeException unavailable) {
            return "";
        } finally {
            if (pending != null) pending.cancel(true);
        }
    }

    @RequiresApi(33)
    private static Future<List<Address>> lookupAsync(Geocoder geocoder, double lat, double lon) {
        CompletableFuture<List<Address>> result = new CompletableFuture<>();
        geocoder.getFromLocation(lat, lon, 1, new Geocoder.GeocodeListener() {
            @Override public void onGeocode(List<Address> rows) { result.complete(rows); }
            @Override public void onError(String message) { result.complete(Collections.emptyList()); }
        });
        return result;
    }

    static String label(Address address) {
        Set<String> parts = new LinkedHashSet<>();
        String town = address.getLocality();
        if (town == null || town.trim().isEmpty()) town = address.getSubAdminArea();
        for (String value : new String[]{town, address.getAdminArea()}) {
            if (value != null && !value.trim().isEmpty()) parts.add(value.trim());
        }
        if (parts.isEmpty()) return "";
        String country = address.getCountryCode();
        if (country != null && !country.isEmpty()) parts.add(country);
        return String.join(", ", parts);
    }
}
