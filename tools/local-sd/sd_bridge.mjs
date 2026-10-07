#!/usr/bin/env node
/**
 * 星栈酒馆 (Xingzhan Tavern) - 移动端 SD.cpp 本地伴侣 (Node.js 原生版)
 * 监听 127.0.0.1:8789，为酒馆提供 SD WebUI (/sdapi/v1/txt2img) 及 OpenAI (/v1/images/generations) 协议。
 * 底层调用 stable-diffusion.cpp 编译的可执行二进制 (sd) 进行离线推理。
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const HOST = '127.0.0.1';
const PORT = parseInt(process.env.SD_PORT || '8789', 10);
const SD_BIN = process.env.SD_BIN || path.join(__dirname, 'sd');
const MODEL_PATH = process.env.SD_MODEL || path.join(__dirname, 'model.gguf');
const SD_THREADS = process.env.SD_THREADS || '4';

function findModel() {
  if (fs.existsSync(MODEL_PATH)) return MODEL_PATH;
  try {
    const files = fs.readdirSync(__dirname);
    const m = files.find(f => f.toLowerCase().endsWith('.gguf'));
    if (m) return path.join(__dirname, m);
  } catch {}
  return null;
}

function findBin() {
  if (fs.existsSync(SD_BIN)) return SD_BIN;
  const candidates = [
    path.join(__dirname, 'sd'),
    path.join(__dirname, 'sd.bin'),
    '/data/data/com.termux/files/usr/bin/sd'
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function detectCpuAffinity() {
  const cpuCount = os.cpus?.()?.length || 8;
  const freqs = [];

  for (let i = 0; i < cpuCount; i++) {
    let freq = 0;
    try {
      const p1 = `/sys/devices/system/cpu/cpu${i}/cpufreq/cpuinfo_max_freq`;
      if (fs.existsSync(p1)) {
        freq = parseInt(fs.readFileSync(p1, 'utf8').trim(), 10) || 0;
      } else {
        const p2 = `/sys/devices/system/cpu/cpu${i}/cpufreq/scaling_max_freq`;
        if (fs.existsSync(p2)) {
          freq = parseInt(fs.readFileSync(p2, 'utf8').trim(), 10) || 0;
        }
      }
    } catch {}
    freqs.push({ index: i, freq });
  }

  const validFreqs = freqs.filter(f => f.freq > 0);
  let selectedCores = [];

  if (validFreqs.length === cpuCount && cpuCount >= 4) {
    const maxFreq = Math.max(...validFreqs.map(f => f.freq));
    const bigCores = validFreqs.filter(f => f.freq > maxFreq * 0.75);

    if (bigCores.length >= 2 && bigCores.length < cpuCount) {
      selectedCores = bigCores.map(f => f.index);
    } else {
      const reserve = cpuCount >= 8 ? 2 : 1;
      selectedCores = validFreqs.slice(reserve).map(f => f.index);
    }
  } else {
    if (cpuCount >= 8) selectedCores = [2, 3, 4, 5, 6, 7];
    else if (cpuCount >= 6) selectedCores = [2, 3, 4, 5];
    else if (cpuCount >= 4) selectedCores = [1, 2, 3];
    else selectedCores = [0];
  }

  let maskVal = 0n;
  for (const idx of selectedCores) {
    maskVal |= (1n << BigInt(idx));
  }
  const mask = maskVal.toString(16);
  const threadCount = Math.min(selectedCores.length, 6);

  return {
    mask,
    cores: selectedCores,
    threadCount
  };
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS' || req.method === 'HEAD') {
    res.writeHead(200);
    res.end();
    return;
  }

  const sendJson = (status, payload) => {
    const data = JSON.stringify(payload);
    res.writeHead(status, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data)
    });
    res.end(data);
  };

  if (req.method === 'GET') {
    if (req.url === '/' || req.url === '/status' || req.url === '/sdapi/v1/txt2img') {
      const m = findModel(), b = findBin();
      return sendJson(200, {
        status: 'online',
        backend: 'stable-diffusion.cpp',
        model: m ? path.basename(m) : 'none',
        bin: b ? path.basename(b) : 'none',
        modelFound: !!m,
        binFound: !!b
      });
    }
    if (req.url === '/v1/models') {
      return sendJson(200, {
        data: [{ id: 'local/sd-community-lcm', object: 'model' }]
      });
    }
    return sendJson(404, { error: 'Not Found' });
  }

  if (req.method === 'POST') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', async () => {
      let body = {};
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        return sendJson(400, { error: 'Invalid JSON body' });
      }

      const prompt = String(body.prompt || '').trim();
      if (!prompt) return sendJson(400, { error: 'Prompt 不能为空' });

      const model = findModel();
      const bin = findBin();
      if (!bin) return sendJson(500, { error: `未找到 sd 推理二进制 (${SD_BIN})。请先放入编译好的 sd 程序。` });
      if (!model) return sendJson(500, { error: `未找到 GGUF 模型文件。请将微调模型命名为 model.gguf 放入 tools/local-sd/。` });

      const width = parseInt(body.width || 512, 10);
      const height = parseInt(body.height || 512, 10);
      const steps = parseInt(body.steps || 8, 10);
      const cfg = parseFloat(body.cfg_scale || 1.8);
      const negative = String(body.negative_prompt || '');
      const outPath = path.join(__dirname, `sd_out_${Date.now()}.png`);

      const affinity = detectCpuAffinity();
      const threads = String(affinity.threadCount || SD_THREADS);
      const args = [
        '-m', model,
        '-p', prompt,
        '-W', String(width),
        '-H', String(height),
        '--steps', String(steps),
        '--cfg-scale', String(cfg),
        '-t', threads,
        '-o', outPath
      ];
      if (negative) args.push('-n', negative);

      console.log(`[SD-Bridge] 开始推理: ${path.basename(bin)} -m ${path.basename(model)} -p "${prompt.slice(0, 40)}..." (threads=${threads})`);
      const startTime = Date.now();

      try {
        let execBin = bin;
        let execArgs = args;
        if (fs.existsSync('/system/bin/taskset') && affinity.mask) {
          execBin = '/system/bin/taskset';
          execArgs = [affinity.mask, bin, ...args];
          console.log(`[SD-Bridge] ⚡ 动态频率探测：绑定核心 [${affinity.cores.join(',')}] (taskset ${affinity.mask})`);
        }
        const child = spawn(execBin, execArgs);
        let stdout = '', stderr = '';
        child.stdout?.on('data', d => { stdout += d; });
        child.stderr?.on('data', d => { stderr += d; });

        const code = await new Promise((resolve) => {
          child.on('close', resolve);
          child.on('error', err => {
            console.error('[SD-Bridge] 进程执行出错:', err);
            resolve(-1);
          });
        });

        const cost = ((Date.now() - startTime) / 1000).toFixed(1);
        if (code !== 0 || !fs.existsSync(outPath)) {
          console.error(`[SD-Bridge] 推理失败 (code=${code}):`, stderr.slice(-300));
          return sendJson(500, { error: `sd.cpp 退出错误 (${code}): ${stderr.slice(-300) || stdout.slice(-300)}` });
        }

        const imgBytes = fs.readFileSync(outPath);
        try { fs.unlinkSync(outPath); } catch {}
        const b64 = imgBytes.toString('base64');
        console.log(`[SD-Bridge] 推理成功！耗时: ${cost}s, 大小: ${imgBytes.length} 字节`);

        if (req.url.startsWith('/v1/images')) {
          return sendJson(200, { created: Math.floor(Date.now() / 1000), data: [{ b64_json: b64 }] });
        } else {
          return sendJson(200, { images: [b64], parameters: body, info: JSON.stringify({ prompt, cost_time: cost }) });
        }
      } catch (err) {
        console.error('[SD-Bridge] 异常:', err);
        return sendJson(500, { error: err.message });
      }
    });
  }
});

server.listen(PORT, HOST, () => {
  console.log('='.repeat(55));
  console.log('  星栈酒馆移动端本地 SD 伴侣服务 (Node.js 版)');
  console.log(`  监听地址: http://${HOST}:${PORT}`);
  console.log(`  推理程序: ${SD_BIN} (存在: ${fs.existsSync(SD_BIN)})`);
  console.log(`  模型路径: ${MODEL_PATH} (存在: ${fs.existsSync(MODEL_PATH)})`);
  console.log('='.repeat(55));
});
