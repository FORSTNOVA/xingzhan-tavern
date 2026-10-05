import {connect} from './webview-cdp.mjs';

const c = await connect();
try {
  const result = await c.evaluate(`(() => {
    // Find xingzhan buttons or inputs
    const speechBtns = Array.from(document.querySelectorAll('button, div, span, a')).filter(el => {
      const t = el.textContent || '';
      return t.includes('星栈配音') || t.includes('系统语音') || el.dataset.speechTab;
    }).map(el => ({ tag: el.tagName, text: el.textContent.slice(0, 30), class: el.className, dataset: el.dataset }));
    
    // Check if dialog is open
    const modal = document.querySelector('[data-synthesis-modal]');
    return {
      speechBtns: speechBtns.slice(0, 10),
      modalOpen: !!modal && !modal.hidden,
      modalDisplay: modal ? window.getComputedStyle(modal).display : 'none'
    };
  })()`);
  console.log('DOM inspect:', JSON.stringify(result, null, 2));
} catch(e) {
  console.error(e);
} finally {
  c.close();
}
