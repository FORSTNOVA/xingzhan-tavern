import {connect} from './webview-cdp.mjs';
import fs from 'fs';

const c = await connect();
try {
  console.log('Sending stop command to clear any pending request...');
  await c.evaluate(`(async () => {
    return await new Promise((resolve) => {
      const reqId = crypto.randomUUID();
      const prev = window.__apkSystemTtsReply;
      const timer = setTimeout(() => {
        window.__apkSystemTtsReply = prev;
        resolve();
      }, 1000);
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
        action: 'stop',
        token: window.__apkSystemTtsToken
      }), '');
    });
  })()`);

  // Small delay
  await new Promise(r => setTimeout(r, 500));

  console.log('Starting chunked batch synthesis for 174 speakers...');
  const t0 = Date.now();
  const allResults = [];
  const chunkSize = 15;

  for (let start = 0; start < 174; start += chunkSize) {
    const end = Math.min(start + chunkSize, 174);
    const chunkT0 = Date.now();
    const chunkResults = await c.evaluate(`(async () => {
      const list = [];
      for (let id = ${start}; id < ${end}; id++) {
        const voice = 'aishell3-speaker-' + id + ' (' + (id % 2 === 0 ? '女声' : '男声') + ')';
        const item = await new Promise((resolve, reject) => {
          const reqId = crypto.randomUUID();
          const prev = window.__apkSystemTtsReply;
          const timer = setTimeout(() => {
            window.__apkSystemTtsReply = prev;
            reject(new Error('timeout on id ' + id));
          }, 8000);
          window.__apkSystemTtsReply = (data) => {
            if (data.id === reqId) {
              clearTimeout(timer);
              window.__apkSystemTtsReply = prev;
              if (data.error) {
                reject(new Error('id ' + id + ': ' + data.error));
              } else {
                resolve({ id, key: data.result.key, cached: data.result.cached });
              }
            } else if (prev) {
              prev(data);
            }
          };
          prompt('__xingzhan_system_tts__:' + JSON.stringify({
            id: reqId,
            action: 'synthesize',
            engine: 'com.k2fsa.sherpa.onnx.tts.engine',
            voice: voice,
            rate: 1,
            pitch: 1,
            text: '你好，我是语音测试。',
            scopeId: 'calibration_batch',
            token: window.__apkSystemTtsToken
          }), '');
        });
        list.push(item);
      }
      return list;
    })()`);

    allResults.push(...chunkResults);
    console.log(`Synthesized [${start}..${end - 1}] (${allResults.length}/174) in ${Date.now() - chunkT0}ms`);
  }

  console.log(`Finished all 174 in ${Date.now() - t0}ms`);
  fs.writeFileSync('scripts/calibration_keys.json', JSON.stringify(allResults, null, 2), 'utf-8');
} catch (e) {
  console.error('Batch error:', e);
} finally {
  c.close();
}
