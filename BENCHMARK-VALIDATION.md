# TavernMark 真机验证

2026-10-02，在已连接的一加 13T（PKX110，Android 16）上完成。使用手机原有 TavernMark 酒馆排位赛 v2.4.0 / S0 角色卡和酒馆助手 4.11.2，系统 WebView Chromium 152。USB 充电、应用保持前台，测试采样为 60 Hz。未进行锁屏验证。

## 问题及修复

截图中的“宿主底噪”失败是帧间隔 p95 22.4 ms 超过卡片 20 ms 的阈值；7% 主线程占用本身没有超过 10% 阈值。截图的首屏露出约 96% 也未达到完整露出的要求。将消息开头滚入屏幕、等待页面稳定并重新检测后通过，不需要修改跑分规则。最终开始前自检无警告或失败：首屏 100%、底噪占用 0.5%、帧间隔 p95 16.7 ms。

第一次完整运行进一步发现 APK 的实际兼容问题：WebView 导航处理拦截非 HTTP 地址，连跑分卡内部 blob 子页面也被取消，导致 iframe 挂载超时。流式、长聊、手感、美化四项无效；该次运行不能作为完整成绩。

修复只在原生外壳：仅对主页面导航应用外链处理，让子 iframe 正常导航；打开酒馆时让 WebView 获得焦点；Activity 可见时保持屏幕亮起。修复后 srcdoc 和 blob 页面都能加载及执行脚本。没有修改卡片、放宽阈值或调整系统刷新率，也没有安装后台唤醒锁对照版本。

最终 APK 已重新构建、通过 Android lint，并安装在真机。文件：[tavern-probe-iframe-fixed.apk](artifacts/tavern-probe-iframe-fixed.apk)。

## 标准模式结果

7/7 项全部有效完成，耗时约 131 秒。综合分 **560**，卡片显示 **荣耀黄金 II**，95% 区间 545–569。

| 项目 | 分数（四舍五入） |
| --- | ---: |
| 流式 | 609 |
| 长聊 | 530 |
| 手感 | 522 |
| 美化 | 426 |
| 规则 | 785 |
| 变量 | 498 |
| 算力 | 600 |

结果没有无效项目、噪声、中断或热降频标记。S0 卡片自身仍标注“基准未校准”，`ranked=false` 的唯一原因就是该项，属于本地内测参考成绩，不能称为正式入榜成绩。

相对较弱的是美化和长聊：`:has()` class 切换重算约 139.8 ms，长聊续写 tick 约 152.3 ms。这说明跑分兼容性已解决，但不能据此宣布发热、耗电或复杂聊天性能已经优化。短时探针未判降频也不代表长时间不发热。

卡片测试包含模拟流式和前端负载；没有连接收费模型、提交天梯或发送反馈。实际模型聊天、后台续传及锁屏保活仍需独立验证。

## 证据

- `artifacts/benchmark/preflight-after-fix.json`：运行前自检。
- `artifacts/benchmark/iframe-probe-before.json` / `iframe-probe-after.json`：iframe 修复前后。
- `artifacts/benchmark/standard-result-before-fix.json`：保留第一次不完整结果。
- `artifacts/benchmark/standard-result.json`：最终原始成绩及每项指标。
- `artifacts/benchmark/standard-result-text.txt`：完整页面结果文本。
- `artifacts/benchmark/completed-state.json`：最终停止运行状态与日志。
- `artifacts/benchmark/card-integrity.json`：原始卡片与结束后卡片的正则 SHA-256 及首条消息比较。
- `artifacts/benchmark/result-webview.png`：完成后的 WebView 截图。
