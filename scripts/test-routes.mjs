import {connect} from './webview-cdp.mjs';

const c = await connect();
try {
  const res = await c.evaluate(`(async () => {
    const tests = [
      '/api/android/media/system-preview/test',
      '/api/android/media/sessions',
      '/api/android/media/session/test/audio/0'
    ];
    const results = {};
    for (const url of tests) {
      try {
        const r = await fetch(url);
        results[url] = r.status;
      } catch(e) {
        results[url] = e.message;
      }
    }
    return results;
  })()`);
  console.log('Routes test:', JSON.stringify(res, null, 2));
} catch(e) {
  console.error(e);
} finally {
  c.close();
}
