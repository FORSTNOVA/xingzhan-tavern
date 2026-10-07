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
  console.log('=== 开始全面验证生成队列与意外退出恢复机制 ===');
  const targets = await getTargets();
  const page = targets[0];
  console.log('连接 Target:', page.title, page.webSocketDebuggerUrl);

  const client = new CdpClient(page.webSocketDebuggerUrl);
  await client.connect();

  try {
    // 1. 查询当前队列初始状态
    console.log('\n--- 1. 验证 image-queue/status 初始状态 ---');
    const status = await client.evaluate(`(async () => {
      const { getRequestHeaders } = await import('/script.js');
      const res = await fetch('/api/android/media/image-queue/status', {
        headers: getRequestHeaders()
      });
      return await res.json();
    })()`);
    console.log('初始队列状态:', JSON.stringify(status, null, 2));

    // 2. 检查 UI 组件
    console.log('\n--- 2. 检查插图工作台与主面板中的队列组件 ---');
    const ui = await client.evaluate(`(() => {
      const dialog = document.querySelector('#xingzhan-image-dialog');
      const panel = document.querySelector('#xingzhan-synthesis');
      return {
        dialogExists: !!dialog,
        dialogQueuePanel: !!dialog?.querySelector('[data-image-queue-panel]'),
        dialogCancelBtn: !!dialog?.querySelector('[data-image-queue-cancel-active]'),
        dialogPendingBox: !!dialog?.querySelector('[data-image-queue-pending]'),
        mainQueuePanel: !!panel?.querySelector('[data-image-queue-panel]')
      };
    })()`);
    console.log('UI 组件情况:', JSON.stringify(ui, null, 2));

    // 3. 测试并发排队：两个任务连续发出，验证第二个任务自动排队进入 queue，不报 429
    console.log('\n--- 3. 验证并发排队机制 (杜绝 429) ---');
    const queueTest = await client.evaluate(`(async () => {
      const { getRequestHeaders } = await import('/script.js');
      const headers = { 'Content-Type': 'application/json', ...getRequestHeaders() };

      const prompt1 = '1girl, solo, anime barista in sunlit cafe, masterpiece';
      const prompt2 = '1girl, solo, anime girl reading a book in library, masterpiece';

      // 发送任务1
      const p1 = fetch('/api/android/media/generate-image', {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt: prompt1, aspect_ratio: '1:1' })
      }).then(r => r.json().then(d => ({ status: r.status, data: d }))).catch(e => ({ error: e.message }));

      // 稍微等待 150ms 确保进入 active
      await new Promise(r => setTimeout(r, 150));

      // 发送任务2
      const p2 = fetch('/api/android/media/generate-image', {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt: prompt2, aspect_ratio: '3:4' })
      }).then(r => r.json().then(d => ({ status: r.status, data: d }))).catch(e => ({ error: e.message }));

      // 等待 200ms 查询队列快照
      await new Promise(r => setTimeout(r, 200));
      const res = await fetch('/api/android/media/image-queue/status', { headers: getRequestHeaders() });
      const snap = await res.json();

      return {
        snap
      };
    })()`);
    console.log('并发排队快照:', JSON.stringify(queueTest, null, 2));

    // 4. 测试取消机制：主动取消所有队列与任务，释放底层资源
    console.log('\n--- 4. 验证任务取消与资源释放 ---');
    const cancelRes = await client.evaluate(`(async () => {
      const { getRequestHeaders } = await import('/script.js');
      const headers = { 'Content-Type': 'application/json', ...getRequestHeaders() };
      const res = await fetch('/api/android/media/image-queue/cancel', {
        method: 'POST',
        headers,
        body: JSON.stringify({ id: 'all' })
      });
      const data = await res.json();
      await new Promise(r => setTimeout(r, 400));
      const statusAfter = await (await fetch('/api/android/media/image-queue/status', { headers: getRequestHeaders() })).json();
      return {
        cancelData: data,
        statusAfter
      };
    })()`);
    console.log('取消后状态:', JSON.stringify(cancelRes, null, 2));

    // 5. 测试真实生图并自动入库
    console.log('\n--- 5. 验证单张正常生图、自动入库与历史同步 ---');
    const singleGen = await client.evaluate(`(async () => {
      const { getRequestHeaders } = await import('/script.js');
      const headers = { 'Content-Type': 'application/json', ...getRequestHeaders() };
      const startTime = Date.now();
      const testPrompt = 'masterpiece, best quality, ultra-detailed, 1girl, cute maid with cat ears, smiling, warm teahouse';
      const res = await fetch('/api/android/media/generate-image', {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt: testPrompt, aspect_ratio: '16:9' })
      });
      const data = await res.json();
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      return {
        httpStatus: res.status,
        hasImage: !!data.data,
        imgLength: data.data ? data.data.length : 0,
        historyId: data.historyId,
        cost: elapsed + 's'
      };
    })()`);
    console.log('生图完成结果:', JSON.stringify(singleGen, null, 2));

    // 6. 验证最终队列与历史库状态
    console.log('\n--- 6. 验证最终队列与历史库 ---');
    const finalReport = await client.evaluate(`(async () => {
      const { getRequestHeaders } = await import('/script.js');
      const q = await (await fetch('/api/android/media/image-queue/status', { headers: getRequestHeaders() })).json();
      const h = await (await fetch('/api/android/media/image-history', { headers: getRequestHeaders() })).json();
      return {
        isBusy: q.isBusy,
        queueLength: q.queue.length,
        lastFinishedTask: q.lastFinishedTask ? {
          prompt: q.lastFinishedTask.prompt,
          status: q.lastFinishedTask.status,
          historyId: q.lastFinishedTask.historyId
        } : null,
        totalHistoryImages: h.images ? h.images.length : 0,
        latestSaved: h.images ? {
          id: h.images[0].id,
          prompt: h.images[0].prompt.slice(0, 50) + '...',
          model: h.images[0].model,
          ratio: h.images[0].ratio,
          createdAt: h.images[0].createdAt
        } : null
      };
    })()`);
    console.log('最终全流程验证报告:', JSON.stringify(finalReport, null, 2));

  } finally {
    client.close();
  }
}

main().catch(console.error);
