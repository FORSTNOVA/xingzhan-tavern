import { connect } from './webview-cdp.mjs';

const c = await connect();
try {
  const result = await c.evaluate(`(async () => {
    try {
      const sys = await import('/scripts/extensions/third-party/xingzhan-synthesis/system.js');
      const plugin = await import('/scripts/extensions/third-party/xingzhan-synthesis/index.js');
      
      const categorized = await sys.detectSystemEngines();
      const sherpaRes = await sys.nativeTts('detect', { engine: categorized.sherpa.package });
      const firstVoice = sherpaRes.voices?.[0];

      // Try synthesizing with the actual full voice name
      const synthRes = await sys.nativeTts('synthesize', {
        engine: categorized.sherpa.package,
        voice: firstVoice.name,
        rate: 1,
        pitch: 1,
        text: '你好，这是 Sherpa 全名语音测试。',
        scopeId: 'test-preview'
      });

      return {
        categorized: {
          sherpa: categorized.sherpa?.package,
          builtin: categorized.builtin?.package
        },
        firstVoiceName: firstVoice.name,
        synthKey: synthRes.key,
        cached: synthRes.cached
      };
    } catch (e) {
      return { error: e.message, stack: e.stack };
    }
  })()`);
  console.log('Result:', JSON.stringify(result, null, 2));
} finally {
  c.close();
}
