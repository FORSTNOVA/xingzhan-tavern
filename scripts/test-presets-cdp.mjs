import {connect} from './webview-cdp.mjs';

const c = await connect();
try {
  const res = await c.evaluate(`(async () => {
    const dialog = document.querySelector('#xingzhan-speech-dialog');
    const getStates = () => Object.fromEntries(
      Array.from(dialog?.querySelectorAll('[data-engine-enable]') || []).map(cb => [
        cb.getAttribute('data-engine-enable'),
        cb.checked
      ])
    );

    // 1. Click offline preset
    dialog.querySelector('[data-preset="offline"]')?.click();
    await new Promise(r => setTimeout(r, 100));
    const offlineStates = getStates();

    // 2. Click cloud preset
    dialog.querySelector('[data-preset="cloud"]')?.click();
    await new Promise(r => setTimeout(r, 100));
    const cloudStates = getStates();

    // 3. Click golden preset
    dialog.querySelector('[data-preset="golden"]')?.click();
    await new Promise(r => setTimeout(r, 100));
    const goldenStates = getStates();

    return {
      offlineStates,
      cloudStates,
      goldenStates
    };
  })()`);
  console.log('Presets Test Result:', JSON.stringify(res, null, 2));
} finally {
  c.close();
}
