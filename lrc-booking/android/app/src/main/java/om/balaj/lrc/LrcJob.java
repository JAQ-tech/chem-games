package om.balaj.lrc;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Set;

/** Polls unread notifications every 15 minutes. This is not a foreground service. */
public class LrcJob extends JobService {
    private static final int JOB_ID = 1001;
    private static final long FIFTEEN_MINUTES = 15 * 60 * 1000L;
    private static final String CHANNEL = "manhal_bookings";

    public static void schedule(Context context) {
        JobScheduler scheduler = (JobScheduler) context.getSystemService(JOB_SCHEDULER_SERVICE);
        if (scheduler == null) return;
        JobInfo job = new JobInfo.Builder(JOB_ID, new ComponentName(context, LrcJob.class))
                .setPeriodic(FIFTEEN_MINUTES)
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setPersisted(true)
                .build();
        scheduler.schedule(job);
    }

    @Override
    public boolean onStartJob(JobParameters params) {
        new Thread(() -> {
            try {
                poll();
            } catch (Exception ignored) {
                // The next periodic run tries again.
            }
            jobFinished(params, false);
        }).start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) {
        return true;
    }

    private void poll() throws Exception {
        SessionStore session = new SessionStore(this);
        if (!session.hasIdentity()) return;
        String token = login(session);
        if (token == null || token.isEmpty()) return;
        JSONArray notes = unread(session, token);
        Set<String> seen = session.seenIds();
        NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (manager == null) return;
        ensureChannel(manager);
        boolean changed = false;
        for (int i = 0; i < notes.length(); i++) {
            JSONObject note = notes.getJSONObject(i);
            String id = String.valueOf(note.get("id"));
            if (seen.contains(id)) continue;
            show(manager, id, text(note.optString("title"), session.lang()), text(note.optString("body"), session.lang()));
            seen.add(id);
            changed = true;
        }
        if (seen.size() > 200) {
            seen = new java.util.HashSet<>(new java.util.ArrayList<>(seen).subList(seen.size() - 200, seen.size()));
        }
        if (changed) session.remember(seen);
    }

    private String login(SessionStore session) throws Exception {
        JSONObject body = new JSONObject();
        body.put("file_no", session.fileNo());
        String response = request(
                "POST",
                session.url() + "/functions/v1/login",
                session.anonKey(),
                null,
                body.toString()
        );
        if (response == null) return null;
        JSONObject json = new JSONObject(response);
        return json.optString("access_token", "");
    }

    private JSONArray unread(SessionStore session, String token) throws Exception {
        String response = request(
                "GET",
                session.url() + "/rest/v1/notifications?select=id,title,body,read&read=eq.false&order=created_at.desc",
                session.anonKey(),
                token,
                null
        );
        if (response == null || response.isEmpty()) return new JSONArray();
        return new JSONArray(response);
    }

    private String request(String method, String url, String anonKey, String bearer, String body) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setConnectTimeout(20000);
        connection.setReadTimeout(20000);
        connection.setRequestMethod(method);
        connection.setRequestProperty("apikey", anonKey);
        connection.setRequestProperty("Content-Type", "application/json");
        connection.setRequestProperty("Accept", "application/json");
        if (bearer != null && !bearer.isEmpty()) {
            connection.setRequestProperty("Authorization", "Bearer " + bearer);
        } else {
            connection.setRequestProperty("Authorization", "Bearer " + anonKey);
        }
        if (body != null) {
            connection.setDoOutput(true);
            try (OutputStream out = connection.getOutputStream()) {
                out.write(body.getBytes(StandardCharsets.UTF_8));
            }
        }
        int code = connection.getResponseCode();
        InputStream stream = code >= 400 ? connection.getErrorStream() : connection.getInputStream();
        if (stream == null || code >= 400) return null;
        StringBuilder text = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) text.append(line);
        }
        return text.toString();
    }

    private void ensureChannel(NotificationManager manager) {
        NotificationChannel channel = new NotificationChannel(CHANNEL, getString(R.string.channel_name), NotificationManager.IMPORTANCE_DEFAULT);
        manager.createNotificationChannel(channel);
    }

    private void show(NotificationManager manager, String id, String title, String body) {
        Intent open = new Intent(this, MainActivity.class);
        PendingIntent pending = PendingIntent.getActivity(
                this,
                id.hashCode(),
                open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        Notification notification = new Notification.Builder(this, CHANNEL)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(title)
                .setContentText(body)
                .setAutoCancel(true)
                .setContentIntent(pending)
                .build();
        manager.notify(id.hashCode(), notification);
    }

    private String text(String raw, String lang) {
        if (raw != null && raw.startsWith("{")) {
            try {
                JSONObject json = new JSONObject(raw);
                String preferred = json.optString(lang, "");
                if (!preferred.isEmpty()) return preferred;
                return json.optString("ar", raw);
            } catch (Exception ignored) {
                return raw;
            }
        }
        return raw == null ? "" : raw;
    }
}
