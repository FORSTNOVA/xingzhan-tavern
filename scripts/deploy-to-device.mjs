import {execFileSync} from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const root = path.resolve(import.meta.dirname, '..');
const adb = 'C:/Users/21654/AppData/Local/Android/Sdk/platform-tools/adb.exe';
const deviceId = 'ca168055';

function runAdb(args) {
 return execFileSync(adb, ['-s', deviceId, ...args], { encoding: 'utf8' });
}

console.log('1. Packing synthesis files...');
execFileSync('node', [path.join(root, 'scripts/pack-synthesis.mjs')], { stdio: 'inherit' });

console.log('2. Pushing files to device /data/local/tmp...');
const filesToPush = [
 { local: path.join(root, 'app/src/main/assets/android-media.mjs'), remoteTmp: '/data/local/tmp/android-media.mjs', dest: 'files/tavern/android-media.mjs' },
 { local: path.join(root, 'plugins/xingzhan-synthesis/index.js'), remoteTmp: '/data/local/tmp/xs-index.js', dest: 'files/tavern/.android-global-extensions/xingzhan-synthesis/index.js' },
 { local: path.join(root, 'plugins/xingzhan-synthesis/style.css'), remoteTmp: '/data/local/tmp/xs-style.css', dest: 'files/tavern/.android-global-extensions/xingzhan-synthesis/style.css' },
 { local: path.join(root, 'plugins/xingzhan-synthesis/system.js'), remoteTmp: '/data/local/tmp/xs-system.js', dest: 'files/tavern/.android-global-extensions/xingzhan-synthesis/system.js' },
 { local: path.join(root, 'plugins/xingzhan-synthesis/media.js'), remoteTmp: '/data/local/tmp/xs-media.js', dest: 'files/tavern/.android-global-extensions/xingzhan-synthesis/media.js' },
 { local: path.join(root, 'plugins/xingzhan-synthesis/manifest.json'), remoteTmp: '/data/local/tmp/xs-manifest.json', dest: 'files/tavern/.android-global-extensions/xingzhan-synthesis/manifest.json' }
];

for (const f of filesToPush) {
 runAdb(['push', f.local, f.remoteTmp]);
 runAdb(['shell', `run-as cn.jiuguan.probe cp ${f.remoteTmp} ${f.dest}`]);
}

console.log('3. Files deployed successfully to phone!');
