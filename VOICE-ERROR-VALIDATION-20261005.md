# 实机语音调用错误验收（2026-10-05）

## 结果

OnePlus 13T / Android 16 上复现并修复了混合模式语音流程的两个问题。实机失败记录包含一个 Gemini 云端片段和一个 Sherpa 本地片段。

1. Sherpa 已生成的 WAV 被保存接口拒绝。混合模式和系统模式曾在送入 Android TTS 前把情绪文字（例如 `[angry]`）拼到台词正文前；安卓桥因此把带标签的全文写入音频元数据，而服务端按原片段正文核对，两者不相同，返回“系统音频与保存的配音安排不一致”。现在本地引擎只接收原台词，情绪继续映射到语速、音高和停顿。
2. 两段音频生成和保存成功后，记忆写入仍报“角色标识或音色格式不正确”。记忆接口只允许 ASCII 音色名，拒绝了 Sherpa 的合法显示名 `speaker-0: af_maple (女声) (女声·少女)`。现在允许最多 300 字、无控制字符的 Unicode 音色名称，并保留独立角色 ID 校验。

## 实机验证

修复版重建并安装后，在原失败记录上运行混合分工（Gemini + Sherpa）：云端 TTS 收到 HTTP 200，返回音频并保存；本地 Sherpa 片段也通过元数据校验并保存。两段均持久存在。

音色记忆修复版安装后再次打开记录，界面显示“全部 2 段已协同生成完成”；两段缓存完整，记忆库成功保存 2 位音色。复测时拦截并统计了语音生成入口，没有额外 API 请求，因此只复用了已生成音频。

自动接口回归 `scripts/test-synthesis-api.mjs` 通过，新增中文/标点音色名称的记忆保存测试。

## 调用与清理

本轮授权上限 10 次。手机端生成入口记录 7 次，其中 6 次止于本机临时转发调试链路，只有 1 次真正到达 New API 上游；该次状态 200。没有生图。失败转发请求没有拿到上游响应，不能算成生成结果。未自动重试上游限流。

实测临时改变过 TTS 地址，结束时已恢复 `https://tingleis.dpdns.org`；ADB 反向端口已移除，转发进程已停止。最新版 APK 已覆盖安装到手机，并更新到 Download/jiuguan-debug-20261004.apk。令牌和语音正文没有写入验收报告。

证据：

- `artifacts/tts-acceptance/real-device-tts-error-retest.json`：错误记录上的真实调用和两段音频状态。
- `artifacts/tts-acceptance/real-device-hybrid-cache-retest.json`：缓存复用、音色记忆保存、零额外 API 请求。
- `artifacts/tts-acceptance/tts-call-debug-20261005-budget.json`：手机端测试调用上限记录。
