import {connect} from './webview-cdp.mjs';

const c = await connect();
try {
  const res = await c.evaluate(`(async () => {
    return await new Promise((resolve, reject) => {
      const reqId = crypto.randomUUID();
      const prev = window.__apkSystemTtsReply;
      const timer = setTimeout(() => reject(new Error('timeout')), 5000);
      window.__apkSystemTtsReply = (data) => {
        if (data.id === reqId) {
          clearTimeout(timer);
          window.__apkSystemTtsReply = prev;
          resolve(data);
        } else if (prev) {
          prev(data);
        }
      };
      prompt('__xingzhan_system_tts__:' + JSON.stringify({
        id: reqId,
        action: 'synthesize',
        engine: 'com.k2fsa.sherpa.onnx.tts.engine',
        voice: 'aishell3-speaker-0 (女声)',
        rate: 1,
        pitch: 1,
        text: '这是一段测试文本。',
        scopeId: 'calibration',
        token: window.__apkSystemTtsToken
      }), '');
    });
  })()`);
  console.log('Result:', JSON.stringify(res, null, 2));
} finally {
  c.close();
}
