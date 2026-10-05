import { connect } from './webview-cdp.mjs';

const c = await connect();
try {
  const out = await c.evaluate(`(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const plugin = await import('/scripts/extensions/third-party/xingzhan-synthesis/index.js');
    const text = '“早上好，指挥官。”少女微笑着说道。';
    // Count real API TTS calls to prove none are made.
    const origFetch = window.fetch; let apiCalls = 0;
    window.fetch = (u, o) => { if (String(u).includes('/media/generate-tts') || String(u).endsWith('/media/analyze')) apiCalls++; return origFetch.call(window, u, o); };
    try {
      await plugin.openSpeech({ text, fullText: text, scope: 'full', context: [], cardScope: { id: 'manual', label: '临时文本' } });
      await wait(1500);
      const root = document.querySelector('#xingzhan-speech-dialog');
      const selects = [...root.querySelectorAll('[data-profile-engine]')];
      if (!selects.length) return { error: 'no restored review', status: root.querySelector('[data-analysis-status]')?.textContent };
      for (const s of selects) { s.value = 'sherpa'; s.dispatchEvent(new Event('change')); }
      await wait(300);
      const voicesChosen = [...root.querySelectorAll('[data-profile-voice]')].map(v => v.value);
      root.querySelector('[data-generate]').click();
      let status = '';
      for (let i = 0; i < 60; i++) {
        await wait(1000);
        status = root.querySelector('[data-tts-status]')?.textContent || '';
        if (/完成|失败|已停止/.test(status)) break;
      }
      return { voicesChosen, status, apiCalls };
    } finally { window.fetch = origFetch; }
  })()`);
  console.log(JSON.stringify(out, null, 2));
} finally { c.close(); }
