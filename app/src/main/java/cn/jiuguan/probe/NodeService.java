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
    private Process npuEngineProbe;
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
                long startupStartedAt = android.os.SystemClock.elapsedRealtime();
                File root = new File(getFilesDir(), "tavern");
                cleanupManagedNpuHelper(root, "startup-recovery");
                File marker = new File(root, ".ready-v1");
                if (!marker.exists()) {
                    long unpackStartedAt = android.os.SystemClock.elapsedRealtime();
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
                    Log.i("TavernStartup", "resource-unpack elapsedMs=" + (android.os.SystemClock.elapsedRealtime()-unpackStartedAt));
                } else {
                    Log.i("TavernStartup", "resource-unpack skipped=true");
                }
                long overlayStartedAt = android.os.SystemClock.elapsedRealtime();
                File boot = new File(root, "android-bootstrap.mjs");
                for(String name:new String[]{"android-bootstrap.mjs","android-updates.mjs","android-management.mjs","android-management.html","android-patches.mjs","android-git.mjs","android-routes.mjs","android-downloads.js","android-probe.html","android-media.mjs","localdream-codec.mjs","android-media-patches.mjs","android-characters.js","android-characters.version","xingzhan-synthesis-manifest.json","xingzhan-synthesis-index.js","xingzhan-synthesis-media.js","xingzhan-synthesis-style.css","xingzhan-synthesis-system.js","xingzhan-synthesis-kokoro-blend.js","xingzhan-synthesis-mascot.js","xingzhan-synthesis-mascot.png"}) {
                    try (InputStream in = getAssets().open(name); OutputStream out = new FileOutputStream(new File(root,name))) { byte[] buffer = new byte[32768]; int n; while ((n=in.read(buffer))>0) out.write(buffer,0,n); }
                }
                Log.i("TavernStartup", "android-assets-copy elapsedMs=" + (android.os.SystemClock.elapsedRealtime()-overlayStartedAt));
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
                long nativeStartedAt = android.os.SystemClock.elapsedRealtime();
                System.loadLibrary("node");
                System.loadLibrary("tavernbridge");
                try {
                    System.loadLibrary("tavernnpu");
                    LocalDreamRuntime.Result runtime = LocalDreamRuntime.stage(this);
                    Log.i("TavernNpu", "runtime-stage " + runtime.json);
                    String runtimePath = runtime.staged && runtime.directory != null
                        ? runtime.directory.getAbsolutePath() : "";
                    File npuDirectory = new File(root, ".android-npu");
                    if (!npuDirectory.isDirectory() && !npuDirectory.mkdirs()) throw new IOException("Cannot create NPU metadata directory");
                    org.json.JSONObject npuRuntime = new org.json.JSONObject();
                    File helper = new File(getApplicationInfo().nativeLibraryDir, "libstable_diffusion_core.so");
                    npuRuntime.put("helperPath", helper.isFile() ? helper.getAbsolutePath() : "");
                    npuRuntime.put("runtimeDirectory", runtimePath);
                    npuRuntime.put("runtimeStaged", runtime.staged);
                    npuRuntime.put("socModel", android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S
                        && android.os.Build.SOC_MODEL != null ? android.os.Build.SOC_MODEL : "");
                    File modelRoot = getExternalFilesDir("npu-models");
                    npuRuntime.put("modelRoot", modelRoot == null ? "" : modelRoot.getAbsolutePath());
                    try (FileOutputStream metadata = new FileOutputStream(new File(npuDirectory, "runtime.json"))) {
                        metadata.write(npuRuntime.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
                        metadata.getFD().sync();
                    }
                    Log.i("TavernNpu", "native-bridge " + LocalNpuBridge.getStatusJson(runtimePath));
                    Log.i("TavernNpu", "native-core-executable " + LocalDreamRuntime.probeCoreExecutable(this, runtime.directory));
                    if (BuildConfig.LOCAL_NPU_ENGINE_PROBE) {
                        LocalDreamNpuProbe.Result engineProbe = LocalDreamNpuProbe.start(this, runtime.directory);
                        npuEngineProbe = engineProbe.process;
                        Log.i("TavernNpuEngine", "engine-smoke " + engineProbe.json);
                    }
                } catch (Throwable npuError) {
                    Log.w("TavernNpu", "native-bridge unavailable", npuError);
                }
                Log.i("TavernStartup", "native-load elapsedMs=" + (android.os.SystemClock.elapsedRealtime()-nativeStartedAt) + " totalMs=" + (android.os.SystemClock.elapsedRealtime()-startupStartedAt));
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
    private void cleanupManagedNpuHelper(File root, String reason) {
        File marker = new File(new File(root, ".android-npu"), "helper.pid");
        if (!marker.isFile()) return;
        try {
            byte[] bytes;
            try (InputStream input = new FileInputStream(marker); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[512];
                int count;
                while ((count = input.read(buffer)) != -1 && output.size() < 4096) output.write(buffer, 0, count);
                bytes = output.toByteArray();
            }
            org.json.JSONObject record = new org.json.JSONObject(new String(bytes, java.nio.charset.StandardCharsets.UTF_8));
            int pid = record.optInt("pid", -1);
            File expected = new File(getApplicationInfo().nativeLibraryDir, "libstable_diffusion_core.so");
            if (pid > 0 && pid != android.os.Process.myPid() && expected.getAbsolutePath().equals(record.optString("helperPath"))) {
                File processDirectory = new File("/proc/" + pid);
                if (!processDirectory.isDirectory()) {
                    Log.i("TavernNpuEngine", "Managed helper already exited before " + reason + ", pid=" + pid);
                } else {
                String command;
                try (InputStream input = new FileInputStream(new File(processDirectory, "cmdline")); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                    byte[] buffer = new byte[512];
                    int count;
                    while ((count = input.read(buffer)) != -1 && output.size() < 4096) output.write(buffer, 0, count);
                    command = output.toString("UTF-8");
                }
                boolean sameUid = false;
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(new FileInputStream(new File(processDirectory, "status"))))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        if (line.startsWith("Uid:")) {
                            String[] values = line.substring(4).trim().split("\\s+");
                            sameUid = values.length > 0 && Integer.parseInt(values[0]) == android.os.Process.myUid();
                            break;
                        }
                    }
                }
                if (sameUid && command.contains(expected.getAbsolutePath())) {
                    android.os.Process.killProcess(pid);
                    Log.i("TavernNpuEngine", "Stopped managed helper during " + reason + ", pid=" + pid);
                }
                }
            }
        } catch (Exception error) {
            Log.w("TavernNpuEngine", "Managed helper cleanup failed during " + reason, error);
        } finally {
            if (!marker.delete() && marker.exists()) Log.w("TavernNpuEngine", "Could not remove stale NPU PID record");
        }
    }
    @Override public IBinder onBind(Intent intent) { return null; }
    @Override public void onDestroy() {
        if (npuEngineProbe != null && npuEngineProbe.isAlive()) npuEngineProbe.destroy();
        cleanupManagedNpuHelper(new File(getFilesDir(), "tavern"), "service-destroy");
        if (probeWakeLock != null && probeWakeLock.isHeld()) probeWakeLock.release();
        super.onDestroy();
    }
}
