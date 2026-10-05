import {connect} from './webview-cdp.mjs';

const c = await connect();
try {
  const res = await c.evaluate(`(async () => {
    // Import nativeTts from system.js
    const sysMod = await import('/scripts/extensions/third-party/xingzhan-synthesis/system.js');
    const t0 = Date.now();
    const result = await sysMod.nativeTts('synthesize', {
      engine: 'com.k2fsa.sherpa.onnx.tts.engine',
      voice: 'speaker-0: af_maple (女声) (女声·少女)',
      rate: 1,
      pitch: 1,
      text: '[愤怒:0.3] 你怎么能这样呢？',
      scopeId: 'calibration'
    });
    const cost = Date.now() - t0;
    return { cost, result };
  })()`);
  console.log('Synthesize result:', JSON.stringify(res, null, 2));
} catch(e) {
  console.error(e);
} finally {
  c.close();
}
