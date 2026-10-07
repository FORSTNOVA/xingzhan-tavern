package cn.jiuguan.probe;

/** Native runtime probe for the future in-process Snapdragon NPU engine. */
public final class LocalNpuBridge {
    private LocalNpuBridge() {}

    public static native String getStatusJson(String runtimeDirectory);
}
