import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {connect} from '../../webview-cdp.mjs';

const adb = 'C:/Users/21654/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const deviceId = 'ca168055';
const pid = execFileSync(adb, ['-s', deviceId, 'shell', 'pidof', 'cn.jiuguan.probe']).toString().trim();
execFileSync(adb, ['-s', deviceId, 'forward', 'tcp:19222', 'localabstract:webview_devtools_remote_' + pid]);

const c = await connect();
try {
  console.log('Connecting to WebView...');
  const testResult = await c.evaluate(`(async () => {
    const {mediaRequest} = await import('/scripts/extensions/third-party/xingzhan-synthesis/media.js');
    const {getContext} = await import('/scripts/st-context.js');
    const ctx = getContext();
    const characters = ctx.characters || [];
    const activeChar = characters[ctx.characterId] || characters[0];

    // Start local engine if not running
    let status = await (await mediaRequest('local-engine/status')).json();
    if (!status.running) {
      console.log('[Test] Starting local engine companion...');
      await (await mediaRequest('local-engine/start', {})).json();
      status = await (await mediaRequest('local-engine/status')).json();
    }

    // Configure steps to 4 for faster testing
    const curImgCfg = await (await mediaRequest('config/image')).json();
    if (curImgCfg.steps !== 4) {
      await mediaRequest('config/image', { ...curImgCfg, steps: 4 });
    }

    const prompt = 'masterpiece, best quality, 1girl, frieren, silver hair, green eyes, elf ears, anime aesthetic, peaceful expression, detailed, 4k';
    const neg = 'bad anatomy, bad hands, lowres, text, watermark, deformed';

    console.log('[Test] Triggering generate-image for character:', activeChar?.name);
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

    return {
      status,
      character: {
        id: ctx.characterId,
        name: activeChar?.name,
        avatar: activeChar?.avatar
      },
      generation: {
        ok: genRes.ok,
        status: genRes.status,
        elapsed: elapsed + 's',
        hasData: !!json.data,
        dataLength: json.data ? json.data.length : 0,
        historyId: json.historyId,
        error: json.error
      },
      b64Data: json.data || null
    };
  })()`);

  console.log('Test Result Status:', testResult.status);
  console.log('Character:', testResult.character);
  console.log('Generation Result:', testResult.generation);

  if (testResult.b64Data) {
    const outImgPath = path.join(process.cwd(), 'test_character_frieren.png');
    fs.writeFileSync(outImgPath, Buffer.from(testResult.b64Data, 'base64'));
    console.log('Saved generated image to:', outImgPath, 'size:', fs.statSync(outImgPath).size);
  }
} finally {
  c.close();
}
