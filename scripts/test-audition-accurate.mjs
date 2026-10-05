import {connect} from './webview-cdp.mjs';

const c = await connect();
try {
  const res = await c.evaluate(`(async () => {
    const results = [];
    const testCases = [
      { id: 1, voice: 'aishell3-speaker-1 (女声)', expected: '女声' },
      { id: 10, voice: 'aishell3-speaker-10 (男声)', expected: '男声' },
      { id: 74, voice: 'aishell3-speaker-74 (男声)', expected: '男声' }
    ];

    for (const tc of testCases) {
      const voiceEl = document.querySelector('[data-system-voice]');
      if (voiceEl) {
        // Find matching option
        const opt = Array.from(voiceEl.options).find(o => o.value.startsWith('aishell3-speaker-' + tc.id + ' '));
        if (opt) {
          voiceEl.value = opt.value;
          voiceEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }

      // Find the preview button
      const previewBtn = document.querySelector('[data-system-preview]');
      let status = '';
      if (previewBtn) {
        previewBtn.click();
        // Wait for preview playback
        await new Promise(r => setTimeout(r, 2500));
        status = previewBtn.textContent;
      }

      const voiceStatus = document.querySelector('[data-system-status]')?.textContent || '';
      results.push({
        id: tc.id,
        expected: tc.expected,
        selectedVoice: voiceEl?.value,
        btnStatus: status,
        systemStatus: voiceStatus
      });
    }

    return results;
  })()`);

  console.log('Audition verification results:', JSON.stringify(res, null, 2));
} finally {
  c.close();
}
