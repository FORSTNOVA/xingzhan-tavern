import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const fixtureRoot = path.resolve('artifacts/local-sd/queue-cancel-fixture-' + Date.now());
await fs.mkdir(path.join(fixtureRoot, 'src/endpoints'), { recursive: true });
await fs.writeFile(path.join(fixtureRoot, 'src/endpoints/secrets.js'),
  'export const readSecret=()=>""; export const writeSecret=()=>{}; export const deleteSecret=()=>{};');
await fs.copyFile('app/src/main/assets/android-media.mjs', path.join(fixtureRoot, 'android-media.mjs'));
const { ImageTaskQueue, stopLocalEngineRun } = await import(pathToFileURL(path.join(fixtureRoot, 'android-media.mjs')));

function response() {
  return {
    headersSent: false,
    destroyed: false,
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; this.headersSent = true; return this; }
  };
}

function task(id, onCancel = async () => {}) {
  return {
    id,
    prompt: id,
    ratio: '1:1',
    model: 'local/test',
    source: 'local',
    status: 'running',
    controller: new AbortController(),
    subscribers: [{ res: response() }],
    onCancel
  };
}

const queue = new ImageTaskQueue();
let activeStops = 0;
const active = task('active', async () => { activeStops++; });
const waiting = task('waiting');
queue.activeTask = active;
queue.queue.push(waiting);
let dispatchCalls = 0;
queue.dispatchNext = () => { dispatchCalls++; };

const queuedResult = await queue.cancelTask('waiting');
assert.equal(queuedResult.success, true);
assert.equal(queuedResult.cancelledCount, 1);
assert.equal(activeStops, 0, 'cancelling a queued task must not stop the active engine process');
assert.equal(queue.activeTask, active);
assert.equal(active.status, 'running');
assert.equal(queue.queue.length, 0);
assert.equal(dispatchCalls, 0, 'the active task still owns the queue slot');

const unknownResult = await queue.cancelTask('missing');
assert.equal(unknownResult.success, false);
assert.equal(activeStops, 0, 'an unknown task ID must not affect the active process');
assert.equal(queue.activeTask, active);

let finishStop;
active.onCancel = () => new Promise(resolve => { activeStops++; finishStop = resolve; });
const activeCancellation = queue.cancelTask('active');
await new Promise(resolve => setImmediate(resolve));
assert.equal(active.status, 'cancelling');
assert.equal(queue.activeTask, active, 'keep the queue slot until the active execution finishes');
assert.equal(active.controller.signal.aborted, false, 'wait for engine shutdown before releasing the request');
assert.equal(dispatchCalls, 0);
finishStop();
const activeResult = await activeCancellation;
assert.equal(activeResult.success, true);
assert.equal(active.status, 'cancelled');
assert.equal(active.controller.signal.aborted, true);
assert.equal(queue.activeTask, active, 'the execution finalizer, not cancelTask, releases the slot');
assert.equal(active.subscribers[0].res.statusCode, 499);

function fakeRun({ termCloses, graceMs }) {
  let resolveClose;
  let resolveDone;
  const run = {
    child: { pid: 4242, signals: [], kill(signal) {
      this.signals.push(signal);
      if (signal === 'SIGTERM' && termCloses) setTimeout(() => close(), 10);
      if (signal === 'SIGKILL') setTimeout(() => close(), 10);
      return true;
    } },
    closed: false,
    stopPromise: null,
    closePromise: new Promise(resolve => { resolveClose = resolve; }),
    donePromise: new Promise(resolve => { resolveDone = resolve; })
  };
  const close = () => {
    if (run.closed) return;
    run.closed = true;
    resolveClose();
    setTimeout(resolveDone, 15);
  };
  return { run, graceMs };
}

const gracefulRun = fakeRun({ termCloses: true, graceMs: 100 });
await stopLocalEngineRun(gracefulRun.run, gracefulRun.graceMs);
assert.deepEqual(gracefulRun.run.child.signals, ['SIGTERM']);
assert.equal(gracefulRun.run.closed, true);

const forcedRun = fakeRun({ termCloses: false, graceMs: 5 });
await stopLocalEngineRun(forcedRun.run, forcedRun.graceMs);
assert.deepEqual(forcedRun.run.child.signals, ['SIGTERM', 'SIGKILL']);
assert.equal(forcedRun.run.closed, true);

console.log('PASS: queue cancellation is isolated; active slots persist through cancellation; tracked children receive TERM then KILL only if needed and shutdown waits for close/cleanup.');
