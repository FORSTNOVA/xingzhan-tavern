const ws = new WebSocket('ws://127.0.0.1:9222/devtools/page/77BCD9AD5AA3654921E7D8022D2CAF61');
ws.onopen = () => {
  ws.send(JSON.stringify({
    id: 101,
    method: 'Runtime.evaluate',
    params: {
      expression: `(async () => {
        const { getRequestHeaders } = await import('/script.js');
        const res = await fetch('/api/android/media/image-queue/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getRequestHeaders() },
          body: JSON.stringify({ id: 'all' })
        });
        return await res.json();
      })()`,
      awaitPromise: true,
      returnByValue: true
    }
  }));
};
ws.onmessage = ev => {
  console.log('Cancel response:', JSON.parse(ev.data).result?.result?.value);
  ws.close();
};
