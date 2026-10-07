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

async function main() {
  const targets = await getTargets();
  const page = targets[0];
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: `(async () => {
        try {
          const { generateImage } = await import('/plugins/xingzhan-synthesis/index.js');
          console.log('开始调用 generateImage');
          const res = await generateImage('1girl, solo, anime girl holding coffee, airport lounge', '16:9');
          return { success: true, res };
        } catch (e) {
          return { error: e.stack || e.message };
        }
      })()`,
      awaitPromise: true,
      returnByValue: true
    }
  }));

  ws.onmessage = ev => {
    const data = JSON.parse(ev.data);
    console.log('Result:', JSON.stringify(data.result?.result?.value, null, 2));
    ws.close();
  };
}

main().catch(console.error);
