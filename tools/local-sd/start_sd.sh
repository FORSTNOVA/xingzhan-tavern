#!/bin/bash
# ------------------------------------------------------------
# 星栈酒馆 - 移动端 SD 本地伴侣一键启动脚本
# 适用于 Termux 或 Android 运行环境
# ------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== 启动星栈酒馆本地 SD 伴侣服务 ==="

# 检查 Python 环境
if ! command -v python3 &> /dev/null; then
    echo "错误: 未检测到 python3，请在 Termux 中执行: pkg install python"
    exit 1
fi

# 检查执行程序
if [ ! -f "sd" ]; then
    echo "警告: 当前目录未找到 sd 编译二进制！"
    echo "请根据 README.md 编译或下载 aarch64 版本的 stable-diffusion.cpp 二进制"
fi

# 检查模型
if [ ! -f "model.gguf" ]; then
    echo "警告: 当前目录未找到 model.gguf！"
    echo "请下载推荐的社区微调模型（如 GhostMix-LCM 或 DreamShaper-8-LCM）并命名为 model.gguf"
fi

# 启动桥接服务 (监听 127.0.0.1:8789)
export SD_BIN="${SD_BIN:-$SCRIPT_DIR/sd}"
export SD_MODEL="${SD_MODEL:-$SCRIPT_DIR/model.gguf}"
export SD_THREADS="${SD_THREADS:-4}"

python3 sd_bridge.py
