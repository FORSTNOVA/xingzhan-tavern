import {connect} from './webview-cdp.mjs';

const c = await connect();
try {
  const result = await c.evaluate(`(async () => {
    // Find character with 假面骑士
    const charEl = Array.from(document.querySelectorAll('.character_select')).find(el => {
      const img = el.querySelector('img')?.src || '';
      return img.includes('%E9%9B%B6%E4%B8%80') || img.includes('假面骑士');
    });
    if (charEl) {
      charEl.click();
      await new Promise(r => setTimeout(r, 1500));
    }
    
    // Open speech modal
    if (window.__xingzhanOpenSpeech) {
      window.__xingzhanOpenSpeech();
      await new Promise(r => setTimeout(r, 1000));
    }
    
    // Switch to system speech tab if present
    const systemTab = document.querySelector('[data-speech-tab=\"system\"]');
    if (systemTab) {
      systemTab.click();
      await new Promise(r => setTimeout(r, 500));
    }
    
    // Check history options
    const historySelect = document.querySelector('[data-system-history]');
    let restored = false;
    if (historySelect && historySelect.options.length > 1) {
      historySelect.selectedIndex = 1;
      document.querySelector('[data-system-restore]')?.click();
      await new Promise(r => setTimeout(r, 1000));
      restored = true;
    }
    
    const previewBtns = document.querySelectorAll('[data-system-preview]');
    let previewStatus = '';
    if (previewBtns.length > 0) {
      previewBtns[0].click();
      // wait for synthesis
      await new Promise(r => setTimeout(r, 2000));
      previewStatus = previewBtns[0].textContent;
    }

    return {
      foundChar: !!charEl,
      restored,
      previewBtnCount: previewBtns.length,
      previewStatus,
      statusText: document.querySelector('[data-system-status]')?.textContent
    };
  })()`);
  console.log('Result:', JSON.stringify(result, null, 2));
} catch(e) {
  console.error(e);
} finally {
  c.close();
}
