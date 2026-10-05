import {connect} from './webview-cdp.mjs';

const c = await connect();
try {
  const result = await c.evaluate(`(async () => {
    // Check what the selected engine and voice are right now
    const engineEl = document.querySelector('[data-system-engine]');
    const voiceEl = document.querySelector('[data-system-voice]');
    
    // Check role voices
    const roleSelects = Array.from(document.querySelectorAll('[data-system-role]')).map(s => ({
      role: s.dataset.systemRole,
      value: s.value,
      options: Array.from(s.options).map(o => o.value)
    }));

    return {
      selectedEngine: engineEl?.value,
      defaultVoice: voiceEl?.value,
      roleSelects
    };
  })()`);
  console.log('Role Selects:', JSON.stringify(result, null, 2));
} catch(e) {
  console.error(e);
} finally {
  c.close();
}
