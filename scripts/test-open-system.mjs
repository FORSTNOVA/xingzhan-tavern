import {connect} from './webview-cdp.mjs';

const c = await connect();
try {
  const res = await c.evaluate(`(async () => {
    const btn = document.querySelector('[data-open-system]');
    if (btn) btn.click();
    await new Promise(r => setTimeout(r, 1200));

    // Check if dialog is visible
    const historySelect = document.querySelector('[data-system-history]');
    const restoreBtn = document.querySelector('[data-system-restore]');
    const historyOptions = Array.from(historySelect?.options || []).map(o => ({ value: o.value, text: o.text }));
    
    // If there is history, restore it
    if (historySelect && historySelect.options.length > 1) {
      historySelect.selectedIndex = 1;
      restoreBtn?.click();
      await new Promise(r => setTimeout(r, 1500));
    }
    
    // Now check if preview buttons appeared
    const previewBtns = Array.from(document.querySelectorAll('[data-system-preview]')).map(b => b.dataset.systemPreview);
    
    // Click the first preview button if available
    let auditionResult = 'none';
    const firstPreviewBtn = document.querySelector('[data-system-preview]');
    if (firstPreviewBtn) {
      firstPreviewBtn.click();
      await new Promise(r => setTimeout(r, 2500));
      auditionResult = firstPreviewBtn.textContent;
    }
    
    const statusText = document.querySelector('[data-system-status]')?.textContent;

    return {
      historyOptions,
      previewBtns,
      auditionResult,
      statusText
    };
  })()`);
  console.log('Open system test:', JSON.stringify(res, null, 2));
} catch(e) {
  console.error(e);
} finally {
  c.close();
}
