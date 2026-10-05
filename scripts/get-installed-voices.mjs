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
          resolve(data.result);
        } else if (prev) {
          prev(data);
        }
      };
      prompt('__xingzhan_system_tts__:' + JSON.stringify({
        id: reqId,
        action: 'detect',
        engine: 'com.k2fsa.sherpa.onnx.tts.engine',
        token: window.__apkSystemTtsToken
      }), '');
    });
  })()`);
  console.log('Voices count:', res.voices?.length);
  console.log('First 5:', res.voices?.slice(0, 5).map(v => v.name));
  console.log('Last 5:', res.voices?.slice(-5).map(v => v.name));
} finally {
  c.close();
}
