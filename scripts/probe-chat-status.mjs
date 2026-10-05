import {connect} from './webview-cdp.mjs';

const c = await connect();
try {
  const result = await c.evaluate(`(async () => {
    try {
      const { getRequestHeaders } = await import('/script.js');
      const { oai_settings } = await import('/scripts/openai.js');
      
      const res = await fetch('/api/backends/chat-completions/status', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
          chat_completion_source: oai_settings.chat_completion_source,
          custom_url: oai_settings.custom_url,
          reverse_proxy: oai_settings.reverse_proxy
        })
      });
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch {}
      return {
        status: res.status,
        headers: Object.fromEntries(res.headers.entries()),
        json,
        rawText: text.slice(0, 500),
        oai_settings: {
          chat_completion_source: oai_settings.chat_completion_source,
          custom_url: oai_settings.custom_url,
          reverse_proxy: oai_settings.reverse_proxy,
          openai_model: oai_settings.openai_model
        }
      };
    } catch (e) {
      return { error: e.message, stack: e.stack };
    }
  })()`);

  console.log('Detailed Status check result:', JSON.stringify(result, null, 2));

} catch (e) {
  console.error('Error:', e);
} finally {
  c.close();
}
