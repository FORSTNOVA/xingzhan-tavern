import {connect} from './webview-cdp.mjs';

const c = await connect();
try {
  const res = await c.evaluate(`(() => {
    const statusEl = document.querySelector('[data-system-status]');
    const invEl = document.querySelector('[data-system-inventory]');
    const engineEl = document.querySelector('[data-system-engine]');
    const voiceEl = document.querySelector('[data-system-voice]');
    const reviewEl = document.querySelector('[data-system-review]');
    const profileRows = document.querySelectorAll('.xs-profile');
    const profiles = Array.from(profileRows).map(p => {
      const name = p.querySelector('b')?.textContent;
      const gender = p.querySelector('[data-system-gender-filter]')?.value;
      const voice = p.querySelector('[data-system-role]')?.value;
      return { name, gender, voice };
    });
    const buttons = Array.from(document.querySelectorAll('.xs-actions button')).map(b => ({ text: b.textContent, disabled: b.disabled }));
    return {
      status: statusEl?.textContent || null,
      inventory: invEl?.textContent || null,
      engine: engineEl?.value || null,
      voice: voiceEl?.value || null,
      reviewHidden: reviewEl ? reviewEl.hidden : true,
      profiles,
      buttons
    };
  })()`);
  console.log('UI State:', JSON.stringify(res, null, 2));
} catch(e) {
  console.error(e);
} finally {
  c.close();
}
