#include <jni.h>
#include <node.h>
#include <android/log.h>
#include <unistd.h>
#include <thread>
#include <string>
#include <vector>
#include <cstdlib>
#include <algorithm>

extern "C" JNIEXPORT jint JNICALL
Java_cn_jiuguan_probe_NodeService_startNode(JNIEnv* env, jclass, jstring script, jstring workingDir) {
    const char* scriptChars = env->GetStringUTFChars(script, nullptr);
    const char* dirChars = env->GetStringUTFChars(workingDir, nullptr);
    std::string entry(scriptChars), dir(dirChars);
    env->ReleaseStringUTFChars(script, scriptChars);
    env->ReleaseStringUTFChars(workingDir, dirChars);
    setenv("HOME", dir.c_str(), 1);
    setenv("TMPDIR", dir.c_str(), 1);
    setenv("NODE_ENV", "production", 1);
    chdir(dir.c_str());
    int fds[2];
    if (pipe(fds) == 0) {
        dup2(fds[1], STDOUT_FILENO);
        dup2(fds[1], STDERR_FILENO);
        close(fds[1]);
        std::thread([fd=fds[0]] {
            char buffer[1024]; ssize_t count;
            while ((count = read(fd, buffer, sizeof(buffer)-1)) > 0) {
                buffer[count] = 0;
                __android_log_write(ANDROID_LOG_INFO, "TavernNode", buffer);
            }
            close(fd);
        }).detach();
    }
    // Node needs writable, contiguous argv memory for process title setup.
    std::vector<char> args(5 + entry.size() + 1);
    std::copy_n("node", 5, args.data());
    std::copy(entry.begin(), entry.end(), args.begin()+5);
    args.back() = 0;
    char* argv[] = {args.data(), args.data()+5};
    return node::Start(2, argv);
}
