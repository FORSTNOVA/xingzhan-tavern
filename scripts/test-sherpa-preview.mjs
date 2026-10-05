import {connect} from './webview-cdp.mjs';

const c = await connect();
try {
  const res = await c.evaluate(`(async () => {
    // Call detect with sherpa engine
    const engineEl = document.querySelector('[data-system-engine]');
    engineEl.value = 'com.k2fsa.sherpa.onnx.tts.engine';
    engineEl.dispatchEvent(new Event('change'));
    
    // Wait for detection to complete
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 500));
      const text = document.querySelector('[data-system-inventory]')?.textContent || '';
      if (text.includes('174')) break;
    }
    
    // Now restore Kamen rider record
    const historySelect = document.querySelector('[data-system-history]');
    if (historySelect && historySelect.options.length > 1) {
      historySelect.selectedIndex = 1;
      document.querySelector('[data-system-restore]')?.click();
      await new Promise(r => setTimeout(r, 1000));
    }
    
    // Now click the preview button!
    const previewBtn = document.querySelector('[data-system-preview]');
    let previewStatus = 'none';
    if (previewBtn) {
      previewBtn.click();
      await new Promise(r => setTimeout(r, 2500));
      previewStatus = previewBtn.textContent;
    }
    
    return {
      inventory: document.querySelector('[data-system-inventory]')?.textContent,
      selectedEngine: document.querySelector('[data-system-engine]')?.value,
      previewBtnText: previewBtn?.textContent,
      statusText: document.querySelector('[data-system-status]')?.textContent
    };
  })()`);
  console.log('Sherpa preview test:', JSON.stringify(res, null, 2));
} catch(e) {
  console.error(e);
} finally {
  c.close();
}
