# 星栈酒馆 - 手机本地部署生图构建方案与伴侣服务

本目录只保留伴侣服务源码与说明。模型、编译目录、可执行文件和下载的第三方源码均是本机资产，已由仓库 `.gitignore` 排除。开发/真机验收脚本集中在 [scripts/local-sd](../../scripts/local-sd/README.md)，当前问题与处理记录见 [本地 SD 交接文档](../../LOCAL-SD-HANDOFF.md)。

本方案为星栈酒馆提供**完全离线、无内部审核、手机本地硬件加速**的 AI 绘图能力。

---

## 一、推荐社区微调模型选型 (GGUF 格式)

在移动端部署（如骁龙 8 系芯片），核心目标是**出图质量高 + 无审核 + 极速出图（<15秒）**。
强烈推荐采用集成 **LCM (Latent Consistency Model)** 技术的 SD 1.5 社区微调底模，只需 **6 ~ 8 步采样** 即可成图，内存占用约 1.6GB ~ 1.9GB。

### 1. 二次元角色 / 动漫立绘首选：`GhostMix (LCM 微调版)`
* **特点**：国内二次元与写实动漫社区最成熟的底模之一。人体结构稳定、面部神态精致、发丝光影极佳，**无任何内容审查限制**。
* **推荐量化档位**：`Q4_0` 或 `Q5_K` GGUF。
* **下载与转换源**：
  * HuggingFace 检索：`GhostMix-v2.0` / Civitai 模型 ID `36520`
  * 配合 LCM-LoRA 或直接使用预融合 LCM 的 Checkpoint
* **推荐生成参数**：
  * 采样步数 (Steps)：`6 ~ 8`
  * 引导系数 (CFG Scale)：`1.5 ~ 2.0`（LCM 模型 CFG 需调小，否则画面过饱和）
  * 默认尺寸：`512x512` 或 `448x576` (3:4)

### 2. 通用 / 写实 / 2.5D 角色首选：`DreamShaper 8 (LCM 内置版)`
* **特点**：全能型模型，擅长真实质感、魔幻古风、赛博朋克与角色立绘，同样无审核。
* **官方蒸馏 GGUF**：`SimianLuo/LCM_Dreamshaper_v7` 或 `DreamShaper-8-LCM`
* **推荐生成参数**：
  * 采样步数 (Steps)：`4 ~ 8`
  * 引导系数 (CFG Scale)：`1.8 ~ 2.2`

---

## 二、部署运行架构

```
┌──────────────────────────────────────────────┐
│  星栈酒馆 Android App (cn.jiuguan.probe)     │
│  - 角色卡图片生成面板                          │
│  - 自动提示词生成与比例转换 (512x512 等)       │
└──────────────────────┬───────────────────────┘
                       │ HTTP: 127.0.0.1:8789
                       ▼
┌──────────────────────────────────────────────┐
│  手机本地伴侣服务 (tools/local-sd/sd_bridge.py)│
│  - 提供 /sdapi/v1/txt2img 兼容接口            │
│  - 接收提示词并调用本地 sd.cpp 进程             │
└──────────────────────┬───────────────────────┘
                       │ 命令行参数
                       ▼
┌──────────────────────────────────────────────┐
│  stable-diffusion.cpp 核心推理程序 (sd)        │
│  - Vulkan GPU 加速 / NEON CPU 矩阵加速         │
│  - 纯本地计算，无联网、无任何审核拦截         │
│  - 模型文件: model.gguf                        │
└──────────────────────────────────────────────┘
```

---

## 三、手机端（Termux）极速部署三步走

### 第 1 步：安装基础环境
在手机 Termux 终端中执行：
```bash
pkg update && pkg install git cmake clang python -y
```

### 第 2 步：编译 stable-diffusion.cpp (开启移动端 Vulkan 加速)
```bash
git clone --recursive https://github.com/leejet/stable-diffusion.cpp
cd stable-diffusion.cpp
mkdir build && cd build
# 启用 Vulkan GPU 加速（骁龙 Adreno 芯片可获得数倍性能提升）
cmake .. -DSD_VULKAN=ON
cmake --build . --config Release -j$(nproc)
# 将编译好的 sd 二进制复制到伴侣目录
cp bin/sd <项目路径>/tools/local-sd/sd
```

### 第 3 步：放入模型并启动
1. 将下载好的社区微调 GGUF 模型重命名为 `model.gguf` 放在 `tools/local-sd/` 目录下。
2. 赋予执行权限并启动伴侣：
```bash
cd tools/local-sd
chmod +x sd start_sd.sh
./start_sd.sh
```
看到控制台输出：
```
星栈酒馆移动端本地生图伴侣 (sd.cpp Bridge)
监听地址: http://127.0.0.1:8789
```
即表示本地引擎已就绪。

---

## 四、在星栈酒馆中使用

1. 打开星栈酒馆，展开 **“星栈多媒体合成”** 工作台；
2. 展开 **“图片生成设置”**，在 **“接入来源”** 下拉框中选择：
   👉 **`本地引擎（SD.cpp / 伴侣服务 / SD WebUI）`**；
3. 点击 **“检查连接与引擎状态”**，按钮下方将显示：
   `✓ 连接正常，模型在可用列表中`；
4. 点击 **“保存配置”**；
5. 在聊天界面点击“根据最新回复生成提示词”或输入自定义 Prompt，点击 **“生成图片”**，即可看到完全由手机本地硬件渲染的无审查精致立绘！
