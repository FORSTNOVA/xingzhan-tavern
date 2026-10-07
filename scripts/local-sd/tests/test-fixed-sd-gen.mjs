import fs from 'node:fs';
import path from 'node:path';
import { connect } from '../../webview-cdp.mjs';

const c = await connect();
try {
  console.log('Testing generate-image with new backend on phone...');
  const testResult = await c.evaluate(`(async () => {
    const { mediaRequest } = await import('/scripts/extensions/third-party/xingzhan-synthesis/media.js');
    const { getContext } = await import('/scripts/st-context.js');
    const ctx = getContext();
    const characters = ctx.characters || [];
    const activeChar = characters[ctx.characterId] || characters[0];

    // Configure steps to 1 for quick validation
    const curImgCfg = await (await mediaRequest('config/image')).json();
    await mediaRequest('config/image', {
      ...curImgCfg,
      source: 'local',
      selectedModel: 'Counterfeit-V3.0_Q8_0.gguf',
      steps: 1
    });

    const prompt = '一个友好的AI助手，面带微笑，坐在控制台前';
    const neg = 'bad anatomy, lowres';

    const startTime = Date.now();
    const genRes = await mediaRequest('generate-image', {
      prompt,
      negativePrompt: neg,
      scopeId: 'card:' + (activeChar?.avatar || 'test.png'),
      scopeLabel: activeChar?.name || '测试角色',
      aspect_ratio: '1:1',
      source: 'card'
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const json = await genRes.json();
    const statusAfter = await (await mediaRequest('local-engine/status')).json();

    return {
      statusAfter,
      ok: genRes.ok,
      status: genRes.status,
      elapsed: elapsed + 's',
      hasData: !!json.data,
      dataLength: json.data ? json.data.length : 0,
      historyId: json.historyId,
      error: json.error,
      b64Data: json.data || null
    };
  })()`);

  console.log('Test Result:\n', JSON.stringify({
    ok: testResult.ok,
    status: testResult.status,
    elapsed: testResult.elapsed,
    hasData: testResult.hasData,
    dataLength: testResult.dataLength,
    error: testResult.error,
    recentLogs: testResult.statusAfter?.logs?.slice(-6)
  }, null, 2));

  if (testResult.b64Data) {
    const outImgPath = path.join(process.cwd(), 'test_fixed_sd_gen.png');
    fs.writeFileSync(outImgPath, Buffer.from(testResult.b64Data, 'base64'));
    console.log('SUCCESS! Saved generated image to:', outImgPath, 'size:', fs.statSync(outImgPath).size, 'bytes');
  } else {
    console.error('FAILED: No image data returned!');
  }
} finally {
  c.close();
}
