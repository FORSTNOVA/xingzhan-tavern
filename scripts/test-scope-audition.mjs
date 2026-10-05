import {connect} from './webview-cdp.mjs';

const c = await connect();
try {
  const result = await c.evaluate(`(async () => {
    // Open system speech with Kamen rider card scope
    const openBtn = document.querySelector('[data-open-system]');
    if (openBtn) openBtn.click();
    await new Promise(r => setTimeout(r, 500));
    
    // Switch provider to system and open Kamen rider scope
    const providerSelect = document.querySelector('[data-speech-provider]');
    if (providerSelect) {
      providerSelect.value = 'system';
      providerSelect.dispatchEvent(new Event('change'));
    }
    
    // Call open directly with scope
    if (window.__xingzhanSystemSpeech) {
      await window.__xingzhanSystemSpeech.open({ id: 'card:假面骑士·零一（沙盒大世界）.png', label: '假面骑士·零一（沙盒大世界）' }, '', false);
    }
    await new Promise(r => setTimeout(r, 2000));
    
    // Check history options
    const historySelect = document.querySelector('[data-system-history]');
    const historyOptions = Array.from(historySelect?.options || []).map(o => ({ value: o.value, text: o.text }));
    
    // Restore the first real record
    if (historySelect && historySelect.options.length > 1) {
      historySelect.selectedIndex = 1;
      document.querySelector('[data-system-restore]')?.click();
      await new Promise(r => setTimeout(r, 2000));
    }
    
    // Now check preview buttons
    const previewBtns = Array.from(document.querySelectorAll('[data-system-preview]')).map(b => b.dataset.systemPreview);
    
    // Click preview on narrator or first character
    let previewStatus = 'none';
    const firstPreview = document.querySelector('[data-system-preview]');
    if (firstPreview) {
      firstPreview.click();
      await new Promise(r => setTimeout(r, 2500));
      previewStatus = firstPreview.textContent;
    }

    return {
      historyOptions: historyOptions.slice(0, 3),
      previewBtns,
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
