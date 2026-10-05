# 星栈酒馆 TTS 与 Gemini 生图转接层方案

> **历史方案，已被独立插件取代。** 此文记录最初把入口并入官方 TTS 与生图面板的设计，不能代表当前产品架构。当前插件说明见 [SYNTHESIS-PLUGIN.md](SYNTHESIS-PLUGIN.md)，上下文识别、音色记忆和情绪表现计划见 [SYNTHESIS-ROADMAP.md](SYNTHESIS-ROADMAP.md)，实际验证结果见 [RELAY-VALIDATION.md](RELAY-VALIDATION.md)。

## 目标

让手机上的酒馆通过用户自己的 New API `v1.0.0-rc.41` 调用 Gemini TTS 和生图。用户确认 **Gemini 3.1 生图模型在 AI Studio、Vertex AI 两种渠道的模型测试均正常**；Vertex 当前的兼容问题只影响 TTS/OpenAI 音频接口，本方案先让 TTS 走 AI Studio，生图验证两种渠道。New API 令牌由酒馆私有保存；调用经酒馆本地 Node 服务转发，浏览器不直接访问外部中转。聊天、生图提示词、音频和图片均沿用酒馆现有界面。

初始模型可填 `gemini-3.1-flash-tts-preview`、`gemini-3.1-flash-image` 和 `gemini-3-pro-image`；以各渠道映射后的实际模型 ID 为准。接口使用 Gemini 原生 `generateContent`，不是 Imagen `predict`。

## 架构

```text
酒馆 TTS / 生图界面
        │ 同源请求，使用现有登录态和 CSRF
        ▼
星栈酒馆本地 Gemini 适配路由
  ├─ 读取应用私有存储中的 New API 令牌与连接配置
  ├─ 将酒馆请求转为 Gemini generateContent
  └─ 把 inlineData 音频或图片转换为酒馆可播放、可保存的结果
        │ Authorization: Bearer <New API token>
        ▼
New API AI Studio / Vertex AI 渠道 → Gemini `generateContent` → Gemini
```

转接路由只接受环回地址上的酒馆自身请求，沿用酒馆会话、CSRF 和请求限制；不做代理开放转发，不在日志或报错中记录令牌。令牌放在服务端 secret store，浏览器设置只取得掩码状态。

首版复用酒馆的私密密钥存储，文件处于 Android 应用私有目录，未额外加密。渠道字段用于记录配置，实际渠道由 New API 的模型映射、令牌分组及路由决定。配置入口位于对应 TTS、生图面板。

## 实施阶段

### 1. 原生协议可行性门槛

用户已确认两种渠道的 Gemini 3.1 生图模型测试正常。实施时先复核各渠道公开模型映射，再分别验证 AI Studio 与 Vertex AI 对原生图片请求是否保留 `candidates[].content.parts[].inlineData`。TTS 只验证 AI Studio 渠道。记录 MIME 类型、音频/图片字节格式、错误码和模型映射；真实生成前确认测试数量和费用。

如果 New API 将音频或图片裁成只含文本的 OpenAI Chat Completion 响应，就停止酒馆集成，先研究 New API 是否有保留原生 Gemini 响应的路由或兼容补丁；不把不完整结果接进正式页面。

### 2. 共用设置与安全存储

在星栈酒馆管理页增加 Gemini 中转配置：渠道选择（AI Studio/Vertex）、中转基础地址、对外模型映射和连接状态。分别保存 TTS 与生图渠道配置，避免把 Vertex 的兼容限制误用于 AI Studio。New API 地址校验为 HTTPS（本机开发地址除外）；模型名校验格式与长度。New API 令牌通过已有私密密钥机制保存/删除，页面只显示是否已配置，不回显原值。

### 3. TTS 适配

新增独立 TTS 提供商，避免改变现有 `System`、`OpenAI Compatible` 设置。可配置模型、音色和朗读风格，加入中文 Gemini 音色列表、试听、刷新和播放取消。服务端把文字、音色、语言和风格转换为 Gemini `contents` 与 `generationConfig`，解析返回音频；统一转换为带正确 WAV 头或可直接播放的格式，再按酒馆现有接口返回。普通和分段朗读复用酒馆现有触发及角色音色映射。

### 4. 生图适配

在现有生图来源中增加 Gemini 原生选项，不挪用 Imagen 的设置或请求。第一版接收提示词与宽高比/清晰度选项，构造 Gemini `generateContent` 图像请求，解析响应中 `inlineData` 图片，规范成酒馆已有的图片结果结构，使聊天生图、保存及扩展工具调用走同一入口。Nano Banana 2 默认映射为 `gemini-3.1-flash-image`；模型可手动改为渠道实际开放名称。参考图编辑与多轮对话式编辑作为后续阶段。

### 5. 验证与打包

先对本地模拟 Gemini 响应验证文本转请求、音频 MIME/WAV 处理、图片 Base64 处理、超时/取消、认证失败与上游错误脱敏。再经用户配置的 AI Studio 渠道验证语音，并按用户选择经 AI Studio 和/或 Vertex AI 验证单张图片。回归原 TTS、生图、聊天、角色设置、梅花主题、APK 更新和回滚，构建新版后覆盖安装并保留旧数据；最终只保留新 APK，并同步至手机下载目录。

## 兼容性与限制

- 用户确认 Gemini 3.1 生图模型在 AI Studio 与 Vertex AI 渠道测试均正常；Vertex 的兼容限制针对 TTS/OpenAI 音频格式，不排除 Gemini 生图。
- `v1.0.0-rc.41` Vertex 适配器的 `ConvertAudioRequest` 返回 `not implemented`，不能走现有 OpenAI `/v1/audio/speech` TTS 代理。首版 TTS 走 AI Studio Gemini 原生路由。
- 同版 Gemini 图片适配器仅接受 `imagen` 前缀模型作为 OpenAI 图片请求；Nano Banana 使用原生 Gemini `generateContent`。
- 公开状态端点已确认用户站点运行 `v1.0.0-rc.41`；匿名 `/v1/models` 返回 401。用户确认两种渠道的 Gemini 3.1 生图模型测试正常；真实原生响应字节、具体对外模型映射及费用仍待集成验证。
- 不索取或记录用户令牌。真实模型调用可能收费，须在调用前约定测试数量与模型。

## 依据

- New API Vertex 适配器（`v1.0.0-rc.41`）：https://github.com/QuantumNous/new-api/blob/v1.0.0-rc.41/relay/channel/vertex/adaptor.go
- New API Gemini 适配器（`v1.0.0-rc.41`）：https://github.com/QuantumNous/new-api/blob/v1.0.0-rc.41/relay/channel/gemini/adaptor.go
- Gemini TTS：https://ai.google.dev/gemini-api/docs/speech-generation
- Gemini 3.1 Flash Image：https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-image
