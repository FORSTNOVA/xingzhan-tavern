import {connect} from './webview-cdp.mjs';

const c = await connect();
try {
  const res = await c.evaluate(`(async () => {
    const dialog = document.querySelector('#xingzhan-speech-dialog');
    
    // Simulate an analyzed result with Narrator, Alice (protagonist), and Bob (side character)
    const testResult = {
      model: 'gemini-2.5-flash',
      speakers: [
        { id: 'narrator', name: '旁白', summary: '叙事视角', gender: 'unknown' },
        { id: 'char_alice', name: '爱丽丝', summary: '活泼的女主角', gender: 'female' },
        { id: 'char_bob', name: '鲍勃', summary: '沉稳的卫兵', gender: 'male' }
      ],
      segments: [
        { text: '清晨的森林里弥漫着薄雾。', type: 'narration', speakerId: 'narrator', emotion: '平静', style: '舒缓' },
        { text: '看，前面好像有什么东西在发光！', type: 'dialogue', speakerId: 'char_alice', emotion: '兴奋', style: '好奇', intensity: 0.9 },
        { text: '小心，注意保持距离。', type: 'dialogue', speakerId: 'char_bob', emotion: '严肃', style: '提醒', intensity: 0.8 }
      ]
    };

    // Import synthesis module
    const mod = await import('/scripts/extensions/third-party/xingzhan-synthesis/index.js');
    
    // Open dialog first
    await mod.openSpeech();
    await new Promise(r => setTimeout(r, 600));

    // Render review
    mod.renderReview(testResult);
    await new Promise(r => setTimeout(r, 600));

    // Inspect how profiles and segments are assigned
    const reviewEl = dialog.querySelector('[data-review]');
    const profiles = Array.from(reviewEl?.querySelectorAll('.xs-profile') || []).map(p => {
      const id = p.getAttribute('data-profile-id');
      const tag = p.querySelector('[data-profile-engine-tag]')?.textContent;
      const engineSel = p.querySelector('[data-profile-engine]');
      const voiceSel = p.querySelector('[data-profile-voice]');
      return {
        id,
        tag,
        selectedEngine: engineSel?.value,
        availableEngines: Array.from(engineSel?.options || []).map(o => ({ value: o.value, text: o.text })),
        voiceCount: voiceSel?.options?.length || 0,
        currentVoice: voiceSel?.value
      };
    });

    const segments = Array.from(reviewEl?.querySelectorAll('.xs-segment') || []).map(s => ({
      speaker: s.querySelector('[data-speaker]')?.value,
      badge: s.querySelector('[data-segment-engine-badge]')?.textContent,
      type: s.querySelector('[data-segment-type]')?.value,
      emotion: s.querySelector('[data-emotion]')?.value
    }));

    const playbackButtons = Array.from(dialog?.querySelectorAll('[data-api-playback] button') || []).map(b => ({
      text: b.textContent.trim(),
      disabled: b.disabled
    }));

    return {
      profileCount: profiles.length,
      profiles,
      segments,
      playbackButtons
    };
  })()`);
  console.log('Mock Review Result:', JSON.stringify(res, null, 2));
} finally {
  c.close();
}
