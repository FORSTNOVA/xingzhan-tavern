import {connect} from './webview-cdp.mjs';

const c = await connect();
try {
  const result = await c.evaluate(`(async () => {
    // Select first character in list
    const firstChar = document.querySelector('.character_select');
    if (firstChar) {
      firstChar.click();
      await new Promise(r => setTimeout(r, 2000));
    }
    
    // Open system speech
    const openBtn = document.querySelector('[data-open-system]');
    if (openBtn) {
      openBtn.click();
      await new Promise(r => setTimeout(r, 1500));
    }
    
    // Check history
    const historySelect = document.querySelector('[data-system-history]');
    const historyOptions = Array.from(historySelect?.options || []).map(o => ({ value: o.value, text: o.text }));
    
    let previewStatus = 'none';
    if (historySelect && historySelect.options.length > 1) {
      historySelect.selectedIndex = 1;
      document.querySelector('[data-system-restore]')?.click();
      await new Promise(r => setTimeout(r, 1500));
      
      const firstPreview = document.querySelector('[data-system-preview]');
      if (firstPreview) {
        firstPreview.click();
        await new Promise(r => setTimeout(r, 2000));
        previewStatus = firstPreview.textContent;
      }
    }

    return {
      historyOptions,
      previewBtnCount: document.querySelectorAll('[data-system-preview]').length,
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
