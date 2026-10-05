import { connect } from './webview-cdp.mjs';

const c = await connect();
try {
  const info = await c.evaluate(`(() => {
    const toastEls = document.querySelectorAll('#toast-container, .toast, .toastr, .notyf, [class*="toast"]');
    const toasts = Array.from(toastEls).map(el => el.innerText.trim()).filter(Boolean);
    const synth = window.extension_settings?.['xingzhan-synthesis'];
    const system = window.__xingzhan_system_tts;
    const media = window.__xingzhan_media;
    
    // Also check localStorage
    let storageKeys = Object.keys(localStorage).filter(k => k.includes('synthesis') || k.includes('tts') || k.includes('voice'));
    let storage = {};
    for (const k of storageKeys) {
      storage[k] = localStorage.getItem(k);
    }

    return {
      toasts,
      synthSettings: synth,
      systemToken: !!window.__apkSystemTtsToken,
      hasSystemTts: !!system,
      hasMedia: !!media,
      localStorage: storage
    };
  })()`);
  console.log('WebView TTS Info:', JSON.stringify(info, null, 2));
} finally {
  c.close();
}
