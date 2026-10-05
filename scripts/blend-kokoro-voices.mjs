import fs from 'node:fs/promises';
import path from 'node:path';

const STYLE_FRAMES = 510;
const STYLE_WIDTH = 256;
const FLOAT_BYTES = 4;
const SPEAKER_BYTES = STYLE_FRAMES * STYLE_WIDTH * FLOAT_BYTES;

function parseArgs(argv) {
  const values = {};
  for (let index = 2; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) throw new Error(`Invalid argument near ${key ?? '(end)'}`);
    values[key.slice(2)] = value;
  }
  for (const key of ['voices', 'index', 'out', 'a', 'b', 'ratio']) {
    if (values[key] === undefined) throw new Error(`Missing --${key}`);
  }
  return values;
}

function finiteNumber(value, name) {
  const result = Number(value);
  if (!Number.isFinite(result)) throw new Error(`${name} must be a finite number`);
  return result;
}

async function main() {
  const args = parseArgs(process.argv);
  const sourceVoices = await fs.readFile(args.voices);
  const sourceIndex = JSON.parse(await fs.readFile(args.index, 'utf8'));
  const a = finiteNumber(args.a, '--a');
  const b = finiteNumber(args.b, '--b');
  const ratio = finiteNumber(args.ratio, '--ratio');
  const replace = args.replace === undefined ? null : finiteNumber(args.replace, '--replace');

  if (!Array.isArray(sourceIndex) || sourceIndex.length < 2) throw new Error('Voice index must be an array with at least two entries');
  if (sourceVoices.length !== sourceIndex.length * SPEAKER_BYTES) {
    throw new Error(`Unexpected voices.bin length: expected ${sourceIndex.length * SPEAKER_BYTES}, got ${sourceVoices.length}`);
  }
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= sourceIndex.length || b >= sourceIndex.length || a === b) {
    throw new Error('Speaker IDs must be distinct valid indexes in the voice index');
  }
  if (ratio < 0 || ratio > 1) throw new Error('--ratio must be between 0 and 1 (weight of speaker A)');
  if (replace !== null && (!Number.isInteger(replace) || replace < 0 || replace >= sourceIndex.length)) {
    throw new Error('--replace must be an existing speaker ID');
  }
  if (sourceIndex.some((voice, id) => voice.id !== id)) throw new Error('Voice IDs must be contiguous and match their array positions');

  const startA = a * SPEAKER_BYTES;
  const startB = b * SPEAKER_BYTES;
  const blended = Buffer.allocUnsafe(SPEAKER_BYTES);
  for (let offset = 0; offset < SPEAKER_BYTES; offset += FLOAT_BYTES) {
    const left = sourceVoices.readFloatLE(startA + offset);
    const right = sourceVoices.readFloatLE(startB + offset);
    if (!Number.isFinite(left) || !Number.isFinite(right)) throw new Error(`Non-finite style value at byte ${offset}`);
    blended.writeFloatLE(left * ratio + right * (1 - ratio), offset);
  }

  const outputDir = path.resolve(args.out);
  await fs.mkdir(outputDir, { recursive: true });
  const voiceA = sourceIndex[a];
  const voiceB = sourceIndex[b];
  const percentA = Math.round(ratio * 100);
  const percentB = 100 - percentA;
  const outputVoices = Buffer.from(sourceVoices);
  const mixedId = replace ?? sourceIndex.length;
  if (replace !== null) blended.copy(outputVoices, replace * SPEAKER_BYTES);
  const mixedVoice = {
    id: mixedId,
    name: `融合测试 ${voiceA.name} ${percentA}% + ${voiceB.name} ${percentB}%`,
    gender: voiceA.gender === voiceB.gender ? voiceA.gender : '混合音色',
    f0: voiceA.f0 * ratio + voiceB.f0 * (1 - ratio),
    desc: `实验性风格向量插值；${voiceA.name} ${percentA}% + ${voiceB.name} ${percentB}%`
  };
  const outputIndex = replace === null
    ? [...sourceIndex, mixedVoice]
    : sourceIndex.map((voice, id) => id === replace ? {...voice, desc: mixedVoice.desc} : voice);
  if (replace === null) {
    const appended = Buffer.concat([sourceVoices, blended]);
    await fs.writeFile(path.join(outputDir, 'voices.bin'), appended, { flag: 'wx' });
  } else {
    await fs.writeFile(path.join(outputDir, 'voices.bin'), outputVoices, { flag: 'wx' });
  }
  await fs.writeFile(path.join(outputDir, 'voices.json'), `${JSON.stringify(outputIndex, null, 2)}\n`, { flag: 'wx' });
  process.stdout.write(`${JSON.stringify({
    originalSpeakers: sourceIndex.length,
    outputSpeakers: outputIndex.length,
    mixedSpeakerId: mixedId,
    mixedVoice: mixedVoice.name,
    mode: replace === null ? 'append' : `replace-${replace}`,
    ratioA: ratio,
    outputBytes: replace === null ? sourceVoices.length + blended.length : outputVoices.length,
    addedBytes: replace === null ? blended.length : 0,
    outputDir
  }, null, 2)}\n`);
}

main().catch(error => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
