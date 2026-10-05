import {connect} from './webview-cdp.mjs';

const c = await connect();
try {
  const requests = [];
  const consoleMessages = [];

  c.onEvent((m) => {
    if (m.method === 'Network.requestWillBeSent') {
      requests.push({
        id: m.params.requestId,
        url: m.params.request.url,
        method: m.params.request.method,
        headers: m.params.request.headers
      });
    }
    if (m.method === 'Network.responseReceived') {
      const req = requests.find(r => r.id === m.params.requestId);
      if (req) {
        req.status = m.params.response.status;
        req.statusText = m.params.response.statusText;
      }
    }
    if (m.method === 'Network.loadingFailed') {
      const req = requests.find(r => r.id === m.params.requestId);
      if (req) {
        req.failed = true;
        req.errorText = m.params.errorText;
      }
    }
    if (m.method === 'Console.messageAdded') {
      consoleMessages.push({
        level: m.params.message.level,
        text: m.params.message.text
      });
    }
  });

  await c.call('Network.enable');
  await c.call('Console.enable');

  console.log('Clicking Connect button in ST...');
  const clickResult = await c.evaluate(`(() => {
    const btn = document.querySelector('#api_button_openai') || document.querySelector('#api_button');
    if (!btn) return { error: 'Connect button not found' };
    btn.click();
    return { clicked: true, id: btn.id, text: btn.innerText };
  })()`);

  console.log('Click Result:', clickResult);

  await new Promise(r => setTimeout(r, 6000));

  const afterState = await c.evaluate(`(() => {
    const statusText = document.querySelector('#api_status_text')?.innerText || '';
    const apiStatus = document.querySelector('#api_status')?.innerText || '';
    const toastrs = Array.from(document.querySelectorAll('#toast-container .toast-message')).map(t => t.innerText);
    const modelSelect = document.querySelector('#model_openai');
    const modelCount = modelSelect ? modelSelect.options.length : 0;
    return { statusText, apiStatus, toastrs, modelCount };
  })()`);

  console.log('After Click State:', JSON.stringify(afterState, null, 2));
  console.log('Relevant Network Requests:', JSON.stringify(requests.filter(r => !r.url.endsWith('.png') && !r.url.endsWith('.css') && !r.url.endsWith('.js') && !r.url.endsWith('.woff2')), null, 2));
  console.log('Console Messages (last 10):', JSON.stringify(consoleMessages.slice(-10), null, 2));

} catch (e) {
  console.error('Error during connect test:', e);
} finally {
  c.close();
}
