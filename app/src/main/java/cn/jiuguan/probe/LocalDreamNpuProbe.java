package cn.jiuguan.probe;

import android.content.Context;
import android.util.Log;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/** Opt-in device smoke test for the packaged Local Dream native helper. */
final class LocalDreamNpuProbe {
    private static final String ARCHIVE_NAME = "AnythingV5_qnn2.28_8gen2.zip";
    private static final String MODEL_PREFIX = "output_512/qnn_models_8gen2/";
    private static final int PORT = 18081;
    private static final long MAX_MODEL_BYTES = 1_500_000_000L;
    private static final Map<String, Long> MODEL_FILES = new HashMap<>();

    static {
        MODEL_FILES.put("tokenizer.json", 3_642_034L);
        MODEL_FILES.put("clip_v2.mnn", 156_316_304L);
        MODEL_FILES.put("pos_emb.bin", 236_544L);
        MODEL_FILES.put("token_emb.bin", 75_890_688L);
        MODEL_FILES.put("vae_encoder.bin", 41_438_176L);
        MODEL_FILES.put("vae_decoder.bin", 59_949_944L);
        MODEL_FILES.put("unet.bin", 880_553_304L);
        MODEL_FILES.put("512x768.patch", 6_078_801L);
        MODEL_FILES.put("768x512.patch", 6_170_339L);
        MODEL_FILES.put("768.patch", 15_295_689L);
        MODEL_FILES.put("768x1024.patch", 16_091_299L);
        MODEL_FILES.put("1024x768.patch", 15_701_108L);
        MODEL_FILES.put("1024.patch", 23_185_829L);
    }

    private LocalDreamNpuProbe() {}

    static final class Result {
        final Process process;
        final String json;
        Result(Process process, String json) { this.process = process; this.json = json; }
    }

