import { connect } from './webview-cdp.mjs';

const c = await connect();
try {
  const result = await c.evaluate(`(async () => {
    try {
      const resp = await fetch('/api/backends/chat-completions/status', {
        headers: (await import('/script.js')).getRequestHeaders()
      });
      return await resp.json();
    } catch (e) {
      return { error: e.message };
    }
  })()`);
  console.log('Available models:', JSON.stringify(result, null, 2));
} finally {
  c.close();
}
