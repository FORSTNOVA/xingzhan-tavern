import {connect} from './webview-cdp.mjs';

const c = await connect();
try {
  const res = await c.evaluate(`(async () => {
    const audio = new Audio('/api/android/media/system-preview/caeafc6f324ab184c9b75c01c9a2a643547c0b2b04c84d10bf022f768dd7796d');
    await new Promise((resolve, reject) => {
      audio.oncanplaythrough = () => resolve({ duration: audio.duration });
      audio.onerror = (e) => reject(new Error('Audio load error: ' + (audio.error?.message || audio.error?.code)));
      setTimeout(() => reject(new Error('Audio load timeout')), 5000);
    });
    return { ok: true, duration: audio.duration };
  })()`);
  console.log('Audio test result:', JSON.stringify(res, null, 2));
} catch(e) {
  console.error('Audio test failed:', e);
} finally {
  c.close();
}