    static Result start(Context context, File runtimeDirectory) {
        Process process = null;
        JSONObject status = new JSONObject();
        try {
            File importDirectory = context.getExternalFilesDir("npu-import");
            if (importDirectory == null) throw new IllegalStateException("External app storage unavailable");
            if (!importDirectory.isDirectory() && !importDirectory.mkdirs()) throw new IllegalStateException("Cannot create model import directory");
            File archive = new File(importDirectory, ARCHIVE_NAME);
            status.put("archive", archive.getAbsolutePath());
            if (!archive.isFile()) {
                status.put("started", false);
                status.put("reason", "model-archive-not-present");
                return new Result(null, status.toString());
            }

            File modelDirectory = new File(context.getExternalFilesDir("npu-models"), "anythingv5-qnn-8gen2");
            importModel(archive, modelDirectory);
            status.put("modelDirectory", modelDirectory.getAbsolutePath());

            File executable = new File(context.getApplicationInfo().nativeLibraryDir, "libstable_diffusion_core.so");
            if (!executable.isFile()) throw new IllegalStateException("Local Dream native helper not packaged");
            if (runtimeDirectory == null || !runtimeDirectory.isDirectory()) throw new IllegalStateException("Matching QNN runtime not staged");

            ProcessBuilder builder = new ProcessBuilder(
                executable.getAbsolutePath(), "--type", "sd15npu", "--model_dir", modelDirectory.getAbsolutePath(),
                "--lib_dir", runtimeDirectory.getAbsolutePath(), "--port", Integer.toString(PORT));
            builder.directory(new File(context.getApplicationInfo().nativeLibraryDir));
            builder.redirectErrorStream(true);
            builder.environment().put("LD_LIBRARY_PATH", context.getApplicationInfo().nativeLibraryDir + ":/system/lib64:/vendor/lib64:/vendor/lib64/egl");
            builder.environment().put("DSP_LIBRARY_PATH", runtimeDirectory.getAbsolutePath());
            process = builder.start();
            final Process logProcess = process;
            Thread logReader = new Thread(() -> {
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(logProcess.getInputStream(), StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) Log.i("TavernNpuEngine", line);
                } catch (Exception error) {
                    Log.w("TavernNpuEngine", "helper log stream ended", error);
                }
            }, "LocalDreamNpuLogs");
            logReader.setDaemon(true);
            logReader.start();

            boolean healthy = waitForHealth(process);
            status.put("started", true);
            status.put("port", PORT);
            status.put("health", healthy);
            status.put("engineReady", healthy);
            if (!healthy) {
                status.put("reason", process.isAlive() ? "health-timeout" : "helper-exited-" + process.exitValue());
                process.destroyForcibly();
                process = null;
            }
        } catch (Exception error) {
            try { status.put("started", false); status.put("reason", error.getClass().getSimpleName() + ": " + error.getMessage()); }
            catch (Exception ignored) {}
            if (process != null && process.isAlive()) process.destroyForcibly();
            process = null;
        }
        return new Result(process, status.toString());
    }

    private static void importModel(File archive, File modelDirectory) throws Exception {
        if (!modelDirectory.isDirectory() && !modelDirectory.mkdirs()) throw new IllegalStateException("Cannot create model directory");
        File marker = new File(modelDirectory, ".import-complete");
        String markerValue = archive.length() + ":" + archive.lastModified();
        if (marker.isFile() && markerValue.equals(readText(marker)) && modelFilesComplete(modelDirectory)) return;

        long expectedTotal = 0;
        for (long size : MODEL_FILES.values()) expectedTotal += size;
        if (expectedTotal > MAX_MODEL_BYTES) throw new IllegalStateException("Model archive exceeds import size limit");
        try (ZipFile zip = new ZipFile(archive)) {
            long copiedTotal = 0;
            for (Map.Entry<String, Long> item : MODEL_FILES.entrySet()) {
                String name = item.getKey();
                ZipEntry entry = zip.getEntry(MODEL_PREFIX + name);
                if (entry == null || entry.isDirectory() || entry.getSize() != item.getValue()) throw new IllegalStateException("Missing or unexpected model file: " + name);
                File output = new File(modelDirectory, name);
                File temporary = new File(modelDirectory, name + ".part");
                try (InputStream input = zip.getInputStream(entry); OutputStream stream = new FileOutputStream(temporary)) {
                    byte[] buffer = new byte[128 * 1024];
                    int count;
                    while ((count = input.read(buffer)) != -1) {
                        stream.write(buffer, 0, count);
                        copiedTotal += count;
                        if (copiedTotal > MAX_MODEL_BYTES) throw new IllegalStateException("Model archive exceeds import size limit");
                    }
                    if (temporary.length() != item.getValue()) throw new IllegalStateException("Model file size mismatch: " + name);
                    stream.flush();
                    if (stream instanceof FileOutputStream) ((FileOutputStream) stream).getFD().sync();
                }
                if (output.exists() && !output.delete()) throw new IllegalStateException("Cannot replace model file: " + name);
                if (!temporary.renameTo(output)) throw new IllegalStateException("Cannot install model file: " + name);
                Log.i("TavernNpuEngine", "model-import file=" + name + " bytes=" + output.length());
            }
        }
        try (FileOutputStream stream = new FileOutputStream(marker)) {
            stream.write(markerValue.getBytes(StandardCharsets.UTF_8));
            stream.getFD().sync();
        }
    }

    private static boolean modelFilesComplete(File directory) {
        for (Map.Entry<String, Long> item : MODEL_FILES.entrySet()) {
            File file = new File(directory, item.getKey());
            if (!file.isFile() || file.length() != item.getValue()) return false;
        }
        return true;
    }

    private static String readText(File file) throws Exception {
        byte[] bytes = new byte[(int) Math.min(file.length(), 256)];
        try (InputStream input = new java.io.FileInputStream(file)) {
            int count = input.read(bytes);
            return new String(bytes, 0, Math.max(0, count), StandardCharsets.UTF_8);
        }
    }

    private static boolean waitForHealth(Process process) throws Exception {
        long deadline = android.os.SystemClock.elapsedRealtime() + TimeUnit.SECONDS.toMillis(150);
        while (android.os.SystemClock.elapsedRealtime() < deadline) {
            if (!process.isAlive()) return false;
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL("http://127.0.0.1:" + PORT + "/health").openConnection();
                connection.setConnectTimeout(1000);
                connection.setReadTimeout(1000);
                connection.setRequestMethod("GET");
                if (connection.getResponseCode() == 200) return true;
            } catch (Exception ignored) {
            } finally {
                if (connection != null) connection.disconnect();
            }
            Thread.sleep(500);
        }
        return false;
    }
}
