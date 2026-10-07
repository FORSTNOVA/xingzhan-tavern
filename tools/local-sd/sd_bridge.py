#!/usr/bin/env python3
"""
星栈酒馆 (Xingzhan Tavern) - 移动端 SD.cpp 本地伴侣桥接服务
监听 127.0.0.1:8789，为酒馆提供标准的 SD WebUI (/sdapi/v1/txt2img) 及 OpenAI (/v1/images/generations) 协议。
底层调用本地编译的 stable-diffusion.cpp 二进制 (sd) 进行离线推理。
"""

import sys
import os
import json
import base64
import subprocess
import tempfile
import time
from http.server import HTTPServer, BaseHTTPRequestHandler

HOST = "127.0.0.1"
PORT = 8789

# 默认可执行文件与模型路径配置（可通过环境变量或当前目录覆盖）
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SD_BIN = os.environ.get("SD_BIN", os.path.join(SCRIPT_DIR, "sd"))
MODEL_PATH = os.environ.get("SD_MODEL", os.path.join(SCRIPT_DIR, "model.gguf"))
VAE_PATH = os.environ.get("SD_VAE", "")

class SdHandler(BaseHTTPRequestHandler):
    def _send_json(self, status, payload):
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, HEAD")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def do_HEAD(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

    def do_GET(self):
        if self.path in ("/", "/status", "/sdapi/v1/txt2img"):
            self._send_json(200, {
                "status": "online",
                "backend": "stable-diffusion.cpp",
                "model": os.path.basename(MODEL_PATH),
                "bin": os.path.basename(SD_BIN)
            })
        elif self.path == "/v1/models":
            self._send_json(200, {
                "data": [{"id": "local/sd-community-lcm", "object": "model"}]
            })
        else:
            self._send_json(404, {"error": "Not Found"})

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        raw_body = self.rfile.read(length) if length > 0 else b"{}"
        try:
            req = json.loads(raw_body.decode("utf-8"))
        except Exception:
            return self._send_json(400, {"error": "Invalid JSON body"})

        prompt = req.get("prompt", "").strip()
        if not prompt:
            return self._send_json(400, {"error": "Prompt cannot be empty"})

        # 参数提取与兼容
        negative = req.get("negative_prompt", "")
        steps = int(req.get("steps", 8))
        cfg_scale = float(req.get("cfg_scale", 1.8))
        width = int(req.get("width", 512))
        height = int(req.get("height", 512))

        # 处理 OpenAI /v1/images/generations 格式的 size="512x512"
        if "size" in req and isinstance(req["size"], str) and "x" in req["size"]:
            try:
                parts = req["size"].split("x")
                width = int(parts[0])
                height = int(parts[1])
            except Exception:
                pass

        # 检查二进制和模型文件
        if not os.path.exists(SD_BIN) or not os.path.isfile(SD_BIN):
            return self._send_json(500, {
                "error": f"找不到 sd 二进制执行文件: {SD_BIN}。请先编译或放置 sd 到此目录。"
            })
        if not os.path.exists(MODEL_PATH) or not os.path.isfile(MODEL_PATH):
            return self._send_json(500, {
                "error": f"找不到模型权重文件: {MODEL_PATH}。请先下载 GGUF 模型并命名为 model.gguf。"
            })

        print(f"\n[SD-Bridge] 收到生图请求: {width}x{height}, 采样步数: {steps}, CFG: {cfg_scale}")
        print(f"[SD-Bridge] Prompt: {prompt[:120]}...")

        # 生成输出文件
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp_out:
            out_file = tmp_out.name

        try:
            # 组织 sd.cpp 命令行参数
            # -m <model> -p <prompt> -n <neg> -W <width> -H <height> --steps <steps> --cfg-scale <cfg> -o <out>
            cmd = [
                SD_BIN,
                "-m", MODEL_PATH,
                "-p", prompt,
                "-W", str(width),
                "-H", str(height),
                "--steps", str(steps),
                "--cfg-scale", str(cfg_scale),
                "-o", out_file
            ]
            if negative:
                cmd.extend(["-n", negative])
            if VAE_PATH and os.path.exists(VAE_PATH):
                cmd.extend(["--vae", VAE_PATH])

            # 手机 CPU 线程优化 (建议 4~6 核心大核运行)
            threads = os.environ.get("SD_THREADS", "4")
            cmd.extend(["-t", threads])

            start_t = time.time()
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
            cost_t = time.time() - start_t

            if proc.returncode != 0:
                print(f"[SD-Bridge] 执行失败 (code={proc.returncode}):\n{proc.stderr}")
                return self._send_json(500, {
                    "error": f"sd.cpp 退出错误 ({proc.returncode}): {proc.stderr[-300:]}"
                })

            if not os.path.exists(out_file) or os.path.getsize(out_file) == 0:
                return self._send_json(500, {"error": "sd.cpp 未生成有效图片输出"})

            print(f"[SD-Bridge] 生图完成！耗时: {cost_t:.1f} 秒，图像大小: {os.path.getsize(out_file)} 字节")

            with open(out_file, "rb") as f:
                img_bytes = f.read()
                b64 = base64.b64encode(img_bytes).decode("ascii")

            # 响应对应的格式
            if self.path.startswith("/v1/images"):
                self._send_json(200, {
                    "created": int(time.time()),
                    "data": [{"b64_json": b64}]
                })
            else:
                self._send_json(200, {
                    "images": [b64],
                    "parameters": req,
                    "info": json.dumps({"prompt": prompt, "cost_time": cost_t})
                })
        except subprocess.TimeoutExpired:
            return self._send_json(504, {"error": "生图超时 (超过 180 秒)"})
        except Exception as e:
            return self._send_json(500, {"error": f"伴侣执行异常: {str(e)}"})
        finally:
            if os.path.exists(out_file):
                try:
                    os.unlink(out_file)
                except Exception:
                    pass

def main():
    print("=" * 60)
    print("  星栈酒馆移动端本地生图伴侣 (sd.cpp Bridge)")
    print(f"  监听地址: http://{HOST}:{PORT}")
    print(f"  推理程序: {SD_BIN} (存在: {os.path.exists(SD_BIN)})")
    print(f"  模型路径: {MODEL_PATH} (存在: {os.path.exists(MODEL_PATH)})")
    print("=" * 60)
    server = HTTPServer((HOST, PORT), SdHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n服务已停止")

if __name__ == "__main__":
    main()
