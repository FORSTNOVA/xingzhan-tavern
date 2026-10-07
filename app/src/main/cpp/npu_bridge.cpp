#include <jni.h>
#include <dlfcn.h>
#include <string>

namespace {
struct LoadResult {
    bool loaded;
    std::string error;
};

LoadResult canLoad(const std::string& directory, const char* library) {
    const std::string path = directory + "/" + library;
    dlerror();
    void* handle = dlopen(path.c_str(), RTLD_NOW | RTLD_LOCAL);
    if (!handle) {
        const char* error = dlerror();
        return {false, error ? error : "dlopen failed"};
    }
    dlclose(handle);
    return {true, ""};
}
}

extern "C" JNIEXPORT jstring JNICALL
Java_cn_jiuguan_probe_LocalNpuBridge_getStatusJson(JNIEnv* env, jclass, jstring runtimeDirectory) {
    const char* chars = runtimeDirectory ? env->GetStringUTFChars(runtimeDirectory, nullptr) : nullptr;
    const std::string directory = chars ? chars : "";
    const LoadResult qnnSystem = directory.empty() ? LoadResult{false, "runtime directory unavailable"} : canLoad(directory, "libQnnSystem.so");
    const LoadResult qnnHtp = directory.empty() ? LoadResult{false, "runtime directory unavailable"} : canLoad(directory, "libQnnHtp.so");
    if (chars) env->ReleaseStringUTFChars(runtimeDirectory, chars);
    const bool runtimeLoadable = qnnHtp.loaded && qnnSystem.loaded;

    std::string json = "{\"bridge\":\"tavern-npu-jni\",\"abi\":\"arm64-v8a\",\"runtimeDirectoryAvailable\":";
    json += directory.empty() ? "false" : "true";
    json += ",\"qnnHtpLoadable\":";
    json += qnnHtp.loaded ? "true" : "false";
    json += ",\"qnnHtpError\":\"" + qnnHtp.error + "\"";
    json += ",\"qnnSystemLoadable\":";
    json += qnnSystem.loaded ? "true" : "false";
    json += ",\"qnnSystemError\":\"" + qnnSystem.error + "\"";
    json += ",\"runtimeLoadable\":";
    json += runtimeLoadable ? "true" : "false";
    json += ",\"engineIntegrated\":false,\"ready\":false,\"stage\":\"runtime-probe\"}";
    return env->NewStringUTF(json.c_str());
}
