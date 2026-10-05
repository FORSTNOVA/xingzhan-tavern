const fetch = globalThis.fetch || require('node-fetch');

async function test() {
  console.log('Testing from Android Node.js...');
  const url = 'https://tingleis.dpdns.org/v1/models';
  try {
    const t0 = Date.now();
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    console.log('Fetch completed in', Date.now() - t0, 'ms, status:', res.status);
    const text = await res.text();
    console.log('Response body:', text.slice(0, 200));
  } catch (e) {
    console.error('Fetch failed:', e.message, e.cause || '');
  }
}

test();
