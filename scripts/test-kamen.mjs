import {connect} from './webview-cdp.mjs';

const c = await connect();
try {
  const result = await c.evaluate(`(async () => {
    // Find Kamen rider card
    const charEl = Array.from(document.querySelectorAll('.character_select')).find(el => {
      const title = el.querySelector('.character_name')?.textContent || '';
      const img = el.querySelector('img')?.src || '';
      return title.includes('零一') || img.includes('%E9%9B%B6%E4%B8%80');
    });
    if (charEl) {
      charEl.click();
      await new Promise(r => setTimeout(r, 2000));
    }
    
    // Open system speech
    const openBtn = document.querySelector('[data-open-system]');
    if (openBtn) {
      openBtn.click();
      await new Promise(r => setTimeout(r, 1500));
    }
    
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
  console.log('Kamen Rider Result:', JSON.stringify(result, null, 2));
} catch(e) {
  console.error(e);
} finally {
  c.close();
}
