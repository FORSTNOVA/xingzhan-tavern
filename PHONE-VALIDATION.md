# 一加 13T 真机验证

完整聊天流程更新：不锁屏验证的六项检查已通过，覆盖真实聊天发送、流式显示、停止上游、亮屏后台 45 秒、保存与重读。使用独立测试角色和本地模拟模型，原连接设置已在内存及文件中恢复，详见 [CHAT-UI-VALIDATION.md](CHAT-UI-VALIDATION.md)。

最新更新：用户开启“完全允许后台行为”后，默认无唤醒锁版本后台复测通过。延长锁屏约 100 秒期间，后端完成 120/120，内置 WebView 完整接收 90/90，原网页返回后仍保有结果。用户设置已保留。详见 [BACKGROUND-ALLOWED-VALIDATION.md](BACKGROUND-ALLOWED-VALIDATION.md)。

更新：用户已允许恢复后台测试，三组对照已完成。默认版和五分钟唤醒锁版均停止推进；加入临时单应用电池优化豁免后收齐 90/90 流式片段，但后台计时仍间歇暂停。详见 [BACKGROUND-VALIDATION.md](BACKGROUND-VALIDATION.md)。此前“暂停/尚未安装”的描述是早期记录，当前已测试包含界面修复的 `tavern-probe-clean-ui-wakelock.apk`，测后恢复默认无唤醒锁版与原电池优化设置。

日期：2026-10-02。用户提供机型一加 13T、安卓 16；设备报告型号 PKX110、Android 16、arm64-v8a、4 KB 页面。

## 已通过

- 安装并启动原版验证 APK。
- 完整 SillyTavern 1.19.0 服务，内嵌 Node 24.21.0（arm64）。
- HTML、设置、角色列表、CSRF 校验。
- PNG 角色卡导入、列表读取和删除。
- 实际酒馆接口代理模拟模型：普通生成和短流式生成。
- 客户端断开时上游取消：已复现，APK 集成未改变该逻辑。

证据：`artifacts/phone-smoke.json`。

## 已发现的息屏问题

在 USB 充电连接下启动两分钟后台任务，然后回到桌面、息屏。系统报告 `mWakefulness=Dozing`，前台服务 `isForeground=true`。之后本地 HTTP 超时；通过 `run-as` 直接读取文件，任务停留在 `count=10`、`running=true`。多次检查仍为同一数值，应用 PID 始终为 32071。

这是后台执行停止推进的证据，**不属于已证实的进程被杀**。冻结、调度或其他厂商限制的具体原因尚未查明。系统休眠诊断报告充电中，deviceidle 深度与轻度状态均为 ACTIVE，不能直接归因于标准 Android 深度 Doze。

证据：`artifacts/phone-background-start.json`、`artifacts/phone-background-paused.json`。外部一分钟 SSE 测试在取得 CSRF 时即连接失败，不能据此判定模型 SSE 转发失败。

## 已准备的对照版本

`artifacts/tavern-probe-wakelock.apk` 已编译并通过 Android lint，尚未安装到真机。

该版本在服务启动时持有 PARTIAL_WAKE_LOCK，最多五分钟，超时或服务销毁后释放。用于对比屏幕关闭后的任务推进情况，尚不能宣称解决问题。默认构建不启用：

```powershell
.\gradlew.bat --no-daemon -PprobeWakeLock=true assembleDebug lintDebug
```

正式实现应按生成任务持有和释放锁，不能永久保持 CPU 唤醒。

## 待完成

1. 锁屏测试已按用户要求暂停，不再切后台或主动息屏。
2. 限时唤醒锁 APK 保留待测，未安装到真机。
3. 必要时再对比用户允许后台运行、关闭该应用的电池优化等机型设置。
4. USB 测试不等于电池供电测试；发热和续航仍未进行可对比测量。

本轮未修改系统电池优化或 Doze 配置，没有持有无限时唤醒锁，也未使用用户 API 密钥或调用收费模型。

## 解锁后的恢复检查

用户解锁并要求先停止锁屏验证。恢复应用到前台之前，持久化任务文件仍为 10 个片段；将原 Activity 带到前台后，本地 HTTP 立即恢复，任务从 11 个片段继续增长。Node PID 保持 32071，未重启应用或服务。

这支持“应用后台执行暂停、回到前台恢复”的判断，具体厂商机制仍需进一步诊断。仅解锁的情况与前台恢复之间时间很短，不能据此严格区分两者的独立作用。

前台下再次验证了设置、角色卡、普通和短流式生成接口，全部通过。证据：`artifacts/phone-after-unlock.json`、`artifacts/phone-foreground-smoke.json`。本轮不再进行新的锁屏或电池优化设置测试。

一分钟连续流式代理也通过：60/60 片段，收到 DONE，耗时约 60.5 秒。使用的是酒馆实际接口、免费模拟上游及电脑端持续连接的客户端，证明前台后端长流转发可运行，不代表 WebView 的完整聊天流程或断线续传。证据：`artifacts/phone-foreground-stream.json`。

## TavernMark 跑分卡

已修复原生 WebView 对 blob 子页面的误拦截、打开网页时的焦点问题，并在 Activity 可见时保持亮屏。修复版已安装，标准模式 7/7 项有效完成，约 131 秒、综合 560 分。S0 未校准，不入正式榜单；角色卡及阈值未修改。详见 [BENCHMARK-VALIDATION.md](BENCHMARK-VALIDATION.md)，最新 APK 为 `artifacts/tavern-probe-iframe-fixed.apk`。本轮没有继续锁屏测试。
