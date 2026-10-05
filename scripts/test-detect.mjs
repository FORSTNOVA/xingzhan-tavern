import {connect} from './webview-cdp.mjs';

const c = await connect();
try {
  const res = await c.evaluate(`(async () => {
    const detectBtn = document.querySelector('[data-system-detect]');
    detectBtn.click();
    
    // Wait for inventory
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 500));
      const text = document.querySelector('[data-system-inventory]')?.textContent || '';
      if (text.includes('检测到')) break;
    }
    
    const engineEl = document.querySelector('[data-system-engine]');
    const voiceEl = document.querySelector('[data-system-voice]');
    const engineOptions = Array.from(engineEl?.options || []).map(o => ({ value: o.value, text: o.text }));
    const voiceCount = voiceEl?.options.length || 0;
    
    return {
      inventory: document.querySelector('[data-system-inventory]')?.textContent,
      selectedEngine: engineEl?.value,
      engineOptions,
      voiceCount
    };
  })()`);
  console.log('Detect test:', JSON.stringify(res, null, 2));
} catch(e) {
  console.error(e);
} finally {
  c.close();
}
