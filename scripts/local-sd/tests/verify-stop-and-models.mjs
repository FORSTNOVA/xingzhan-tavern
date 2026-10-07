import http from 'node:http';

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
  const targets = await getTargets();
  const page = targets[0];
  const client = new CdpClient(page.webSocketDebuggerUrl);
  await client.connect();

  try {
    console.log('1. 打开插图工作台...');
    await client.evaluate(`(() => {
      const openBtn = document.querySelector('[data-open-image-dialog]');
      if (openBtn) openBtn.click();
    })()`);

    await new Promise(r => setTimeout(r, 1500));

    // 2. 检查模型下拉列表 options
    console.log('\n2. 检查模型选择下拉框中的完整/残缺标记...');
    const modelInfo = await client.evaluate(`(() => {
      const dialog = document.querySelector('#xingzhan-image-dialog');
      const select = dialog ? dialog.querySelector('[data-image-quick-model]') : null;
      if (!select) return { error: 'select not found' };
      return {
        count: select.options.length,
        selectedValue: select.value,
        options: Array.from(select.options).map(o => ({ value: o.value, text: o.text }))
      };
    })()`);
    console.log('模型列表详情:', JSON.stringify(modelInfo, null, 2));

    // 3. 测试点击生成，验证强行停止按钮的响应
    console.log('\n3. 填写提示词并点击生成...');
    const startRes = await client.evaluate(`(() => {
      const dialog = document.querySelector('#xingzhan-image-dialog');
      const promptInput = dialog.querySelector('[data-image-prompt]');
      const generateBtn = dialog.querySelector('[data-image-generate]');
      const stopBtn = dialog.querySelector('[data-image-stop]');

      promptInput.value = '1girl, anime tavern bar, highly detailed';
      promptInput.dispatchEvent(new Event('input', { bubbles: true }));

      // 点击生成
      generateBtn.click();

      return {
        generateDisabled: generateBtn.disabled,
        stopDisabled: stopBtn.disabled,
        stopText: stopBtn.textContent.trim(),
        statusText: dialog.querySelector('[data-image-status]')?.textContent.trim()
      };
    })()`);
    console.log('启动生图后状态:', startRes);

    // 等待 2 秒让生图真正进入底层执行
    await new Promise(r => setTimeout(r, 2000));

    const runningRes = await client.evaluate(`(() => {
      const dialog = document.querySelector('#xingzhan-image-dialog');
      const stopBtn = dialog.querySelector('[data-image-stop]');
      const queuePanel = dialog.querySelector('[data-image-queue-panel]');
      const statusText = dialog.querySelector('[data-image-status]')?.textContent.trim();
      return {
        stopBtnDisabled: stopBtn.disabled,
        queuePanelDisplay: queuePanel ? queuePanel.style.display : null,
        statusText
      };
    })()`);
    console.log('生图渲染中状态:', runningRes);

    // 4. 点击【强行停止生图】
    console.log('\n4. 点击【⏹️ 强行停止生图】按钮...');
    const stopClickRes = await client.evaluate(`(() => {
      const dialog = document.querySelector('#xingzhan-image-dialog');
      const stopBtn = dialog.querySelector('[data-image-stop]');
      if (!stopBtn.disabled) {
        stopBtn.click();
        return { clicked: true };
      }
      return { clicked: false, disabled: true };
    })()`);
    console.log('点击停止操作结果:', stopClickRes);

    // 等待 1.5 秒
    await new Promise(r => setTimeout(r, 1500));

    // 5. 检查强行停止后的状态
    const afterStop = await client.evaluate(`(() => {
      const dialog = document.querySelector('#xingzhan-image-dialog');
      const generateBtn = dialog.querySelector('[data-image-generate]');
      const stopBtn = dialog.querySelector('[data-image-stop]');
      const statusText = dialog.querySelector('[data-image-status]')?.textContent.trim();
      return {
        generateBtnDisabled: generateBtn.disabled,
        stopBtnDisabled: stopBtn.disabled,
        statusText
      };
    })()`);
    console.log('停止后的最终状态:', afterStop);

  } finally {
    client.close();
  }
}

main().catch(console.error);
