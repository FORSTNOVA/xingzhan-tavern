import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { patchCardWorldBookScope } from '../app/src/main/assets/android-media-patches.mjs';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'jiuguan-worldbook-scope-'));
const target = path.join(root, 'public', 'scripts', 'world-info.js');
await fs.mkdir(path.dirname(target), { recursive: true });
const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../vendor/SillyTavern/public/scripts/world-info.js');
await fs.copyFile(source, target);

try {
    assert.equal(await patchCardWorldBookScope(root), true, 'first patch should modify the file');
    assert.equal(await patchCardWorldBookScope(root), false, 'patch should be idempotent');
    const patched = await fs.readFile(target, 'utf8');
    assert.match(patched, /XINGZHAN_CARD_WORLD_SCOPE_V3/);
    assert.match(patched, /world_info\.characterWorldBooks\?\.\[fileName\]/);
    assert.match(patched, /getEffectiveGlobalWorldBooks\(\)/);
    assert.match(patched, /worldsToSearch = new Set\(\[\.\.\.worldsToSearch\]\.filter\(name => cardScope\.has\(name\)\)\)/);
    assert.match(patched, /设置当前角色卡世界书/);
    const syntax = spawnSync(process.execPath, ['--check', target], { encoding: 'utf8' });
    assert.equal(syntax.status, 0, syntax.stderr || 'patched world-info.js failed syntax check');

    const helperStart = patched.indexOf('// XINGZHAN_CARD_WORLD_SCOPE_V3');
    const helperEnd = patched.indexOf('async function getCharacterLore()', helperStart);
    assert.ok(helperStart >= 0 && helperEnd > helperStart, 'scope helpers should be present');
    const context = {
        characters: [
            { name: 'A', avatar: 'a.png', data: { extensions: { world: 'A-Primary' } } },
            { name: 'B', avatar: 'b.png', data: { extensions: { world: 'B-Primary' } } },
        ],
        this_chid: 0,
        world_info: { charLore: [{ name: 'a.png', extraBooks: ['A-Extra'] }], characterWorldBooks: {} },
        world_names: ['A-Primary', 'A-Extra', 'B-Primary', 'Global-A', 'Global-B'],
        selected_world_info: ['Global-A', 'Global-B'],
        chat_metadata: {},
        METADATA_KEY: 'world_info',
        power_user: {},
        getCharaFilename: index => context.characters[index]?.avatar,
    };
    vm.runInNewContext(patched.slice(helperStart, helperEnd) + '\nglobalThis.scopeProbe = { getCharacterBoundWorldBooks, getCharacterWorldBookScope, getEffectiveGlobalWorldBooks };', context);
    assert.deepEqual(Array.from(context.scopeProbe.getCharacterWorldBookScope()), ['A-Primary', 'A-Extra'], 'first-use scope should contain only card-linked books');
    assert.deepEqual(Array.from(context.scopeProbe.getEffectiveGlobalWorldBooks()), [], 'global books should be off by default for cards');
    context.world_info.characterWorldBooks['a.png'] = ['A-Primary', 'Global-B'];
    assert.deepEqual(Array.from(context.scopeProbe.getEffectiveGlobalWorldBooks()), ['Global-B'], 'manual choices should add only selected global books');
    context.this_chid = 1;
    assert.deepEqual(Array.from(context.scopeProbe.getCharacterWorldBookScope()), ['B-Primary'], 'book selections should stay isolated by card');
    context.this_chid = -1;
    assert.deepEqual(Array.from(context.scopeProbe.getEffectiveGlobalWorldBooks()), ['Global-A', 'Global-B'], 'non-card contexts should retain native global behavior');

    const simulatedOldInstall = patched.replaceAll('XINGZHAN_CARD_WORLD_SCOPE_V3', 'XINGZHAN_CARD_WORLD_SCOPE_V2');
    await fs.writeFile(target, simulatedOldInstall);
    assert.equal(await patchCardWorldBookScope(root), true, 'old installed patch should upgrade');
    const upgraded = await fs.readFile(target, 'utf8');
    assert.match(upgraded, /XINGZHAN_CARD_WORLD_SCOPE_V3/);
    assert.doesNotMatch(upgraded, /XINGZHAN_CARD_WORLD_SCOPE_V2/);
    const upgradedSyntax = spawnSync(process.execPath, ['--check', target], { encoding: 'utf8' });
    assert.equal(upgradedSyntax.status, 0, upgradedSyntax.stderr || 'upgraded world-info.js failed syntax check');
    console.log('PASS: per-card worldbook scope patch installs, filters prompt sources, exposes a selector, and is idempotent.');
} finally {
    await fs.rm(root, { recursive: true, force: true });
}
