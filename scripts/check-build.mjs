import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import Cube from 'cubejs';

const root = resolve('out');
const sw = await readFile(resolve(root, 'sw.js'), 'utf8');
const files = [...sw.matchAll(/\{url:"([^"]+)",revision:/g)].map(m => m[1]);
assert(files.length > 20, 'Service worker must contain the exported app assets.');
for (const file of files) assert((await stat(resolve(root, file))).isFile(), `Missing cached asset: ${file}`);
for (const asset of ['index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png']) assert(files.includes(asset), `Not cached: ${asset}`);
assert(files.some(file => file.endsWith('.woff2')), 'Local fonts must be available offline.');

const chunks = await readdir(resolve(root, '_next/static/chunks'));
let workerPath;
let turboBootstrap;
for (const file of chunks.filter(file => file.endsWith('.js'))) {
  const path = resolve(root, '_next/static/chunks', file);
  const code = await readFile(path, 'utf8');
  if (code.includes('Solusi belum cocok')) workerPath = path;
  const match = code.match(/\.f\("(static\/chunks\/turbopack-worker[^\"]+)",(\[[^\]]+\])\)/);
  if (match) turboBootstrap = { entry: match[1], chunks: JSON.parse(match[2]) };
}
assert(workerPath, 'Next.js must emit the local solver worker.');
const messages = [];
const loaded = [];
const sandbox = { console, URL, performance, setTimeout, clearTimeout, postMessage: message => messages.push(message) };
sandbox.self = sandbox;
const context = vm.createContext(sandbox);
sandbox.importScripts = (...urls) => {
  for (const url of urls) {
    const path = resolve(root, new URL(url, 'https://rubik.test').pathname.slice(1));
    const relative = path.slice(root.length + 1);
    assert(files.includes(relative), `Worker dependency is not cached: ${relative}`);
    loaded.push(relative);
    vm.runInContext(readFileSync(path, 'utf8'), context, { filename: path });
  }
};
if (turboBootstrap) {
  // Execute Turbopack's real browser-worker bootstrap, including its runtime
  // and module registration chunks, rather than evaluating source modules.
  vm.runInContext('class WorkerGlobalScope {}; Object.setPrototypeOf(self, WorkerGlobalScope.prototype); self.WorkerGlobalScope = WorkerGlobalScope;', context);
  const params = [turboBootstrap.chunks.map(chunk => `/_next/${chunk}`).reverse(), '', '/_next/', '', ''];
  sandbox.location = new URL(`https://rubik.test/_next/${turboBootstrap.entry}#params=${encodeURIComponent(JSON.stringify(params))}`);
  sandbox.importScripts(sandbox.location.href);
  await new Promise(resolve => setImmediate(resolve));
} else {
  vm.runInContext(await readFile(workerPath, 'utf8'), context, { filename: workerPath });
  await sandbox._N_E;
}
assert.equal(typeof sandbox.onmessage, 'function');
const initial = new Cube().move("R U R' U' F2 D L2 B U2 R2").asString();
sandbox.onmessage({ data: initial });
const solution = messages.find(message => message.type === 'solution');
assert(solution, JSON.stringify(messages));
assert(Cube.fromString(initial).move(solution.moves.join(' ')).isSolved());
messages.length = 0;
sandbox.onmessage({ data: '?'.repeat(54) });
assert.equal(messages[0].type, 'error');
console.log(`Export verified: ${files.length} cached assets, ${loaded.length} cached worker dependencies, actual compiled worker solves a scramble and rejects invalid input.`);
