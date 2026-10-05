# 首轮验证结果

验证日期：2026-10-02（北京时间）。

结论：**单 APK 内嵌完整酒馆后端与 WebView 的路线可以运行，值得继续。**当前通过的是模拟器基础验证；厂商保活、深度休眠和发热尚未验证。

## 环境

- 本机已有 Android Studio、JBR 21、SDK 36、NDK 27.2、CMake 3.22.1。
- 已有 Medium_Phone 模拟器：Android 17，x86_64，16 KB 页面。
- APK 包含 arm64-v8a 和 x86_64 原生库；arm64 已编译，尚未在真机运行。
- SillyTavern 1.19.0：`06bde939fb1e9c4c8d8641d810f0a916b5bce127`。
- 社区内嵌 Node 构建：24.21.0 / mobile 24.21.0-0。
- APK 约 175 MiB，当前保留完整酒馆资源。

## 通过的检查

| 检查 | 结果 |
|---|---|
| APK 编译、模拟器安装和启动 | 通过 |
| Android lint | 0 错误，保留常规警告 |
| Node 运行位置 | 与原生外壳同一进程；WebView 渲染器独立进程 |
| 完整酒馆服务及首页 | HTTP 200；首次使用页面及主界面可显示 |
| 用户设置、角色列表 | 接口通过 |
| CSRF 校验 | 缺少令牌的写请求返回 403 |
| PNG 角色卡 | 安卓内导入、列表读取、删除通过 |
| 普通生成 | 酒馆实际生成接口 → 本机模拟模型，回复正确 |
| 流式生成 | 酒馆实际接口转发 SSE，收到片段和 DONE |
| 两分钟后台息屏任务 | 120/120 片段，完成并写入文件 |
| 重启后的测试结果读取 | 安装新版 APK 重启后，已完成任务仍可读取 |

息屏检查时系统报告 `mWakefulness=Asleep`，本地服务报告 `isForeground=true`。这项检查使用原型验证页的后台任务，不能等同于真实模型请求的断线恢复，也不能推导真实手机温度或电量。

## 已实测的限制

测试主动中断客户端流式连接，模拟模型端观察到了上游请求被关闭。与上游源码中的 socket close → AbortController 逻辑一致。**当前 APK 尚不能保证 WebView 被回收之后实际模型生成继续。**下一阶段应修改酒馆请求链路，增加后端生成任务、结果保存与重连。

原型采用 Node 与外壳共享进程，减少 Termux shell 子进程，但 Node 致命退出也会影响整个应用。自动更新、回滚、唤醒锁和完整文件下载尚未实现。

## 原始证据

- `artifacts/smoke.json`：实际接口及断开测试结果。
- `artifacts/background-start.json`、`artifacts/background-result.json`：息屏任务的开始和完成状态。
- `artifacts/tavern-main.png`：WebView 酒馆主界面截图。
- `app/build/reports/lint-results-debug.html`：安卓静态检查结果。
- `artifacts/tavern-probe.apk`：本轮生成的开发验证 APK。

## 下一步真机验证

USB 连接，开启 USB 调试并允许电脑访问，然后检查手机型号、安卓版本及 ABI。安装验证 APK，测试应用切后台、息屏、锁屏、内存压力、实际模型生成、文件选择以及长聊天耗电。未经真机测试不承诺保活或降温改善。
