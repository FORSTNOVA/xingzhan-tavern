import { connect } from './webview-cdp.mjs';

const c = await connect();
try {
  const result = await c.evaluate(`(async () => {
    try {
      const media = await import('/scripts/extensions/third-party/xingzhan-synthesis/media.js');
      const ttsCfgRes = await media.mediaRequest('config/tts');
      const ttsCfg = await ttsCfgRes.json();
      console.log('Testing TTS with config:', ttsCfg);

      const resp = await media.mediaRequest('generate-tts', {
        input: '测试语音调用。',
        voice: ttsCfg.voice || 'Kore'
      });

      return {
        ok: resp.ok,
        status: resp.status,
        headers: Object.fromEntries(resp.headers.entries()),
        byteLength: (await resp.arrayBuffer()).byteLength
      };
    } catch (e) {
      return {
        error: e.message,
        stack: e.stack,
        diagnosticId: e.diagnosticId
      };
    }
  })()`);
  console.log('TTS Call Result:', JSON.stringify(result, null, 2));
} finally {
  c.close();
}
