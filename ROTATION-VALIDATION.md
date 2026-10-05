# 横竖屏切换验收

日期：2026-10-04。修复版已覆盖安装到模拟器和 OnePlus 13T（Android 16），手机下载文件夹的 APK 已更新。

原因：MainActivity 没有声明处理方向和屏幕尺寸变化。旋转触发 Activity 重建，onDestroy 销毁 WebView 与系统语音桥，onCreate 新建页面并加载首页。

修复：主界面接管 orientation、screenSize、smallestScreenSize、screenLayout 配置变化；调用父类配置处理并重新申请系统栏/刘海边距。保留现有 WebView、页面运行环境、系统语音桥和任务回调，不调用 loadUrl。没有锁定屏幕方向。

旧版模拟器复现：竖屏转横屏后网页 timeOrigin 改变，页面标记及未保存输入丢失。修复后，两台设备分别经过横屏、竖屏、反向横屏、竖屏四次切换，实际视口方向均符合预期；timeOrigin、内存标记、只在页面中的未保存输入及持续运行的定时器均保留。测试完成后还原原输入和系统旋转设置。

这次验证的是系统方向配置变化下的页面连续性；未调用收费分析/语音接口，也未将运行中的真实远程生成或系统语音播放写成已实测。未测试系统杀进程后的恢复、字体/语言/深色模式变化或屏幕锁定。

证据：

- `scripts/test-rotation.mjs`
- `artifacts/rotation/emulator-5554-before.json`
- `artifacts/rotation/emulator-5554-after.json`
- `artifacts/rotation/ca168055-after.json`
