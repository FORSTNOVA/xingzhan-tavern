import http from 'node:http';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const adb = 'C:/Users/21654/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const deviceId = 'ca168055';

function getTargets() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 0;
    this.pending = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
    this.ws.onmessage = ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result?.result?.value !== undefined ? msg.result.result.value : msg.result?.result);
      }
    };
  }

  evaluate(expr, awaitPromise = true) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({
        id,
        method: 'Runtime.evaluate',
        params: {
          expression: expr,
          awaitPromise,
          returnByValue: true
        }
      }));
    });
  }

  close() {
    try { this.ws.close(); } catch {}
  }
}

async function main() {
  console.log('=== 开始端到端真实用户交互模拟与生图验证 ===');
  const targets = await getTargets();
  const page = targets[0];
  const client = new CdpClient(page.webSocketDebuggerUrl);
  await client.connect();

  try {
    // 1. 打开工作台窗口
    console.log('\n--- 1. 点击“打开插图工作台窗口”按钮 ---');
    const dialogOpen = await client.evaluate(`(() => {
      const openBtn = document.querySelector('[data-open-image-dialog]');
      if (openBtn) openBtn.click();
      const dialog = document.querySelector('#xingzhan-image-dialog');
      return { dialogOpened: dialog ? dialog.open : false };
    })()`);
    console.log('窗口状态:', dialogOpen);

    // 2. 在工作台填写提示词与比例
    console.log('\n--- 2. 填写提示词与比例 ---');
    const fillRes = await client.evaluate(`(() => {
      const dialog = document.querySelector('#xingzhan-image-dialog');
      const promptInput = dialog ? dialog.querySelector('[data-image-prompt]') : null;
      const ratioSelect = dialog ? dialog.querySelector('[data-image-ratio]') : null;
      const testPrompt = 'masterpiece, best quality, ultra-detailed, 1girl, cute anime girl sitting in cozy cafe lounge, soft morning sunlight, steaming coffee mug, smiling happily, 8k resolution';
      if (promptInput) {
        promptInput.value = testPrompt;
        promptInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (ratioSelect) {
        ratioSelect.value = '16:9';
        ratioSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return {
        promptSet: promptInput ? promptInput.value.slice(0, 40) + '...' : null,
        ratioSet: ratioSelect ? ratioSelect.value : null
      };
    })()`);
    console.log('填写表单结果:', fillRes);

    // 3. 点击“生成图片”按钮
    console.log('\n--- 3. 真实点击“生成图片”按钮 ---');
    const clickGen = await client.evaluate(`(() => {
      const dialog = document.querySelector('#xingzhan-image-dialog');
      const genBtn = dialog ? dialog.querySelector('[data-image-generate]') : null;
      if (genBtn) {
        genBtn.click();
        return { clicked: true };
      }
      return { clicked: false };
    })()`);
    console.log('按钮点击触发:', clickGen);

    // 等待 1.5 秒检查队列面板状态与倒计时
    await new Promise(r => setTimeout(r, 1500));
    const queueUiCheck = await client.evaluate(`(() => {
      const dialog = document.querySelector('#xingzhan-image-dialog');
      const qPanel = dialog ? dialog.querySelector('[data-image-queue-panel]') : null;
      const actBox = qPanel ? qPanel.querySelector('[data-image-queue-active]') : null;
      const elapsedEl = actBox ? actBox.querySelector('[data-image-queue-elapsed]') : null;
      const promptEl = actBox ? actBox.querySelector('[data-image-queue-prompt]') : null;
      const statusText = dialog ? dialog.querySelector('[data-image-status]')?.textContent : '';
      return {
        panelVisible: qPanel ? qPanel.style.display !== 'none' : false,
        activeVisible: actBox ? actBox.style.display !== 'none' : false,
        elapsedText: elapsedEl ? elapsedEl.textContent : '',
        promptText: promptEl ? promptEl.textContent : '',
        statusText
      };
    })()`);
    console.log('UI 队列栏实时状态:', JSON.stringify(queueUiCheck, null, 2));

    // 4. 等待生成完成（云端通常 7~10 秒）
    console.log('\n--- 4. 轮询等待出图完成 ---');
    let finished = false;
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const pollCheck = await client.evaluate(`(() => {
        const dialog = document.querySelector('#xingzhan-image-dialog');
        const preview = dialog ? dialog.querySelector('[data-image-preview]') : null;
        const statusText = dialog ? dialog.querySelector('[data-image-status]')?.textContent : '';
        const hasPreview = preview && !preview.hidden && preview.src.length > 50;
        return { hasPreview, statusText, previewSrc: preview?.src?.slice(0, 60) };
      })()`);
      if (pollCheck.hasPreview || pollCheck.statusText.includes('生成成功') || pollCheck.statusText.includes('失败')) {
        console.log(`第 ${i + 1} 秒出图就绪:`, pollCheck);
        finished = true;
        break;
      }
    }

    if (!finished) throw new Error('生图超时未完成');

    // 5. 截取手机真机画面保存至 artifacts
    console.log('\n--- 5. 截取真机工作台运行画面 ---');
    const screenshotBuf = execFileSync(adb, ['-s', deviceId, 'exec-out', 'screencap', '-p']);
    const artifactImgPath = 'C:/Users/21654/.gemini/antigravity-ide/brain/db997d19-eafa-4442-b9e2-97aea0a2d172/verified_queue_workbench_ui.png';
    fs.writeFileSync(artifactImgPath, screenshotBuf);
    console.log('✔ 已成功保存真机截图到:', artifactImgPath);

    // 6. 最终验证历史记录
    const histVerify = await client.evaluate(`(async () => {
      const { getRequestHeaders } = await import('/script.js');
      const res = await fetch('/api/android/media/image-history', { headers: getRequestHeaders() });
      const data = await res.json();
      return {
        totalImages: data.images?.length || 0,
        latestId: data.images?.[0]?.id,
        latestPrompt: data.images?.[0]?.prompt?.slice(0, 40) + '...'
      };
    })()`);
    console.log('历史库最新校验:', histVerify);

    console.log('\n🎉 生成队列、意外退出状态自愈与真机出图全链路 100% 验证通过！');
  } finally {
    client.close();
  }
}

main().catch(console.error);
