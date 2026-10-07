cmake_minimum_required(VERSION 3.22.1)
project(tavernbridge)
set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
add_library(node SHARED IMPORTED)
set_target_properties(node PROPERTIES IMPORTED_LOCATION "${CMAKE_CURRENT_SOURCE_DIR}/../../../../runtime/node24/bin/${ANDROID_ABI}/libnode.so")
add_library(tavernbridge SHARED bridge.cpp)
target_include_directories(tavernbridge PRIVATE "${CMAKE_CURRENT_SOURCE_DIR}/../../../../runtime/node24/include/node")
target_link_options(tavernbridge PRIVATE "-Wl,-z,max-page-size=16384")
target_link_libraries(tavernbridge node android log)

# Keep the image inference bridge independent from the embedded Node runtime.
# Local Dream's core is a native executable helper (not a JNI library); Gradle
# stages that exact arm64 helper into jniLibs when a local APK is supplied.
# This JNI target probes QNN runtime loadability and remains the future direct
# in-process adapter boundary.
add_library(tavernnpu SHARED npu_bridge.cpp)
target_link_options(tavernnpu PRIVATE "-Wl,-z,max-page-size=16384")
target_link_libraries(tavernnpu android log dl)
