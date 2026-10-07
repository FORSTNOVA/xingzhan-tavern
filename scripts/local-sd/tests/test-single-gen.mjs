const ws = new WebSocket('ws://127.0.0.1:9222/devtools/page/77BCD9AD5AA3654921E7D8022D2CAF61');
ws.onopen = () => {
  ws.send(JSON.stringify({
    id: 11,
    method: 'Runtime.evaluate',
    params: {
      expression: `(async () => {
        const { getRequestHeaders } = await import('/script.js');
        const headers = { 'Content-Type': 'application/json', ...(getRequestHeaders ? getRequestHeaders() : {}) };
        const res = await fetch('/api/android/media/image-queue/status', {
          headers
        });
        const status = await res.json();
        return status;
      })()`,
      awaitPromise: true,
      returnByValue: true
    }
  }));
};

ws.onmessage = ev => {
  const json = JSON.parse(ev.data);
  console.log('Queue Status with Headers:', JSON.stringify(json.result?.result?.value, null, 2));
  ws.close();
};
ws.onerror = console.error;
