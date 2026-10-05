# 一加 13T 后台与锁屏对照验证

**后续更新：** 用户开启系统“完全允许后台行为”后，默认无唤醒锁版复测通过：120/120 后台任务与 90/90 SSE；延长锁屏测试中 WebView 也完整收到 90/90。详见 [BACKGROUND-ALLOWED-VALIDATION.md](BACKGROUND-ALLOWED-VALIDATION.md)。下文保留此前设置下的失败对照，不代表当前配置的结果。

2026-10-02，用户允许恢复后台验证后，在 PKX110 / Android 16 上完成三组测试。应用为隐藏顶部工具栏的版本，Node 24.21.0、SillyTavern 1.19.0。手机 USB 充电连接电脑；没有模拟拔电、强制深度 Doze 或调用收费模型。

## 结论

**当前整合 APK 尚不能保证稳定后台生成。** 普通版本和限时唤醒锁版本均在回到桌面约六秒后停止推进；进程与前台服务仍存在。加入标准电池优化豁免后，实际酒馆 SSE 代理能收齐 90 个片段，但后台计时仍间歇停顿，流式片段出现最长约 13 秒的交付间隔。

| 对照 | 后台计时任务 | 实际酒馆 SSE 代理 | 结论 |
| --- | --- | --- | --- |
| 默认版本 | 第 26、46、72 秒均为 count=11 | 10/90，未收到 DONE，连接终止 | 未通过 |
| 五分钟 PARTIAL_WAKE_LOCK | 第 26、46 秒为 count=11；第 72 秒文件读取超时，随后亮屏仍为 11 | 10/90，未收到 DONE，连接终止 | 单加唤醒锁无效 |
| 唤醒锁 + 临时单应用电池优化豁免 | 第 26 秒为 15，第 46 秒为 19，第 72 秒为 25 | 90/90，收到 DONE，但最长交付间隔 13 秒 | 连接完成，后台执行仍不稳定 |

三组中应用 PID 各自保持一致，分别为 3749、23007、31547。`isForeground=true` 始终存在。返回前台后，同一任务继续推进，而非重新启动 Node。Android 标准进程冻结标记为 false，deviceidle 报告 ACTIVE，因此不能直接定性为标准 Doze、标准 cached-app freezer 或“进程被杀”。厂商电源代理/调度限制是待验证的解释，尚未定位具体机制。

唤醒锁前台有效；切后台后，系统电源记录出现提前 REL、有效 ACQ 状态消失；恢复前台后再次出现 ACQ，远早于代码的五分钟超时。标准 WAKE_LOCK app-op 为 allow，RUN_ANY_IN_BACKGROUND 为默认 allow。这些证据支持“系统对后台唤醒锁执行了额外管理”，不支持认为应用遗漏了 WAKE_LOCK 权限。

## 方法与边界

- 在后台启动每秒写文件一次、总计 120 次的后端自持有任务。直接读取应用私有文件采样，避免用网页定时器代表后端运行。
- 同时调用实际 `/api/backends/chat-completions/generate`，上游由电脑提供每秒一个片段、总计 90 个片段的免费模拟模型。手机通过 USB reverse 访问上游，电脑客户端通过 USB forward 访问酒馆。
- 前台约五秒后回桌面，约第 26 秒息屏，约第 72 秒采样后唤醒，再恢复应用到前台。安全锁屏由用户解锁；没有绕过锁屏认证。
- 第二组有一次 run-as 文件读取超时，导致后续阶段较其他组晚约 15 秒，报告保留实际时间，不能将超时直接当成进程死亡。
- 第一、二组在观察结束时，恢复后的任务为 88/120；第三组为 104/120，不能把恢复前台后的推进当作后台通过。前两组结束后重启服务进行下一组，因此原计时任务的最终完成不是本轮通过条件。
- 第三组后续在前台继续运行最终达到 120/120，证据为 `artifacts/background-exempt-after-foreground.json`，不改变后台阶段间歇暂停的判断。
- 90/90 完成仅证明电脑客户端持续连接条件下的实际酒馆代理完成；不证明 Android WebView 切后台后仍持续消费，也不证明断线自动续传。网页请求断开后，上游原有取消逻辑仍存在。

## 测后恢复

本轮电池优化豁免仅针对 `cn.jiuguan.probe`，测试前不在豁免列表。测试结束后移除临时豁免并恢复默认无唤醒锁的 `artifacts/tavern-probe-clean-ui.apk`。没有关闭整机 Doze、改变其他应用的后台策略或保留长期唤醒锁。

## 下一步实现方向

整合为一个安装包解决了前端和后端入口分离，但本机实验说明它不能自动免除后台限制。接下来需要定位一加的应用后台电源管理，并把生成改为后端任务：任务 ID、后台持续接收与保存、前端重连读取、显式取消。唤醒锁应跟随实际生成任务取得和释放，并设置上限；不能用永久保活代替任务恢复。

## 证据

- `scripts/phone-background-check.mjs`：可重复的分阶段测试。
- `artifacts/background-baseline.json`：默认版本。
- `artifacts/background-wakelock.json`：限时唤醒锁版本。
- `artifacts/background-wakelock-exempt.json`：唤醒锁与电池优化豁免版本。
- `artifacts/background-summary.json`：计时推进、PID、流式片段与最大交付间隔汇总。
- `artifacts/battery-exemption-before.txt`：本应用初始豁免列表为空。
- `artifacts/wakelock-system-observation.txt`：本应用的后台与唤醒锁观测。
- `artifacts/background-restored.json`：测后恢复检查。

限时对照 APK 是 `artifacts/tavern-probe-clean-ui-wakelock.apk`，仅用于对照，不作为后台问题已解决的发布版。
