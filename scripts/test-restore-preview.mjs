import {connect} from './webview-cdp.mjs';

const c = await connect();
try {
  const res = await c.evaluate(`(async () => {
    // Select the first history item
    const historySelect = document.querySelector('[data-system-history]');
    const restoreBtn = document.querySelector('[data-system-restore]');
    if (historySelect && historySelect.options.length > 1) {
      historySelect.selectedIndex = 1;
      restoreBtn.click();
      await new Promise(r => setTimeout(r, 1000));
    }
    
    const previewBtns = document.querySelectorAll('[data-system-preview]');
    let previewClicked = false;
    let previewButtonText = '';
    if (previewBtns.length > 0) {
      previewBtns[0].click();
      previewClicked = true;
      // Wait for audio generation and play
      await new Promise(r => setTimeout(r, 2500));
      previewButtonText = previewBtns[0].textContent;
    }
    
    const statusText = document.querySelector('[data-system-status]')?.textContent;
    return {
      historyCount: historySelect?.options.length || 0,
      previewBtnCount: previewBtns.length,
      previewClicked,
      previewButtonText,
      statusText
    };
  })()`);
  console.log('Restore and Preview Test:', JSON.stringify(res, null, 2));
} catch(e) {
  console.error('Test failed:', e);
} finally {
  c.close();
}
