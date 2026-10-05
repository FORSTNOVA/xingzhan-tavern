import fs from 'node:fs';
import {connect} from './webview-cdp.mjs';

const c = await connect();
try {
  // Capture console messages
  await c.call('Console.enable');

  const pageInfo = await c.evaluate(`(() => {
    // Check main SillyTavern API connection state
    const apiSelect = document.querySelector('#main_api');
    const modelSelect = document.querySelector('#model_openai') || document.querySelector('#model_google') || document.querySelector('#model_select');
    const connectStatus = document.querySelector('#api_status') || document.querySelector('#api_loading');
    const connectBtn = document.querySelector('#api_button') || document.querySelector('#api_button_openai');
    const statusText = document.querySelector('#api_status_text')?.innerText || document.querySelector('#api_status')?.innerText || '';
    
    // Check current active tab
    const activeTab = document.querySelector('.drawer-content:not([style*="display: none"])')?.id || '';
    
    // Check toastr messages
    const toastrs = Array.from(document.querySelectorAll('#toast-container .toast-message')).map(t => t.innerText);

    // Check main api config from ST context if available
    let stState = null;
    try {
      stState = {
        main_api: window.main_api,
        online_status: window.online_status,
        api_server: window.api_server,
        sub_api: window.sub_api
      };
    } catch {}

    // Check xingzhan media settings if visible
    const xzContainer = document.querySelector('.xingzhan-media-settings[data-kind="analysis"]');
    const xzStatus = xzContainer?.querySelector('[data-status]')?.textContent || '';
    const xzSource = xzContainer?.querySelector('[data-field="source"]')?.value || '';

    return {
      title: document.title,
      currentUrl: location.href,
      mainApi: apiSelect ? apiSelect.value : null,
      apiOptions: apiSelect ? Array.from(apiSelect.options).map(o => ({value: o.value, text: o.text})) : [],
      statusText,
      toastrs,
      stState,
      xzStatus,
      xzSource
    };
  })()`);

  console.log('Page State:', JSON.stringify(pageInfo, null, 2));

  // Take screenshot
  const shot = await c.call('Page.captureScreenshot', {format: 'png'});
  fs.mkdirSync('artifacts/relay', {recursive: true});
  fs.writeFileSync('artifacts/relay/current-phone-api-screen.png', Buffer.from(shot.data, 'base64'));
  console.log('Saved screenshot to artifacts/relay/current-phone-api-screen.png');

} catch (e) {
  console.error('Error checking API connection:', e);
} finally {
  c.close();
}
