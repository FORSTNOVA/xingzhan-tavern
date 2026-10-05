import fs from 'node:fs';
import {connect} from './webview-cdp.mjs';

const c = await connect();
try {
  console.log('Clicking #test_api_button...');
  const result = await c.evaluate(`(async () => {
    const btn = document.querySelector('#test_api_button');
    if (!btn) return { error: '#test_api_button not found' };
    btn.click();
    
    // Wait for the test completion
    await new Promise(r => setTimeout(r, 6000));
    
    const toastrs = Array.from(document.querySelectorAll('#toast-container .toast-message')).map(t => t.innerText);
    const lastToast = toastrs.at(-1) || '';
    
    return {
      clicked: true,
      lastToast,
      allToasts: toastrs
    };
  })()`);

  console.log('Test message result:', JSON.stringify(result, null, 2));

  const shot = await c.call('Page.captureScreenshot', {format: 'png'});
  fs.writeFileSync('artifacts/relay/phone-test-message-screen.png', Buffer.from(shot.data, 'base64'));
  console.log('Saved screenshot to artifacts/relay/phone-test-message-screen.png');

} catch (e) {
  console.error('Error:', e);
} finally {
  c.close();
}
