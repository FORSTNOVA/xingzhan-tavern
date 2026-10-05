# New API 中转能力核对

核对日期：2026-10-03。先核对官方主分支，再按用户部署版本 `v1.0.0-rc.41` 核对版本标签源码。用户提供渠道类型为 Vertex AI，中转地址为 https://tingleis.dpdns.org/ 。本轮没有发送生成请求、调用模型或修改应用。

## 自建站点只读检查

- `GET https://tingleis.dpdns.org/api/status`：HTTP 200，`success=true`，公开版本为 `v1.0.0-rc.41`，与用户提供一致。
- 不带令牌访问 `GET https://tingleis.dpdns.org/v1/models`：HTTP 401，模型列表需要认证。这是预期保护，不代表接口故障。
- 没有读取后台渠道配置，没有获得令牌，未验证模型映射、用户分组、上游项目与区域权限，也未验证实际音频或图片生成。

## 对应版本的 Vertex AI 渠道结论

- `ConvertAudioRequest` 返回 `not implemented`。该版本内置 Vertex 渠道不能直接将酒馆 OpenAI Compatible TTS 请求转换为 Gemini TTS。
- `ConvertImageRequest` 委托 Gemini 适配器；其仅接受 `imagen` 开头模型。不能直接把 Nano Banana 模型放入 OpenAI 图片接口并期待内置适配器转换。
- `ConvertGeminiRequest` 委托 Gemini 原生转换；请求地址对普通 Gemini 模型选择 `generateContent`，对 Imagen 选择 `predict`。原生 Gemini 请求入口存在，Vertex 的原生返回也走 Gemini 原生处理函数。
- 因此客户端适配应优先考虑 `POST /v1beta/models/{对外模型名}:generateContent`，使用 New API 令牌。是否能生成仍取决于渠道配置、模型在 Vertex 的可用性、区域、授权及实际响应验证。

## 已核对的官方能力

- 原生 Gemini 路由：`POST /v1beta/models/{model}:generateContent`。官方音频文档说明支持 Gemini TTS，并使用 `generationConfig.responseModalities` 与 `speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName` 配置音频与音色。使用 New API 令牌进行 Bearer 认证。
- Gemini 渠道的 `ConvertAudioRequest` 当前返回 `not implemented`；因此不能据此认定该渠道能将 OpenAI `/v1/audio/speech` 请求转换为 Gemini TTS。
- 内置 Gemini 渠道的 `ConvertImageRequest` 只接受 `imagen` 开头的上游模型；不能据此认定其支持从 OpenAI 图片请求转换为 Nano Banana 系列。部署可能另有插件、补丁或适配服务，需要按实际版本核对。
- 原生 Gemini 路由可以作为语音和图片适配的候选方案；具体模型可用性、配置字段保留、音频及图片返回完整性仍需针对部署版本和实际服务验证。

## 尚待核对的信息

1. 是否有额外插件或自定义修改。
2. Vertex 渠道的非敏感配置（上游地址、项目区域、对外模型名及模型映射）。
3. 令牌能访问的模型列表与分组。令牌留在软件或本地配置，不需要在对话中提供。

## 后续验证顺序

先读取公开状态和核对版本源码；再在令牌配置到本地后读取模型列表，核对分组与模型权限。模型列表中出现模型不等同于生成可用。最后单独确认少量真实语音、生图测试的范围；此前不发送生成请求。

## 来源

- https://github.com/QuantumNous/new-api/blob/main/relay/channel/gemini/adaptor.go
- https://github.com/QuantumNous/new-api/blob/main/router/relay-router.go
- https://docs.newapi.pro/zh/docs/api/ai-model/audio/geminirelayv1beta-383836364
- https://github.com/QuantumNous/new-api/blob/v1.0.0-rc.41/relay/channel/vertex/adaptor.go
- https://github.com/QuantumNous/new-api/blob/v1.0.0-rc.41/relay/channel/gemini/adaptor.go
- https://github.com/QuantumNous/new-api/blob/v1.0.0-rc.41/router/relay-router.go
