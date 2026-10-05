# 星栈合成验证记录

本报告记录已完成的 APK 转接验证；现行功能说明见 [SYNTHESIS-PLUGIN.md](SYNTHESIS-PLUGIN.md)，未来上下文配音路线见 [SYNTHESIS-ROADMAP.md](SYNTHESIS-ROADMAP.md)。旧面板集成属于历史实现，不再作为当前入口。

## 当前真机配置

设备：一加 13T，Android 16。New API 地址 `https://tingleis.dpdns.org`。用户配置的模型别名：

- TTS：`gemini-3.8-flash-lite-tts`
- 生图：`gemini-3.1-flash-lite-image`

两个模型都曾出现在该令牌的 `/v1/models` 返回列表中。渠道和上游模型由 New API 配置决定；报告不推断别名背后的实际上游版本。令牌保存在用户应用私有数据中，不写入本报告。

## 已完成的真实中转样例

用户授权后，真机对每种功能各请求一次，均成功：

- TTS 短句生成 WAV，时长 11.24 秒，并在 WebView 播放至结束；生成与解码约 8.3 秒。
- 生图生成 1024×1024 JPEG，酒馆保存并可解码；生成与保存约 5.5 秒。

单次样例用于确认路由和播放、保存链路，不构成稳定时延或生成质量保证。结果文件在 `artifacts/relay/phone-live.json`、`phone-live-tts.wav`、`phone-live-image.jpg`。

## 独立插件验证

当前独立插件已覆盖安装真机，入口为「扩展 → 星栈合成」。确认过：

- 插件可单独加载；官方 TTS 与官方生图设置中没有合成插件入口或源码依赖。
- 更新后可读取原 TTS、生图模型和令牌配置，配置接口不回显令牌。
- 独立生图流程可接收比例、预览保存并响应停止。
- 选中文字朗读会先展示确认窗口；取消不发 TTS 请求；确认后只提交选中文字，播放完成及重复播放正常；停止可取消等待中的请求。
- 旧入口迁移只改受影响的选择项，保留其他酒馆设置和中转密钥；重复启动不会覆盖未更改的插件文件。

上述无费用的功能回归使用模拟响应。结果位于 `artifacts/relay/synthesis-phone.json`、`synthesis-emulator.json`、`selection-phone.json`、`patch-validation.json`。

## 后端模拟回归

12 项通过，覆盖 New API 请求格式、TTS PCM 转 WAV、图片解析、用户认证与 CSRF、错误脱敏、输入校验、客户端取消、上游取消及音色和比例参数。模拟器 WebView 9 项通过，覆盖扩展注册、设置读取、音频播放和酒馆生图保存流程。上游模拟生成不会产生模型费用。详情：`artifacts/relay/emulator-backend.json` 和 `emulator-browser.json`。

APK 构建与 Gradle 静态检查通过。最终 APK：`artifacts/xingzhan-tavern.apk`；独立扩展压缩包：`artifacts/xingzhan-synthesis.zip`。

## 范围

Gemini TTS 与生图通过 APK 自带的本地 Node 服务访问 New API；插件不能单独装到没有该接口的普通酒馆。用户上下文分析、持久化角色音色记忆、逐句情绪标注和多角色合成仍未开发，设计见 [SYNTHESIS-ROADMAP.md](SYNTHESIS-ROADMAP.md)。
