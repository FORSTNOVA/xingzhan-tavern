import {connect} from './webview-cdp.mjs';

const c = await connect();
try {
  const t0 = Date.now();
  const res = await c.evaluate(`(async () => {
    const results = [];
    for (let id = 0; id < 5; id++) {
      const voice = 'aishell3-speaker-' + id + ' (女声)';
      const r = await window.__apkSystemTtsReply ? new Promise((resolve, reject) => {
        const reqId = crypto.randomUUID();
        const timer = setTimeout(() => reject(new Error('timeout')), 5000);
        window.__apkSystemTtsReply = (data) => {
          if (data.id === reqId) {
            clearTimeout(timer);
            resolve(data.result);
          }
        };
        prompt('__xingzhan_system_tts__:' + JSON.stringify({
          id: reqId,
          action: 'synthesize',
          engine: 'com.k2fsa.sherpa.onnx.tts.engine',
          voice: voice,
          rate: 1,
          pitch: 1,
          text: '你好，我是发音人' + id,
          scopeId: 'calibration',
          token: window.__apkSystemTtsToken
        }), '');
      }) : null;
      results.push(r);
    }
    return results;
  })()`);
  console.log('5 voices generated in', Date.now() - t0, 'ms:', res);
} finally {
  c.close();
}
