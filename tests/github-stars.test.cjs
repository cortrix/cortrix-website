const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../script.js'), 'utf8');
const start = source.indexOf('// --- GitHub Repository Stats ---');
const end = source.indexOf('// --- Copy Buttons ---');
assert.ok(start >= 0 && end > start, 'The production stats block must exist');

async function render(cache, { legacy = false, live = null } = {}) {
  const node = { textContent: '61' };
  const storage = new Map();
  if (cache) storage.set(legacy ? 'cortrix-github-repo-stats' : 'cortrix-github-repo-stats-v2', JSON.stringify(cache));
  let requests = 0;
  vm.runInNewContext(source.slice(start, end), {
    document: {
      querySelector: () => ({ dataset: { githubApi: 'https://api.github.com/repos/cortrix/cortrix' }, setAttribute() {} }),
      getElementById: () => node,
    },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    fetch: async () => { requests++; return { ok: live !== null, status: live === null ? 403 : 200, json: async () => ({ stargazers_count: live }) }; },
    Intl, Number, Date, JSON, Error,
  });
  await new Promise(resolve => setImmediate(resolve));
  return { displayed: node.textContent, requests };
}

test('expired cache cannot replace the snapshot when GitHub is unavailable', async () => {
  assert.deepEqual(await render({ stars: 9, updatedAt: Date.now() - 3600000 }), { displayed: '61', requests: 1 });
});
test('legacy cache is ignored even when its timestamp is fresh', async () => {
  assert.deepEqual(await render({ stars: 9, updatedAt: Date.now() }, { legacy: true }), { displayed: '61', requests: 1 });
});
test('fresh valid cache is reused without an unnecessary request', async () => {
  assert.deepEqual(await render({ stars: 62, updatedAt: Date.now() }), { displayed: '62', requests: 0 });
});
test('future timestamps are not accepted as fresh', async () => {
  assert.deepEqual(await render({ stars: 9, updatedAt: Date.now() + 3600000 }), { displayed: '61', requests: 1 });
});
test('successful live results replace the snapshot', async () => {
  assert.deepEqual(await render(null, { live: 63 }), { displayed: '63', requests: 1 });
});
