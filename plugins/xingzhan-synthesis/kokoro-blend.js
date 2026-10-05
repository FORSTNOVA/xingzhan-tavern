const STYLE_FRAMES = 510;
const STYLE_WIDTH = 256;
const FLOAT_BYTES = 4;
export const KOKORO_VOICE_BYTES = STYLE_FRAMES * STYLE_WIDTH * FLOAT_BYTES;

/** Create a copy-on-write replacement style table for a stock Kokoro model. */
export async function createKokoroBlend(voicesFile, voiceIndex, {a, b, ratio, target}) {
  if (!(voicesFile instanceof Blob)) throw new Error('请选择 Kokoro voices.bin 文件');
  if (!Array.isArray(voiceIndex) || voiceIndex.length < 2) throw new Error('voices.json 必须包含至少两个音色');
  if (voicesFile.size !== voiceIndex.length * KOKORO_VOICE_BYTES) throw new Error(`文件大小与 ${voiceIndex.length} 个音色不匹配；仅支持 Kokoro 510×256 float32 风格表`);
  if (voiceIndex.some((voice, id) => voice?.id !== id || typeof voice.name !== 'string')) throw new Error('音色编号必须从 0 连续排列，并且与 voices.bin 顺序一致');
  for (const [value, name] of [[a, '音色 A'], [b, '音色 B'], [target, '替换目标']]) {
    if (!Number.isInteger(value) || value < 0 || value >= voiceIndex.length) throw new Error(`${name}编号超出音色列表`);
  }
  if (a === b) throw new Error('请选择两种不同音色');
  if (!Number.isFinite(ratio) || ratio < 0 || ratio > 1) throw new Error('融合比例必须在 0% 到 100% 之间');

  const readStyle = async id => {
    const start = id * KOKORO_VOICE_BYTES;
    const bytes = await voicesFile.slice(start, start + KOKORO_VOICE_BYTES).arrayBuffer();
    const view = new DataView(bytes);
    const values = new Uint8Array(KOKORO_VOICE_BYTES);
    const output = new DataView(values.buffer);
    for (let i = 0; i < STYLE_FRAMES * STYLE_WIDTH; i++) {
      const left = view.getFloat32(i * FLOAT_BYTES, true);
      if (!Number.isFinite(left)) throw new Error(`音色 ${id} 含无效向量数据`);
      output.setFloat32(i * FLOAT_BYTES, left, true);
    }
    return values;
  };
  const [styleA, styleB] = await Promise.all([readStyle(a), readStyle(b)]);
  const aView = new DataView(styleA.buffer), bView = new DataView(styleB.buffer);
  const blended = new Uint8Array(KOKORO_VOICE_BYTES), mixedView = new DataView(blended.buffer);
  for (let i = 0; i < STYLE_FRAMES * STYLE_WIDTH; i++) {
    const left = aView.getFloat32(i * FLOAT_BYTES, true), right = bView.getFloat32(i * FLOAT_BYTES, true);
    const value = left * ratio + right * (1 - ratio);
    if (!Number.isFinite(value)) throw new Error(`融合向量第 ${i} 项无效`);
    mixedView.setFloat32(i * FLOAT_BYTES, value, true);
  }

  const sourceA = voiceIndex[a], sourceB = voiceIndex[b], percentA = Math.round(ratio * 100), percentB = 100 - percentA;
  const targetInfo = {
    ...voiceIndex[target],
    name: `融合 ${sourceA.name} ${percentA}% + ${sourceB.name} ${percentB}%`,
    gender: sourceA.gender === sourceB.gender ? sourceA.gender : 'mixed',
    desc: `Kokoro 风格向量线性插值；${sourceA.name} ${percentA}% + ${sourceB.name} ${percentB}%。替换原音色槽位 ${target}。`
  };
  if (Number.isFinite(sourceA.f0) && Number.isFinite(sourceB.f0)) targetInfo.f0 = sourceA.f0 * ratio + sourceB.f0 * (1 - ratio);
  const nextIndex = voiceIndex.map((voice, id) => id === target ? targetInfo : voice);
  const start = target * KOKORO_VOICE_BYTES;
  const binary = new Blob([voicesFile.slice(0, start), blended, voicesFile.slice(start + KOKORO_VOICE_BYTES)]);
  const index = new Blob([JSON.stringify(nextIndex, null, 2) + '\n'], {type: 'application/json'});
  return {binary, index, targetInfo, sourceA, sourceB, target, ratio, voiceCount: voiceIndex.length};
}
