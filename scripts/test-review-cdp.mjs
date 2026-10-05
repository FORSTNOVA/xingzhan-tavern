import {connect} from './webview-cdp.mjs';

const c = await connect();
try {
  const res = await c.evaluate(`(async () => {
    const dialog = document.querySelector('#xingzhan-speech-dialog');
    const historySelect = dialog?.querySelector('[data-session-list]');
    let restoredId = '';
    if (historySelect && historySelect.options.length > 1) {
      historySelect.selectedIndex = 1;
      restoredId = historySelect.value;
      dialog.querySelector('[data-session-restore]')?.click();
      await new Promise(r => setTimeout(r, 1200));
    }

    // Now inspect profiles in review
    const reviewEl = dialog?.querySelector('[data-review]');
    const profiles = Array.from(reviewEl?.querySelectorAll('.xs-profile') || []).map(p => {
      const id = p.getAttribute('data-profile-id');
      const tag = p.querySelector('[data-profile-engine-tag]')?.textContent;
      const engineSel = p.querySelector('[data-profile-engine]');
      const voiceSel = p.querySelector('[data-profile-voice]');
      return {
        id,
        tag,
        selectedEngine: engineSel?.value,
        availableEngines: Array.from(engineSel?.options || []).map(o => o.value),
        voiceCount: voiceSel?.options?.length || 0,
        currentVoice: voiceSel?.value
      };
    });

    const segments = Array.from(reviewEl?.querySelectorAll('.xs-segment') || []).slice(0, 3).map(s => ({
      speaker: s.querySelector('[data-speaker]')?.value,
      badge: s.querySelector('[data-segment-engine-badge]')?.textContent,
      type: s.querySelector('[data-segment-type]')?.value
    }));

    const playbackActions = Array.from(dialog?.querySelectorAll('[data-api-playback] button') || []).map(b => ({
      text: b.textContent.trim(),
      disabled: b.disabled
    }));

    return {
      restoredId,
      profileCount: profiles.length,
      sampleProfiles: profiles.slice(0, 3),
      sampleSegments: segments,
      playbackActions
    };
  })()`);
  console.log('Review Test Result:', JSON.stringify(res, null, 2));
} finally {
  c.close();
}
