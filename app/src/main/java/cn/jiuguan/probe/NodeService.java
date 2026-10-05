package cn.jiuguan.probe;

import android.app.*;
import android.content.Intent;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;
import java.io.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.zip.*;

public class NodeService extends Service {
    private static final AtomicBoolean started = new AtomicBoolean();
    private PowerManager.WakeLock probeWakeLock;
    private static native int startNode(String script, String workingDir);
    @Override public void onCreate() {
        super.onCreate();
        // Controlled comparison only: default builds do not acquire this lock.
        // The probe lease expires after five minutes, including if the UI leaves.
        if (BuildConfig.WAKELOCK_PROBE) {
            probeWakeLock = getSystemService(PowerManager.class).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "TavernProbe:BackgroundComparison");
            probeWakeLock.setReferenceCounted(false);
            probeWakeLock.acquire(5 * 60 * 1000L);
            Log.i("TavernProbe", "Comparison wake lock acquired, maximum five minutes");
        }
        NotificationManager manager = getSystemService(NotificationManager.class);
        manager.createNotificationChannel(new NotificationChannel("server", getString(R.string.server_channel_name), NotificationManager.IMPORTANCE_LOW));
        int activityFlags = Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP;
        PendingIntent open = PendingIntent.getActivity(this, 0, new Intent(this, MainActivity.class).addFlags(activityFlags), PendingIntent.FLAG_IMMUTABLE);
        PendingIntent diagnostics = PendingIntent.getActivity(this, 1, new Intent(this, MainActivity.class)
            .setAction(MainActivity.ACTION_MAINTENANCE).addFlags(activityFlags), PendingIntent.FLAG_IMMUTABLE);
        PendingIntent performance = PendingIntent.getActivity(this, 2, new Intent(this, MainActivity.class)
            .setAction(MainActivity.ACTION_PERFORMANCE).addFlags(activityFlags), PendingIntent.FLAG_IMMUTABLE);
        startForeground(1, new Notification.Builder(this, "server").setContentTitle(getString(R.string.server_notification_title))
            .setContentText(getString(R.string.server_notification_text))
            .setSmallIcon(R.drawable.ic_launcher_monochrome).setContentIntent(open)
            .addAction(new Notification.Action.Builder(null, "管理与更新", diagnostics).build())
            .addAction(new Notification.Action.Builder(null, "流畅模式", performance).build())
            .setOngoing(true).build());
    }
    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (started.compareAndSet(false, true)) new Thread(() -> {
            try {
                File root = new File(getFilesDir(), "tavern");
                File marker = new File(root, ".ready-v1");
                if (!marker.exists()) {
                    root.mkdirs();
                    try (ZipInputStream zip = new ZipInputStream(getAssets().open("tavern.zip"))) {
                        ZipEntry entry; byte[] buffer = new byte[32768];
                        String safeRoot = root.getCanonicalPath() + File.separator;
                        while ((entry = zip.getNextEntry()) != null) {
                            File dest = new File(root, entry.getName());
                            if (!dest.getCanonicalPath().startsWith(safeRoot)) throw new IOException("Unsafe archive path");
                            if (entry.isDirectory()) { dest.mkdirs(); continue; }
                            dest.getParentFile().mkdirs();
                            try (OutputStream out = new FileOutputStream(dest)) { int n; while ((n = zip.read(buffer)) > 0) out.write(buffer, 0, n); }
                        }
                    }
                    marker.createNewFile();
                }
                File boot = new File(root, "android-bootstrap.mjs");
                for(String name:new String[]{"android-bootstrap.mjs","android-updates.mjs","android-management.mjs","android-management.html","android-patches.mjs","android-git.mjs","android-routes.mjs","android-downloads.js","android-probe.html","android-media.mjs","android-media-patches.mjs","xingzhan-synthesis-manifest.json","xingzhan-synthesis-index.js","xingzhan-synthesis-media.js","xingzhan-synthesis-style.css","xingzhan-synthesis-system.js"}) {
                    try (InputStream in = getAssets().open(name); OutputStream out = new FileOutputStream(new File(root,name))) { byte[] buffer = new byte[32768]; int n; while ((n=in.read(buffer))>0) out.write(buffer,0,n); }
                }
                File restartRequest=new File(root,".apk-restart-request");
                if(restartRequest.exists()&&!restartRequest.delete())throw new IOException("Cannot clear old restart request");
                new Thread(()->{
                    while(true){
                        try{Thread.sleep(1000);}catch(InterruptedException error){return;}
                        if(restartRequest.exists()&&MainActivity.foreground){
                            restartRequest.delete();
                            startActivity(new Intent(this,RestartActivity.class).putExtra("oldPid",android.os.Process.myPid()).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                            return;
                        }
                    }
                },"UpdateRecovery").start();
                System.loadLibrary("node");
                System.loadLibrary("tavernbridge");
                int result = startNode(boot.getAbsolutePath(), root.getAbsolutePath());
                Log.e("TavernProbe", "Node returned: " + result);
                recoverPendingUpdate(root,"更新程序退出，已恢复上一版本");
            } catch (Throwable e) {
                Log.e("TavernProbe", "Startup failed", e);
                try (PrintWriter out = new PrintWriter(new File(getFilesDir(), "startup-error.txt"))) { e.printStackTrace(out); } catch (Exception ignored) { }
            }
        }, "EmbeddedNode").start();
        return START_NOT_STICKY;
    }
    private void recoverPendingUpdate(File root,String message){
        try{
            File stateFile=new File(root,".apk-updates/state.json");
            String text;try(InputStream input=new FileInputStream(stateFile);ByteArrayOutputStream bytes=new ByteArrayOutputStream()){byte[] buffer=new byte[4096];int count;while((count=input.read(buffer))!=-1)bytes.write(buffer,0,count);text=bytes.toString("UTF-8");}
            org.json.JSONObject state=new org.json.JSONObject(text);if(state.isNull("pending")||!state.has("pending"))return;
            String previous=state.optString("previous","bundled");if(!previous.equals("bundled")&&!previous.matches("[a-f0-9]{40}"))previous="bundled";
            state.put("active",previous);state.put("pending",org.json.JSONObject.NULL);state.put("lastError",message);
            File temporary=new File(stateFile.getPath()+".tmp");try(OutputStream output=new FileOutputStream(temporary)){output.write(state.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));}
            if(!temporary.renameTo(stateFile))throw new IOException("Cannot restore update state");
            try(OutputStream output=new FileOutputStream(new File(root,".apk-restart-request"))){output.write("rollback".getBytes(java.nio.charset.StandardCharsets.UTF_8));}
        }catch(Exception error){Log.e("TavernProbe","Update recovery failed",error);}
    }
    @Override public IBinder onBind(Intent intent) { return null; }
    @Override public void onDestroy() {
        if (probeWakeLock != null && probeWakeLock.isHeld()) probeWakeLock.release();
        super.onDestroy();
    }
}
