import { connect } from '../../webview-cdp.mjs';

const c = await connect();
const res = await c.evaluate(`(async () => {
  const { mediaRequest } = await import('/scripts/extensions/third-party/xingzhan-synthesis/media.js');

  // Select Counterfeit
  await mediaRequest('config/image', {
    source: 'local',
    selectedModel: 'Counterfeit-V3.0_fix_fp16.safetensors',
    steps: 1
  });

  const st = await (await mediaRequest('local-engine/status')).json();
  return {
    selectedModel: st.selectedModel,
    modelName: st.modelName,
    running: st.running
  };
})()`);

console.log('Result:\n', JSON.stringify(res, null, 2));
process.exit(0);
