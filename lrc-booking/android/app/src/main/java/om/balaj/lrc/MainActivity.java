package om.balaj.lrc;

import android.annotation.SuppressLint;
import android.app.DownloadManager;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

public class MainActivity extends Activity {
    private static final String APP_HOST = "appassets.androidplatform.net";
    private static final String APP_URL = "https://appassets.androidplatform.net/www/index.html";
    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        webView = findViewById(R.id.web);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setUserAgentString(settings.getUserAgentString() + " ManhalAPK/1.0.0");
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);
        webView.addJavascriptInterface(new Bridge(), "ManhalAndroid");
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (uri == null) return true;
                if (APP_HOST.equals(uri.getHost())) return false;
                return !"https".equals(uri.getScheme());
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (uri == null || !APP_HOST.equals(uri.getHost())) return null;
                String path = uri.getPath();
                if (path == null || path.equals("/")) path = "/www/index.html";
                if (path.startsWith("/")) path = path.substring(1);
                return openAsset(path);
            }
        });
        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            if (url == null || url.startsWith("blob:")) return;
            DownloadManager manager = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
            if (manager == null) return;
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            String name = URLUtil.guessFileName(url, contentDisposition, mimeType);
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
            request.setMimeType(mimeType);
            manager.enqueue(request);
        });
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1);
        }
        LrcJob.schedule(this);
        webView.loadUrl(APP_URL);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    private WebResourceResponse openAsset(String path) {
        try {
            InputStream stream = getAssets().open(path);
            String mime = mimeFor(path);
            String encoding = mime.startsWith("text/") || mime.contains("javascript") || mime.contains("json") ? "utf-8" : null;
            return new WebResourceResponse(mime, encoding, stream);
        } catch (IOException error) {
            return null;
        }
    }

    private static String mimeFor(String path) {
        String name = path.toLowerCase();
        if (name.endsWith(".html")) return "text/html";
        if (name.endsWith(".css")) return "text/css";
        if (name.endsWith(".js")) return "text/javascript";
        if (name.endsWith(".json")) return "application/json";
        if (name.endsWith(".png")) return "image/png";
        if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
        if (name.endsWith(".svg")) return "image/svg+xml";
        if (name.endsWith(".ttf")) return "font/ttf";
        if (name.endsWith(".txt")) return "text/plain";
        return "application/octet-stream";
    }

    private final class Bridge {
        @JavascriptInterface
        public void setSession(String supabaseUrl, String anonKey, String fileNo, String lang) {
            new SessionStore(MainActivity.this).save(supabaseUrl, anonKey, fileNo, lang);
        }

        @JavascriptInterface
        public void clearSession() {
            new SessionStore(MainActivity.this).clear();
        }

        @JavascriptInterface
        public void savePdf(String filename, String base64) {
            runOnUiThread(() -> writePdf(filename, base64));
        }
    }

    private void writePdf(String filename, String base64) {
        try {
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            String safeName = (filename == null || filename.isEmpty()) ? "manhal-week.pdf" : filename;
            if (Build.VERSION.SDK_INT >= 29) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, safeName);
                values.put(MediaStore.Downloads.MIME_TYPE, "application/pdf");
                values.put(MediaStore.Downloads.IS_PENDING, 1);
                Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) return;
                try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                    if (out != null) out.write(bytes);
                }
                values.clear();
                values.put(MediaStore.Downloads.IS_PENDING, 0);
                getContentResolver().update(uri, values, null, null);
            } else {
                File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                if (dir == null) return;
                try (OutputStream out = new FileOutputStream(new File(dir, safeName))) {
                    out.write(bytes);
                }
            }
            Toast.makeText(this, safeName, Toast.LENGTH_LONG).show();
        } catch (Exception ignored) {
            Toast.makeText(this, "PDF", Toast.LENGTH_SHORT).show();
        }
    }
}
