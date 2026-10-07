import { connect } from '../../webview-cdp.mjs';

const c = await connect();
const testResult = await c.evaluate(`(async () => {
  const { mediaRequest } = await import('/scripts/extensions/third-party/xingzhan-synthesis/media.js');

  // Switch to GhostMix
  await mediaRequest('config/image', {
    source: 'local',
    selectedModel: 'ghostmix.Q4_K_M.gguf',
    steps: 1
  });

  // Check status
  const st = await (await mediaRequest('local-engine/status')).json();

  // Try generating with GhostMix
  try {
    const genRes = await mediaRequest('generate-image', {
      prompt: '1girl, anime',
      aspect_ratio: '1:1',
      model: 'ghostmix.Q4_K_M.gguf'
    });
    const data = await genRes.json();
    return { success: true, st, dataLength: data?.data?.length };
  } catch (err) {
    const stAfter = await (await mediaRequest('local-engine/status')).json();
    return { success: false, error: err.message, st, stAfter, logs: stAfter.logs.slice(-5) };
  }
})()`);

console.log('GhostMix Generation Test:\n', JSON.stringify(testResult, null, 2));
process.exit(0);
