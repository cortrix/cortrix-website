const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../script.js'), 'utf8');
const start = source.indexOf('// --- GitHub Repository Stats ---');
const end = source.indexOf('// --- Copy Buttons ---');
assert.ok(start >= 0 && end > start, 'The production stats block must exist');

async function render(cache, { legacy = false, live = null, badge = undefined } = {}) {
  const node = { textContent: '76' };
  const storage = new Map();
  if (cache) storage.set(legacy ? 'cortrix-github-repo-stats' : 'cortrix-github-repo-stats-v2', JSON.stringify(cache));
  let requests = 0;
  const attributes = {};
  const dataset = { githubApi: 'https://api.github.com/repos/cortrix/cortrix' };
  if (badge !== undefined) dataset.githubStarsFallback = 'https://img.shields.io/github/stars/cortrix/cortrix.json';
  vm.runInNewContext(source.slice(start, end), {
    document: {
      querySelector: () => ({ dataset, setAttribute(name, value) { attributes[name] = value; } }),
      getElementById: () => node,
    },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    fetch: async url => {
      requests++;
      if (String(url).startsWith('https://img.shields.io/')) {
        return { ok: badge !== null, status: badge === null ? 503 : 200, json: async () => ({ value: badge }) };
      }
      return { ok: live !== null, status: live === null ? 403 : 200, json: async () => ({ stargazers_count: live }) };
    },
    Intl, Number, Date, JSON, Error, String, Math,
  });
  for (let turn = 0; turn < 10; turn++) await new Promise(resolve => setImmediate(resolve));
  return { displayed: node.textContent, requests, ...(badge !== undefined ? { label: attributes['aria-label'] ?? null } : {}) };
}

test('expired cache cannot replace the snapshot when GitHub is unavailable', async () => {
  assert.deepEqual(await render({ stars: 9, updatedAt: Date.now() - 3600000 }), { displayed: '76', requests: 1 });
});
test('legacy cache is ignored even when its timestamp is fresh', async () => {
  assert.deepEqual(await render({ stars: 9, updatedAt: Date.now() }, { legacy: true }), { displayed: '76', requests: 1 });
});
test('fresh valid cache is reused without an unnecessary request', async () => {
  assert.deepEqual(await render({ stars: 62, updatedAt: Date.now() }), { displayed: '62', requests: 0 });
});
test('future timestamps are not accepted as fresh', async () => {
  assert.deepEqual(await render({ stars: 9, updatedAt: Date.now() + 3600000 }), { displayed: '76', requests: 1 });
});
test('successful live results replace the snapshot', async () => {
  assert.deepEqual(await render(null, { live: 63 }), { displayed: '63', requests: 1 });
});
test('a rate-limited GitHub API falls back to the badge endpoint', async () => {
  assert.deepEqual(await render(null, { badge: '81' }), { displayed: '81', requests: 2, label: 'Cortrix on GitHub, 81 stars' });
});
test('a compact badge value is shown as an approximate count', async () => {
  assert.deepEqual(await render(null, { badge: '1.2k' }), { displayed: '1.2K', requests: 2, label: 'Cortrix on GitHub, about 1,200 stars' });
});
test('the live GitHub count wins and the fallback is not requested', async () => {
  assert.deepEqual(await render(null, { live: 80, badge: '79' }), { displayed: '80', requests: 1, label: 'Cortrix on GitHub, 80 stars' });
});
test('the snapshot stays when both sources fail', async () => {
  assert.deepEqual(await render(null, { badge: null }), { displayed: '76', requests: 2, label: null });
});
test('an unreadable badge value keeps the snapshot', async () => {
  assert.deepEqual(await render(null, { badge: 'invalid' }), { displayed: '76', requests: 2, label: null });
});
