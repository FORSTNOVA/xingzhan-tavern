import {connect} from './webview-cdp.mjs';

const c = await connect();
try {
  const res = await c.evaluate(`(() => {
    const voiceEl = document.querySelector('[data-system-voice]');
    const options = Array.from(voiceEl?.options || []).map(o => o.text);
    return {
      total: options.length,
      first15: options.slice(0, 15),
      samples: [
        options.find(o => o.includes('speaker-0 ')),
        options.find(o => o.includes('speaker-1 ')),
        options.find(o => o.includes('speaker-10 ')),
        options.find(o => o.includes('speaker-74 ')),
        options.find(o => o.includes('speaker-100 ')),
        options.find(o => o.includes('speaker-124 '))
      ]
    };
  })()`);
  console.log(JSON.stringify(res, null, 2));
} finally {
  c.close();
}
