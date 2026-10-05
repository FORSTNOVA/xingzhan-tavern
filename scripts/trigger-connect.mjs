import fs from 'node:fs';
import {connect} from './webview-cdp.mjs';

const c = await connect();
try {
  const result = await c.evaluate(`(async () => {
    // Click the connect button
    const btn = document.querySelector('#api_button_openai') || document.querySelector('#api_button');
    if (btn) {
      btn.click();
    }
    // Wait for the status check and model fetch to complete
    await new Promise(r => setTimeout(r, 3000));
    
    const statusText = document.querySelector('#api_status_text')?.innerText || '';
    const apiStatus = document.querySelector('#api_status')?.innerText || '';
    const modelSelect = document.querySelector('#model_openai');
    const options = modelSelect ? Array.from(modelSelect.options).map(o => o.value) : [];

    return {
      statusText,
      apiStatus,
      modelCount: options.length,
      currentSelectedModel: modelSelect ? modelSelect.value : null,
      firstFiveModels: options.slice(0, 5)
    };
  })()`);

  console.log('Connect check result:', JSON.stringify(result, null, 2));

  // Take screenshot
  const shot = await c.call('Page.captureScreenshot', {format: 'png'});
  fs.writeFileSync('artifacts/relay/phone-connected-screen.png', Buffer.from(shot.data, 'base64'));
  console.log('Saved screenshot to artifacts/relay/phone-connected-screen.png');

} catch (e) {
  console.error('Error:', e);
} finally {
  c.close();
}
