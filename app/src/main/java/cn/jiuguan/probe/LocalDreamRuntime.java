package cn.jiuguan.probe;

import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/** Stages only the installed Local Dream runtime matching this phone's known SoC. */
final class LocalDreamRuntime {
    private static final String PACKAGE = "io.github.xororz.localdream";
    private static final String ASSET_ROOT = "assets/qnnlibs/";
    private static final Map<String, String> SOC_TO_HTP = new LinkedHashMap<>();

    static {
        SOC_TO_HTP.put("SM8750", "V79"); // Snapdragon 8 Elite / OnePlus 13T
    }

    static final class Result {
        final boolean staged;
        final File directory;
        final String json;

        Result(boolean staged, File directory, String json) {
            this.staged = staged;
            this.directory = directory;
            this.json = json;
        }
    }

    private LocalDreamRuntime() {}

    static Result stage(Context context) {
        JSONObject result = new JSONObject();
        File destination = null;
        try {
            String soc = Build.SOC_MODEL == null ? "" : Build.SOC_MODEL.trim().toUpperCase();
            String htpArch = SOC_TO_HTP.get(soc);
            result.put("sourcePackage", PACKAGE);
            result.put("socModel", soc);
            result.put("abi", Build.SUPPORTED_ABIS.length == 0 ? "unknown" : Build.SUPPORTED_ABIS[0]);
            if (htpArch == null) {
                result.put("staged", false);
                result.put("reason", "unsupported-soc");
                return new Result(false, null, result.toString());
            }

            PackageManager pm = context.getPackageManager();
            ApplicationInfo app = pm.getApplicationInfo(PACKAGE, 0);
            PackageInfo packageInfo = pm.getPackageInfo(PACKAGE, 0);
            String version = packageInfo.versionName == null ? "unknown" : packageInfo.versionName;
            result.put("sourceVersion", version);
            destination = new File(new File(context.getFilesDir(), "npu-runtime"), version + File.separator + htpArch);
            if (!destination.isDirectory() && !destination.mkdirs()) throw new IOException("Cannot create runtime directory");

            String[] names = {
                "libQnnSystem.so",
                "libQnnHtp.so",
                "libQnnHtp" + htpArch + ".so",
                "libQnnHtp" + htpArch + "Skel.so",
                "libQnnHtp" + htpArch + "Stub.so"
            };
            JSONArray stagedFiles = new JSONArray();
            long totalBytes = 0;
            try (ZipFile apk = new ZipFile(app.sourceDir)) {
                for (String name : names) {
                    ZipEntry entry = apk.getEntry(ASSET_ROOT + name);
                    if (entry == null || entry.isDirectory()) throw new IOException("Missing Local Dream asset: " + name);
                    File output = new File(destination, name);
                    if (!output.isFile() || output.length() != entry.getSize()) {
                        File temporary = new File(destination, name + ".part");
                        try (InputStream input = apk.getInputStream(entry); FileOutputStream stream = new FileOutputStream(temporary)) {
                            byte[] buffer = new byte[64 * 1024];
                            int count;
                            while ((count = input.read(buffer)) != -1) stream.write(buffer, 0, count);
                            stream.getFD().sync();
                        }
                        if (temporary.length() != entry.getSize()) throw new IOException("Runtime asset size mismatch: " + name);
                        if (output.exists() && !output.delete()) throw new IOException("Cannot replace runtime asset: " + name);
                        if (!temporary.renameTo(output)) throw new IOException("Cannot install runtime asset: " + name);
                    }
                    totalBytes += output.length();
                    stagedFiles.put(name);
                }
            }
            result.put("staged", true);
            result.put("htpArch", htpArch);
            result.put("directory", destination.getAbsolutePath());
            result.put("fileCount", stagedFiles.length());
            result.put("bytes", totalBytes);
            result.put("files", stagedFiles);
            result.put("distribution", "copied-from-installed-app;not-bundled-in-apk");
            return new Result(true, destination, result.toString());
        } catch (PackageManager.NameNotFoundException error) {
            try { result.put("staged", false); result.put("reason", "local-dream-not-installed"); }
            catch (Exception ignored) {}
            return new Result(false, null, result.toString());
        } catch (Exception error) {
            try { result.put("staged", false); result.put("reason", error.getClass().getSimpleName() + ": " + error.getMessage()); }
            catch (Exception ignored) {}
            return new Result(false, destination, result.toString());
        }
    }

    static String probeCoreExecutable(Context context, File runtimeDirectory) {
        JSONObject result = new JSONObject();
        Process process = null;
        try {
            File nativeDirectory = new File(context.getApplicationInfo().nativeLibraryDir);
            File executable = new File(nativeDirectory, "libstable_diffusion_core.so");
            result.put("packaged", executable.isFile());
            result.put("path", executable.getAbsolutePath());
            if (!executable.isFile()) {
                result.put("started", false);
                result.put("reason", "native-helper-not-packaged; provide -PlocalDreamApk at build time");
                return result.toString();
            }

            ProcessBuilder builder = new ProcessBuilder(executable.getAbsolutePath(), "--version");
            builder.directory(nativeDirectory);
            builder.redirectErrorStream(true);
            String systemLibraries = nativeDirectory.getAbsolutePath() + ":/system/lib64:/vendor/lib64:/vendor/lib64/egl";
            builder.environment().put("LD_LIBRARY_PATH", systemLibraries);
            if (runtimeDirectory != null) builder.environment().put("DSP_LIBRARY_PATH", runtimeDirectory.getAbsolutePath());
            process = builder.start();
            boolean exited = process.waitFor(10, TimeUnit.SECONDS);
            if (!exited) {
                process.destroyForcibly();
                result.put("started", true);
                result.put("timedOut", true);
                return result.toString();
            }
            StringBuilder output = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null && output.length() < 1000) {
                    if (output.length() > 0) output.append(' ');
                    output.append(line.trim());
                }
            }
            result.put("started", true);
            result.put("exitCode", process.exitValue());
            result.put("output", output.toString());
        } catch (Exception error) {
            try { result.put("started", false); result.put("reason", error.getClass().getSimpleName() + ": " + error.getMessage()); }
            catch (Exception ignored) {}
        } finally {
            if (process != null && process.isAlive()) process.destroyForcibly();
        }
        return result.toString();
    }
}
