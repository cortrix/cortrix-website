import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
async function fixture(run) {
  const dir = await mkdtemp(path.join(tmpdir(), 'cortrix-blog-test-'));
  try {
    for (const part of ['scripts', 'components', 'content/blog']) await mkdir(path.join(dir, part), { recursive: true });
    await copyFile(path.join(root, 'scripts/build-blog.mjs'), path.join(dir, 'scripts/build-blog.mjs'));
    await copyFile(path.join(root, 'components/site-header.html'), path.join(dir, 'components/site-header.html'));
    const posts = JSON.parse(await readFile(path.join(root, 'content/blog/posts.json'), 'utf8')).slice(0, 1);
    await writeFile(path.join(dir, 'content/blog/posts.json'), JSON.stringify(posts));
    await writeFile(path.join(dir, 'content/blog', posts[0].bodyFile), '<p>Test article.</p><h2 id="stable-mechanism">Mechanism</h2><p>Explanation.</p>');
    await writeFile(path.join(dir, 'sitemap.xml'), '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://cortrix.ai/</loc></url></urlset>');
    await writeFile(path.join(dir, 'llms.txt'), '# Cortrix\n');
    const build = (...args) => execFileSync(process.execPath, [path.join(dir, 'scripts/build-blog.mjs'), ...args], { encoding: 'utf8', stdio: 'pipe' });
    await run({ dir, posts, build });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('build is deterministic and check detects a changed source', async () => {
  await fixture(async ({ dir, posts, build }) => {
    build();
    const target = path.join(dir, 'blog', posts[0].slug, 'index.html');
    const before = await readFile(target, 'utf8');
    assert.match(before, /<h2 id="stable-mechanism">Mechanism<\/h2>/);
    assert.match(before, /href="#stable-mechanism"/);
    build();
    assert.equal(await readFile(target, 'utf8'), before);
    assert.match(build('--check'), /current/);
    await writeFile(path.join(dir, 'content/blog', posts[0].bodyFile), '<p>Revised article.</p><h2>Mechanism</h2>');
    assert.throws(() => build('--check'), /stale/);
    assert.equal(await readFile(target, 'utf8'), before);
  });
});

test('unlisted directories are preserved without partial output changes', async () => {
  await fixture(async ({ dir, build }) => {
    build();
    const index = await readFile(path.join(dir, 'blog/index.html'), 'utf8');
    await mkdir(path.join(dir, 'blog/manual'));
    await writeFile(path.join(dir, 'blog/manual/index.html'), 'Hand authored');
    assert.throws(() => build(), /explicit removal or redirect decision/);
    assert.equal(await readFile(path.join(dir, 'blog/manual/index.html'), 'utf8'), 'Hand authored');
    assert.equal(await readFile(path.join(dir, 'blog/index.html'), 'utf8'), index);
  });
});

test('a metadata slug cannot claim an existing hand authored page', async () => {
  await fixture(async ({ dir, posts, build }) => {
    const folder = path.join(dir, 'blog', posts[0].slug);
    await mkdir(folder, { recursive: true });
    await writeFile(path.join(folder, 'index.html'), 'Hand authored');
    assert.throws(() => build(), /Refusing to overwrite/);
    assert.equal(await readFile(path.join(folder, 'index.html'), 'utf8'), 'Hand authored');
    await assert.rejects(readFile(path.join(dir, 'blog/index.html')), { code: 'ENOENT' });
  });
});
