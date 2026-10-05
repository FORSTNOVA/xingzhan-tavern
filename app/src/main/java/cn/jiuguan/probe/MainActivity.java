package cn.jiuguan.probe;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.*;
import android.webkit.*;
import android.widget.*;
import java.net.*;
import java.io.*;
import java.util.*;

public class MainActivity extends Activity {
    public static final String ACTION_DIAGNOSTICS = "cn.jiuguan.probe.DIAGNOSTICS";
    public static final String ACTION_PERFORMANCE = "cn.jiuguan.probe.PERFORMANCE";
    public static final String ACTION_MAINTENANCE = "cn.jiuguan.probe.MAINTENANCE";
    public static volatile boolean foreground;
    private String performanceScript = "";
    private String downloadScript = "";
    private boolean togglePerformanceAfterLoad;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private WebView web;
    private SystemTtsBridge systemTts;
    private String systemTtsToken="";
    private TextView status;
    private LinearLayout layout;
    private volatile boolean destroyed;
    private ValueCallback<Uri[]> chooser;
    private PermissionRequest mediaRequest;
    private AlertDialog mediaDialog;
    private android.view.View fullscreen;
    private WebChromeClient.CustomViewCallback fullscreenCallback;
    private File pendingDownload;
    private boolean downloading;
    private String currentUrl = "http://127.0.0.1:8787/";
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        togglePerformanceAfterLoad = ACTION_PERFORMANCE.equals(getIntent().getAction());
        try (java.io.InputStream input = getAssets().open("mobile-performance.js")) {
            java.io.ByteArrayOutputStream scriptBytes = new java.io.ByteArrayOutputStream();
            byte[] buffer = new byte[4096]; int count;
            while ((count=input.read(buffer))!=-1) scriptBytes.write(buffer,0,count);
            performanceScript = scriptBytes.toString(java.nio.charset.StandardCharsets.UTF_8.name());
        } catch (java.io.IOException error) { android.util.Log.e("TavernProbe", "Performance script unavailable", error); }
        try(InputStream input=getAssets().open("android-downloads.js")){ByteArrayOutputStream bytes=new ByteArrayOutputStream();copy(input,bytes);downloadScript=bytes.toString("UTF-8");}catch(IOException error){android.util.Log.e("TavernProbe","Download script unavailable",error);}
        if (ACTION_DIAGNOSTICS.equals(getIntent().getAction())) currentUrl = "http://127.0.0.1:8788/";
        if (ACTION_MAINTENANCE.equals(getIntent().getAction())) currentUrl = "http://127.0.0.1:8788/manage";
        getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= 33) getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::handleBack);
        if (Build.VERSION.SDK_INT >= 33) requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1);
        layout = new LinearLayout(this); layout.setOrientation(LinearLayout.VERTICAL);
        layout.setBackgroundColor(android.graphics.Color.rgb(24, 24, 24));
        if (Build.VERSION.SDK_INT >= 30) layout.setOnApplyWindowInsetsListener((view, insets) -> {
            android.graphics.Insets bars = insets.getInsets(android.view.WindowInsets.Type.systemBars() | android.view.WindowInsets.Type.displayCutout());
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            return insets;
        });
        status = new TextView(this); status.setText("正在准备"+getString(R.string.app_name)+"，首次启动需要解压资源…"); layout.addView(status);
        status.setTextColor(android.graphics.Color.WHITE);
        systemTts=new SystemTtsBridge(this,(id,result,error)->{if(destroyed||web==null||!isTtsOrigin(web.getUrl()))return;try{org.json.JSONObject envelope=new org.json.JSONObject().put("id",id).put("result",result==null?org.json.JSONObject.NULL:result).put("error",error==null?org.json.JSONObject.NULL:error);web.evaluateJavascript("window.__apkSystemTtsReply?.("+envelope.toString()+")",null);}catch(Exception ignored){}});
        createWebView(); setContentView(layout);
        startForegroundService(new Intent(this, NodeService.class));
        new Thread(() -> {
            for (int i=0; i<240 && !destroyed; i++) {
                try {
                    HttpURLConnection conn = (HttpURLConnection)new URL("http://127.0.0.1:8787/").openConnection();
                    conn.setConnectTimeout(1000); conn.setReadTimeout(1000);
                    int code; try { code = conn.getResponseCode(); } finally { conn.disconnect(); }
                    if (code == 200) { handler.post(() -> { if (!destroyed) { status.setVisibility(android.view.View.GONE); load(currentUrl); } }); return; }
                } catch (Exception ignored) { }
                try { Thread.sleep(1000); } catch (InterruptedException e) { return; }
            }
            handler.post(() -> { if (!destroyed) { status.setText("酒馆启动超时，请查看运行验证及启动日志"); load("http://127.0.0.1:8788/"); } });
        }, "ReadinessCheck").start();
    }
    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent); setIntent(intent);
        if(Intent.ACTION_MAIN.equals(intent.getAction())||(intent.getAction()==null&&"http://127.0.0.1:8787/".equals(web.getUrl()))){web.requestFocus();return;}
        if (ACTION_PERFORMANCE.equals(intent.getAction())) {
            if (web.getUrl() != null && web.getUrl().startsWith("http://127.0.0.1:8787/")) {
                web.evaluateJavascript("if(window.__apkMobilePerformance){window.__apkMobilePerformance.toggle();}else{window.__APK_PERFORMANCE_TOGGLE_REQUESTED__=true;}", null);
            } else { togglePerformanceAfterLoad=true; load("http://127.0.0.1:8787/"); }
            return;
        }
        if(ACTION_MAINTENANCE.equals(intent.getAction())){openManagement();return;}
        load(ACTION_DIAGNOSTICS.equals(intent.getAction()) ? "http://127.0.0.1:8788/" : "http://127.0.0.1:8787/");
    }
    private void openManagement(){
        if(web.getUrl()==null||!web.getUrl().equals("http://127.0.0.1:8787/")){load("http://127.0.0.1:8788/manage");return;}
        // Save through the upstream frontend before leaving the chat.
        web.evaluateJavascript("(async()=>{window.__apkManagementEntry={phase:'加载管理入口'};try{const m=await import('http://127.0.0.1:8787/script.js');if(m.isGenerating())throw Error('请先停止当前生成');const c=window.SillyTavern?.getContext();if(!c)throw Error('请等待酒馆加载完成');window.__apkManagementEntry.phase='保存聊天';await c.saveChat();window.__apkManagementEntry.phase='保存设置';await m.saveSettings();window.__apkManagementEntry.phase='进入管理';location.href='http://127.0.0.1:8788/manage';}catch(error){window.__apkManagementEntry.error=error.message;alert('无法进入管理：'+error.message);}})()",null);
    }
    private void load(String url) { currentUrl = url; web.requestFocus(); web.loadUrl(url); }
    private void createWebView() {
        web = new WebView(this);
        web.getSettings().setJavaScriptEnabled(true); web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setAllowFileAccess(false); web.getSettings().setAllowContentAccess(true);
        web.getSettings().setMediaPlaybackRequiresUserGesture(false);
        web.getSettings().setSupportMultipleWindows(true);
        web.setDownloadListener((url,userAgent,disposition,mime,length)->{
            if(url.startsWith("blob:")||url.startsWith("data:")){
                String filename=URLUtil.guessFileName(url,disposition,mime);
                web.evaluateJavascript("window.__apkDownloads?.exportUrl("+org.json.JSONObject.quote(url)+","+org.json.JSONObject.quote(filename)+").catch(e=>alert(e.message))",null);
            }else saveDownload(url,userAgent,disposition,mime,length);
        });
        web.setWebViewClient(new WebViewClient() {
            @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap icon){systemTtsToken="";if(systemTts!=null)systemTts.close();}
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // Route only top-level links. Cards create blob/srcdoc subframes;
                // cancelling those navigations leaves them stuck on about:blank.
                if (!request.isForMainFrame()) return false;
                Uri uri = request.getUrl();
                if("apk-tavern".equals(uri.getScheme())&&"restart".equals(uri.getHost())){
                    if("http://127.0.0.1:8788/manage".equals(view.getUrl()))startActivity(new Intent(MainActivity.this,RestartActivity.class).putExtra("oldPid",android.os.Process.myPid()));
                    return true;
                }
                if ("http".equals(uri.getScheme()) && "127.0.0.1".equals(uri.getHost()) && (uri.getPort()==8787 || uri.getPort()==8788)) return false;
                if ("https".equals(uri.getScheme()) || "http".equals(uri.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) { }
                }
                return true;
            }
            @Override public void onPageFinished(WebView view, String url) {
                android.util.Log.i("TavernProbe", "Page loaded: " + url);
                if (url.startsWith("http://127.0.0.1:8787/")) {
                    if (togglePerformanceAfterLoad) { togglePerformanceAfterLoad=false; view.evaluateJavascript("window.__APK_PERFORMANCE_TOGGLE_REQUESTED__=true;", null); }
                    // A document script supplies the page's base URL for dynamic imports.
                    // WebView's evaluateJavascript execution has no module referrer URL.
                    view.evaluateJavascript("(()=>{const script=document.createElement('script');script.textContent=" + org.json.JSONObject.quote(performanceScript) + ";document.head.appendChild(script);script.remove();})()", null);
                    view.evaluateJavascript(downloadScript,null);
                    systemTtsToken=java.util.UUID.randomUUID().toString();view.evaluateJavascript("window.__apkSystemTtsAvailable=true;window.__apkSystemTtsToken="+org.json.JSONObject.quote(systemTtsToken),null);
                }
            }
            @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                layout.removeView(view); view.destroy(); createWebView(); load(currentUrl); return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (chooser != null) { callback.onReceiveValue(null);return true; } chooser = callback;
                Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION).setType("*/*");
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,params.getMode()==FileChooserParams.MODE_OPEN_MULTIPLE);
                boolean unknownType=false;ArrayList<String> types=new ArrayList<>();for(String accept:params.getAcceptTypes())for(String type:accept.split(",")){
                    String clean=type.trim();if(clean.isEmpty())continue;if(clean.startsWith(".")){clean=android.webkit.MimeTypeMap.getSingleton().getMimeTypeFromExtension(clean.substring(1));}
                    if(clean!=null&&clean.contains("/"))types.add(clean);else unknownType=true;
                }
                // Android does not know .charx: let the upstream importer validate it.
                if(!unknownType&&!types.isEmpty())intent.putExtra(Intent.EXTRA_MIME_TYPES,types.toArray(new String[0]));
                try { fileStatus("upload-open","multiple="+(params.getMode()==FileChooserParams.MODE_OPEN_MULTIPLE));startActivityForResult(intent, 2); return true; }
                catch (Exception e) { chooser = null; return false; }
            }
            @Override public boolean onJsAlert(WebView view,String url,String message,JsResult result){new AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("确定",(d,w)->result.confirm()).setOnCancelListener(d->result.cancel()).show();return true;}
            @Override public boolean onJsConfirm(WebView view,String url,String message,JsResult result){new AlertDialog.Builder(MainActivity.this).setMessage(message).setPositiveButton("确定",(d,w)->result.confirm()).setNegativeButton("取消",(d,w)->result.cancel()).setOnCancelListener(d->result.cancel()).show();return true;}
            @Override public boolean onJsPrompt(WebView view,String url,String message,String value,JsPromptResult result){
                if(message.startsWith("__xingzhan_system_tts__:")){
                    if(!isTtsOrigin(url)||!isTtsOrigin(view.getUrl())||message.length()>32000){result.confirm("denied");return true;}
                    try{
                        org.json.JSONObject request=new org.json.JSONObject(message.substring("__xingzhan_system_tts__:".length()));
                        final String acceptedToken=systemTtsToken;
                        if(acceptedToken.isEmpty()||!acceptedToken.equals(request.optString("token"))){result.confirm("denied");return true;}
                        result.confirm("accepted");handler.post(()->{if(acceptedToken.equals(systemTtsToken)&&isTtsOrigin(web.getUrl()))systemTts.dispatch(request);});
                    }catch(Exception error){result.confirm("denied");}return true;
                }
                EditText text=new EditText(MainActivity.this);text.setText(value);new AlertDialog.Builder(MainActivity.this).setMessage(message).setView(text).setPositiveButton("确定",(d,w)->result.confirm(text.getText().toString())).setNegativeButton("取消",(d,w)->result.cancel()).setOnCancelListener(d->result.cancel()).show();return true;}
            @Override public boolean onCreateWindow(WebView view,boolean dialog,boolean gesture,Message message){
                if(!gesture)return false;
                WebView child=new WebView(MainActivity.this);child.setWebViewClient(new WebViewClient(){
                    @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest request){routePopup(request.getUrl());handler.post(child::destroy);return true;}
                    @Override public void onPageStarted(WebView v,String url,android.graphics.Bitmap icon){if(!"about:blank".equals(url)){routePopup(Uri.parse(url));handler.post(child::destroy);}}
                });
                ((WebView.WebViewTransport)message.obj).setWebView(child);message.sendToTarget();return true;
            }
            @Override public void onShowCustomView(android.view.View view,CustomViewCallback callback){
                if(fullscreen!=null){callback.onCustomViewHidden();return;}
                fullscreen=view;fullscreenCallback=callback;web.setVisibility(android.view.View.GONE);
                addContentView(view,new android.view.ViewGroup.LayoutParams(-1,-1));
            }
            @Override public void onHideCustomView(){hideFullscreen();}
            @Override public void onPermissionRequest(PermissionRequest request){handler.post(()->requestMedia(request));}
            @Override public void onPermissionRequestCanceled(PermissionRequest request){handler.post(()->{if(mediaRequest==request){mediaRequest=null;if(mediaDialog!=null)mediaDialog.dismiss();}});}
            @Override public boolean onConsoleMessage(ConsoleMessage message) {
                android.util.Log.i("TavernWeb", message.messageLevel()+": "+message.message()); return true;
            }
        });
        layout.addView(web, new LinearLayout.LayoutParams(-1, 0, 1));
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if(request==3)fileStatus("picker-result","code="+result+", uri="+(data!=null&&data.getData()!=null)+", pending="+(pendingDownload!=null));
        if (request==2 && chooser!=null) {
            Uri[] selected=null;
            if(result==RESULT_OK&&data!=null){
                android.content.ClipData clip=data.getClipData();
                if(clip!=null&&clip.getItemCount()>0){selected=new Uri[clip.getItemCount()];for(int i=0;i<selected.length;i++)selected[i]=clip.getItemAt(i).getUri();}
                else if(data.getData()!=null)selected=new Uri[]{data.getData()};
            }
            fileStatus("upload-result","code="+result+", files="+(selected==null?0:selected.length));
            chooser.onReceiveValue(selected);chooser=null;
        }
        if(request==3&&pendingDownload!=null){File file=pendingDownload;pendingDownload=null;
            if(result==RESULT_OK&&data!=null&&data.getData()!=null){Uri destination=data.getData();new Thread(()->{
                try(InputStream input=new FileInputStream(file);OutputStream output=getContentResolver().openOutputStream(destination,"w")){if(output==null)throw new IOException("保存位置不可写");copy(input,output);output.flush();fileStatus("saved","bytes="+file.length());handler.post(()->toast("文件已保存"));}
                catch(Exception error){fileStatus("save-error",error.getClass().getSimpleName()+": "+error.getMessage());handler.post(()->toast("保存失败："+error.getMessage()));}finally{file.delete();}
            },"SaveDocument").start();}else{file.delete();toast("已取消保存");}
        }
    }
    private void routePopup(Uri uri){
        if("http".equals(uri.getScheme())&&"127.0.0.1".equals(uri.getHost())&&(uri.getPort()==8787||uri.getPort()==8788))load(uri.toString());
        else if("https".equals(uri.getScheme())||"http".equals(uri.getScheme()))try{startActivity(new Intent(Intent.ACTION_VIEW,uri));}catch(Exception error){toast("未找到可打开链接的应用");}
    }
    private void toast(String message){if(!destroyed)Toast.makeText(this,message,Toast.LENGTH_LONG).show();}
    private static boolean isTtsOrigin(String url){if(url==null)return false;Uri origin=Uri.parse(url);return "http".equals(origin.getScheme())&&"127.0.0.1".equals(origin.getHost())&&origin.getPort()==8787;}
    private static void copy(InputStream input,OutputStream output)throws IOException{byte[] buffer=new byte[32768];int count;while((count=input.read(buffer))!=-1)output.write(buffer,0,count);}
    private void fileStatus(String stage,String message){try(FileOutputStream output=new FileOutputStream(new File(getFilesDir(),"file-validation.json"))){org.json.JSONObject report=new org.json.JSONObject();report.put("stage",stage);report.put("message",message);report.put("time",System.currentTimeMillis());output.write(report.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));}catch(Exception ignored){}}
    private void hideFullscreen(){if(fullscreen!=null){((android.view.ViewGroup)fullscreen.getParent()).removeView(fullscreen);fullscreen=null;web.setVisibility(android.view.View.VISIBLE);fullscreenCallback.onCustomViewHidden();fullscreenCallback=null;}}
    private void requestMedia(PermissionRequest request){
        Uri origin=request.getOrigin();if(!"http".equals(origin.getScheme())||!"127.0.0.1".equals(origin.getHost())||origin.getPort()!=8787){request.deny();return;}
        if(mediaRequest!=null){request.deny();return;}
        for(String resource:request.getResources())if(!resource.equals(PermissionRequest.RESOURCE_AUDIO_CAPTURE)&&!resource.equals(PermissionRequest.RESOURCE_VIDEO_CAPTURE)){request.deny();return;}
        mediaRequest=request;
        mediaDialog=new AlertDialog.Builder(this).setTitle("酒馆请求传感器权限").setMessage(Arrays.asList(request.getResources()).contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)?"允许此次摄像头预览？取消或拒绝不会启动摄像头。":"允许此次使用麦克风？取消或拒绝不会启动麦克风。")
            .setPositiveButton("允许此次",(dialog,which)->{
                ArrayList<String> missing=new ArrayList<>();for(String resource:request.getResources()){String permission=resource.equals(PermissionRequest.RESOURCE_AUDIO_CAPTURE)?Manifest.permission.RECORD_AUDIO:Manifest.permission.CAMERA;if(checkSelfPermission(permission)!=PackageManager.PERMISSION_GRANTED)missing.add(permission);}
                if(missing.isEmpty()){request.grant(request.getResources());mediaRequest=null;}else requestPermissions(missing.toArray(new String[0]),4);
            }).setNegativeButton("拒绝",(d,w)->denyMedia()).setOnCancelListener(d->denyMedia()).show();
    }
    private void denyMedia(){if(mediaRequest!=null){mediaRequest.deny();mediaRequest=null;}}
    @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results){super.onRequestPermissionsResult(request,permissions,results);if(request==4&&mediaRequest!=null){boolean allowed=results.length>0;for(int result:results)allowed&=result==PackageManager.PERMISSION_GRANTED;if(allowed)mediaRequest.grant(mediaRequest.getResources());else mediaRequest.deny();mediaRequest=null;}}
    private void saveDownload(String url,String userAgent,String disposition,String mime,long length){
        if(downloading||pendingDownload!=null){toast("请先完成当前文件保存");return;}
        Uri uri=Uri.parse(url);if(!"http".equals(uri.getScheme())&&!"https".equals(uri.getScheme())){toast("不支持此文件链接");return;}
        if(length>128L*1024*1024){toast("文件超过 128 MB 保存上限");return;}
        downloading=true;toast("正在准备保存文件…");
        new Thread(()->{
            File file=null;HttpURLConnection connection=null;
            try{
                file=File.createTempFile("tavern-export-",".tmp",getCacheDir());
                URL current=new URL(url);
                for(int redirects=0;redirects<5;redirects++){
                    if(!current.getProtocol().equals("http")&&!current.getProtocol().equals("https"))throw new IOException("不支持的下载地址");
                    connection=(HttpURLConnection)current.openConnection();connection.setConnectTimeout(15000);connection.setReadTimeout(30000);connection.setInstanceFollowRedirects(false);connection.setRequestProperty("User-Agent",userAgent);
                    if(current.getHost().equals("127.0.0.1")&&current.getPort()==8787){String cookie=android.webkit.CookieManager.getInstance().getCookie(current.toString());if(cookie!=null)connection.setRequestProperty("Cookie",cookie);}
                    int code=connection.getResponseCode();if(code>=300&&code<400){URL next=new URL(current,connection.getHeaderField("Location"));connection.disconnect();current=next;continue;}
                    if(code!=200)throw new IOException("下载失败 HTTP "+code);break;
                }
                if(connection==null||connection.getResponseCode()!=200)throw new IOException("下载重定向过多");
                try(InputStream input=connection.getInputStream();OutputStream output=new FileOutputStream(file)){byte[] buffer=new byte[32768];int count;long size=0;while((count=input.read(buffer))!=-1){size+=count;if(size>128L*1024*1024)throw new IOException("文件超过保存上限");output.write(buffer,0,count);}}
                String header=connection.getHeaderField("Content-Disposition");String name=URLUtil.guessFileName(url,header!=null?header:disposition,mime);
                if(header!=null){java.util.regex.Matcher match=java.util.regex.Pattern.compile("filename\\*=UTF-8''([^;]+)",java.util.regex.Pattern.CASE_INSENSITIVE).matcher(header);if(match.find())name=java.net.URLDecoder.decode(match.group(1),"UTF-8");}
                name=new File(name.replace('\\','/')).getName();final String filename=name;final File ready=file;file=null;
                handler.post(()->{downloading=false;if(destroyed){ready.delete();return;}pendingDownload=ready;fileStatus("picker-open","bytes="+ready.length());try{startActivityForResult(new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION).setType(mime!=null?mime:"application/octet-stream").putExtra(Intent.EXTRA_TITLE,filename),3);}catch(Exception error){pendingDownload=null;ready.delete();fileStatus("picker-error",error.getMessage());toast("无法打开系统保存窗口");}});
            }catch(Exception error){fileStatus("download-error",error.getClass().getSimpleName()+": "+error.getMessage());handler.post(()->{downloading=false;toast("保存准备失败："+error.getMessage());});}
            finally{if(connection!=null)connection.disconnect();if(file!=null)file.delete();}
        },"DownloadDocument").start();
    }
    private void handleBack() { if(fullscreen!=null)hideFullscreen();else if (web.canGoBack()) web.goBack(); else finish(); }
    @Override protected void onResume(){super.onResume();foreground=true;}
    @Override protected void onPause(){foreground=false;super.onPause();}
    @Override public void onConfigurationChanged(android.content.res.Configuration configuration) {
        super.onConfigurationChanged(configuration);
        // Keep the live WebView and TTS bridge when rotating or resizing the window.
        // Android resizes the view tree; update cutout/system-bar padding without loading a URL.
        if (layout != null) layout.requestApplyInsets();
    }
    // Android 13+ uses the registered platform callback; this is the legacy fallback.
    @android.annotation.SuppressLint("GestureBackNavigation")
    @Override public void onBackPressed() { handleBack(); }
    @Override protected void onDestroy() { destroyed=true;foreground=false;if(systemTts!=null)systemTts.close();handler.removeCallbacksAndMessages(null); if (chooser!=null) chooser.onReceiveValue(null);denyMedia();if(mediaDialog!=null)mediaDialog.dismiss();if(pendingDownload!=null)pendingDownload.delete();hideFullscreen();web.destroy();super.onDestroy(); }
}
