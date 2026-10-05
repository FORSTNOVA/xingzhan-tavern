import {connect} from './webview-cdp.mjs';

const c = await connect();
try {
  const testFetch = await c.evaluate(`(async () => {
    const t0 = Date.now();
    try {
      const res = await fetch('https://tingleis.dpdns.org/v1/models', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000)
      });
      return {
        duration: Date.now() - t0,
        status: res.status,
        statusText: res.statusText,
        text: (await res.text()).slice(0, 300)
      };
    } catch (e) {
      return {
        duration: Date.now() - t0,
        error: e.message,
        name: e.name
      };
    }
  })()`);

  console.log('WebView Direct Fetch to tingleis.dpdns.org:', JSON.stringify(testFetch, null, 2));

} finally {
  c.close();
}
