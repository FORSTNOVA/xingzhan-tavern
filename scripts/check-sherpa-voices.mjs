import { connect } from './webview-cdp.mjs';

const c = await connect();
try {
  const result = await c.evaluate(`(async () => {
    try {
      const sys = await import('/scripts/extensions/third-party/xingzhan-synthesis/system.js');
      const detectRes = await sys.nativeTts('detect', {
        engine: 'com.k2fsa.sherpa.onnx.tts.engine'
      });
      return {
        selectedEngine: detectRes.selectedEngine,
        ready: detectRes.ready,
        defaultVoice: detectRes.defaultVoice,
        voices: detectRes.voices?.slice(0, 10),
        totalVoices: detectRes.voices?.length
      };
    } catch (e) {
      return { error: e.message, stack: e.stack };
    }
  })()`);
  console.log('Sherpa Voices:', JSON.stringify(result, null, 2));
} finally {
  c.close();
}
