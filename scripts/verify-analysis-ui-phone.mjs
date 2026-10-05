import fs from 'node:fs';
import {connect} from './webview-cdp.mjs';

const c = await connect();
try {
  // Check if extension settings container or speech dialog settings has the analysis settings
  const result = await c.evaluate(`(async () => {
    // Open settings popup or click speech dialog settings
    let container = document.querySelector('.xingzhan-media-settings[data-kind="analysis"]');
    if (!container) {
      // Open speech dialog first if needed
      const btn = document.querySelector('#xingzhan-synthesis [data-open-speech]');
      if (btn) btn.click();
      await new Promise(r => setTimeout(r, 400));
      // Look for analysis settings button or tab
      const settingsBtn = document.querySelector('#xingzhan-speech-dialog [data-open-settings]') || document.querySelector('[data-tab="analysis"]');
      if (settingsBtn) settingsBtn.click();
      await new Promise(r => setTimeout(r, 300));
      container = document.querySelector('.xingzhan-media-settings[data-kind="analysis"]');
    }

    if (!container) {
      // If still not opened, look in extensions settings panel
      const extBtn = document.querySelector('#nav_toggle_extensions');
      if (extBtn) extBtn.click();
      await new Promise(r => setTimeout(r, 300));
      container = document.querySelector('.xingzhan-media-settings[data-kind="analysis"]');
    }

    const sourceSelect = container?.querySelector('[data-field="source"]');
    const sources = sourceSelect ? Array.from(sourceSelect.options).map(o => ({value: o.value, text: o.text})) : [];
    const globalCheckbox = container?.querySelector('[data-field="useGlobalKey"]');
    const globalStatus = container?.querySelector('[data-global-status]')?.textContent || '';
    const vertexMode = container?.querySelector('[data-field="vertexAuthMode"]');

    return {
      foundContainer: !!container,
      sources,
      hasGlobalCheckbox: !!globalCheckbox,
      globalStatus,
      hasVertexMode: !!vertexMode
    };
  })()`);

  console.log('UI Evaluation result:', JSON.stringify(result, null, 2));

  // Capture screenshot of device
  const shot = await c.call('Page.captureScreenshot', {format: 'png'});
  fs.mkdirSync('artifacts/relay', {recursive: true});
  fs.writeFileSync('artifacts/relay/google-analysis-phone-ui.png', Buffer.from(shot.data, 'base64'));
  console.log('Saved screenshot to artifacts/relay/google-analysis-phone-ui.png');
} catch (e) {
  console.error('Error during verification:', e);
} finally {
  c.close();
}
