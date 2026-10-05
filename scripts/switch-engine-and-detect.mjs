import {connect} from './webview-cdp.mjs';

const c = await connect();
try {
  const res = await c.evaluate(`(async () => {
    const engineEl = document.querySelector('[data-system-engine]');
    if (engineEl) {
      engineEl.value = 'com.k2fsa.sherpa.onnx.tts.engine';
      engineEl.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const detectBtn = document.querySelector('[data-system-detect]');
    if (detectBtn) detectBtn.click();

    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 500));
      const text = document.querySelector('[data-system-inventory]')?.textContent || '';
      if (text.includes('174') || text.includes('检测到 2 个引擎，所选引擎提供 174')) break;
    }

    const voiceEl = document.querySelector('[data-system-voice]');
    const options = Array.from(voiceEl?.options || []).map(o => o.text);

    return {
      inventory: document.querySelector('[data-system-inventory]')?.textContent,
      voiceCount: options.length,
      sampleVoices: [
        options.find(o => o.includes('speaker-0 ')),
        options.find(o => o.includes('speaker-1 ')),
        options.find(o => o.includes('speaker-10 ')),
        options.find(o => o.includes('speaker-74 ')),
        options.find(o => o.includes('speaker-100 ')),
        options.find(o => o.includes('speaker-124 '))
      ],
      first20: options.slice(0, 20)
    };
  })()`);
  console.log(JSON.stringify(res, null, 2));
} finally {
  c.close();
}
