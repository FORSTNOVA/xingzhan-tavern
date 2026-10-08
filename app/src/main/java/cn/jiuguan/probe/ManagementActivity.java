package cn.jiuguan.probe;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** Keeps the live chat WebView in MainActivity while showing the update console. */
public class ManagementActivity extends Activity {
    private WebView web;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                Uri uri = request.getUrl();
                if ("apk-tavern".equals(uri.getScheme()) && "restart".equals(uri.getHost())) {
                    if (isManagementPage(view.getUrl()))
                        startActivity(new Intent(ManagementActivity.this, RestartActivity.class)
                            .putExtra("oldPid", android.os.Process.myPid()));
                    return true;
                }
                if ("http".equals(uri.getScheme()) && "127.0.0.1".equals(uri.getHost())) {
                    if (uri.getPort() == 8787 && "/".equals(uri.getPath())) { finish(); return true; }
                    if (uri.getPort() == 8787 || uri.getPort() == 8788) return false;
                }
                if ("https".equals(uri.getScheme()) || "http".equals(uri.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) { }
                }
                return true;
            }
        });
        if (Build.VERSION.SDK_INT >= 33)
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleBack);
        setContentView(web);
        web.loadUrl("http://127.0.0.1:8788/manage?installed=" + Uri.encode(BuildConfig.VERSION_NAME));
    }

    private void handleBack() {
        if (web.canGoBack() && !isManagementPage(web.getUrl())) web.goBack();
        else finish();
    }

    private static boolean isManagementPage(String url) {
        if (url == null) return false;
        Uri uri = Uri.parse(url);
        return "http".equals(uri.getScheme()) && "127.0.0.1".equals(uri.getHost())
            && uri.getPort() == 8788 && "/manage".equals(uri.getPath());
    }

    // Android 13+ uses the registered platform callback; this is the legacy fallback.
    @android.annotation.SuppressLint("GestureBackNavigation")
    @Override public void onBackPressed() { handleBack(); }
    @Override protected void onDestroy() { web.destroy(); super.onDestroy(); }
}
