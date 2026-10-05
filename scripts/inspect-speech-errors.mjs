import { connect } from './webview-cdp.mjs';

const c = await connect();
try {
  const result = await c.evaluate(`(async () => {
    try {
      const media = await import('/scripts/extensions/third-party/xingzhan-synthesis/media.js');
      const sessions = await (await media.mediaRequest('sessions')).json();
      const diagnostics = await (await media.mediaRequest('analysis-diagnostics')).json();
      const analysisConfig = await (await media.mediaRequest('config/analysis')).json();
      const ttsConfig = await (await media.mediaRequest('config/tts')).json();
      return {
        sessions,
        diagnostics: diagnostics.records?.slice(-5),
        analysisConfig,
        ttsConfig
      };
    } catch (e) {
      return { error: e.message, stack: e.stack };
    }
  })()`);
  console.log('Speech sessions & diagnostics:', JSON.stringify(result, null, 2));
} finally {
  c.close();
}
