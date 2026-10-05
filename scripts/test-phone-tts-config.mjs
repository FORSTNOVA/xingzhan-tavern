import { connect } from './webview-cdp.mjs';

const c = await connect();
try {
  const result = await c.evaluate(`(async () => {
    try {
      const media = await import('/scripts/extensions/third-party/xingzhan-synthesis/media.js');
      const ttsCfgRes = await media.mediaRequest('config/tts');
      const ttsCfg = await ttsCfgRes.json();
      
      const analysisCfgRes = await media.mediaRequest('config/analysis');
      const analysisCfg = await analysisCfgRes.json();

      const imageCfgRes = await media.mediaRequest('config/image');
      const imageCfg = await imageCfgRes.json();

      return {
        ttsCfg,
        analysisCfg,
        imageCfg
      };
    } catch (e) {
      return { error: e.message, stack: e.stack };
    }
  })()`);
  console.log('Configs on phone:', JSON.stringify(result, null, 2));
} finally {
  c.close();
}
