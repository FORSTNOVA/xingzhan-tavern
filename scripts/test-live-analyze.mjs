import { connect } from './webview-cdp.mjs';

const c = await connect();
try {
  const result = await c.evaluate(`(async () => {
    try {
      const media = await import('/scripts/extensions/third-party/xingzhan-synthesis/media.js');
      const text = '“早上好，指挥官。”少女微笑着说道。';
      const resp = await media.mediaRequest('analyze', {
        text,
        context: [],
        scopeId: 'manual',
        scopeLabel: '测试诊断',
        worldReferences: [],
        speakers: [{ id: 'commander', name: '指挥官' }]
      });
      return {
        ok: resp.ok,
        status: resp.status,
        data: await resp.json()
      };
    } catch (e) {
      return {
        error: e.message,
        stack: e.stack,
        diagnosticId: e.diagnosticId
      };
    }
  })()`);
  console.log('Analyze Test Result:', JSON.stringify(result, null, 2));
} finally {
  c.close();
}
