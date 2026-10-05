import { connect } from './webview-cdp.mjs';

const c = await connect();
try {
  const result = await c.evaluate(`(async () => {
    try {
      const sys = await import('/scripts/extensions/third-party/xingzhan-synthesis/system.js');
      const detectRes = await sys.nativeTts('detect');
      const synthRes = await sys.nativeTts('synthesize', {
        engine: 'com.k2fsa.sherpa.onnx.tts.engine',
        voice: 'speaker-0',
        rate: 1,
        pitch: 1,
        text: '你好，这是 Sherpa 本地引擎试听测试。',
        scopeId: 'test-preview'
      });
      return {
        detect: {
          ready: detectRes.ready,
          selectedEngine: detectRes.selectedEngine,
          voicesCount: detectRes.voices?.length
        },
        synth: synthRes
      };
    } catch (e) {
      return { error: e.message, stack: e.stack };
    }
  })()`);
  console.log('Native TTS Result:', JSON.stringify(result, null, 2));
} finally {
  c.close();
}
