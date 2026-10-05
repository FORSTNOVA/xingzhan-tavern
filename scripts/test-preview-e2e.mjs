import {connect} from './webview-cdp.mjs';

const c = await connect();
try {
  // Let's open the synthesis dialog and trigger preview
  const res = await c.evaluate(`(async () => {
    // Check if openSystemTts or openSpeech is available
    const openBtn = document.querySelector('[data-system-detect]');
    if (openBtn) {
      openBtn.click();
    }
    // Wait for detection to complete
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 500));
      const inv = document.querySelector('[data-system-inventory]');
      if (inv && inv.textContent.includes('检测到')) break;
    }
    const invText = document.querySelector('[data-system-inventory]')?.textContent;
    const voiceVal = document.querySelector('[data-system-voice]')?.value;
    
    // Check if there are preview buttons
    const previewBtns = document.querySelectorAll('[data-system-preview]');
    let previewClicked = false;
    let previewStatus = '';
    if (previewBtns.length > 0) {
      previewBtns[0].click();
      previewClicked = true;
      // Wait for generation / play
      await new Promise(r => setTimeout(r, 3000));
      previewStatus = previewBtns[0].textContent;
    }
    
    const statusText = document.querySelector('[data-system-status]')?.textContent;

    return {
      invText,
      voiceVal,
      previewBtnCount: previewBtns.length,
      previewClicked,
      previewStatus,
      statusText
    };
  })()`);
  console.log('Test result:', JSON.stringify(res, null, 2));
} catch(e) {
  console.error('Test failed:', e);
} finally {
  c.close();
}
