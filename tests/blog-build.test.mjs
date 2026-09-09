import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const release = {
  kind: 'release',
  slug: 'cortrix-rc2-release',
  title: 'Cortrix RC2: better retrieval, Apache 2.0, and practical fixes',
  description: 'Cortrix RC2 improves retrieval, moves project code to Apache 2.0, and tightens ingestion, reranking, and agent integration.',
  topic: 'Product updates',
  bodyFile: 'rc2-release.html',
  readMinutes: 8,
  featured: true,
  releaseTag: 'v1.0.0-rc.2',
  releaseDate: '2026-09-05T10:29:50Z',
  releaseUrl: 'https://github.com/cortrix/cortrix/releases/tag/v1.0.0-rc.2',
  evidenceUrl: 'https://github.com/cortrix/cortrix-benchmarks/releases/tag/cortrix-v1.0.0-rc.2-evidence-v1',
  image: '/assets/blog/rc2/rc2-retrieval.png',
  imageAlt: 'Cross-encoder retrieval scores in two benchmark rounds',
};

const reviewCandidate = {
  kind: 'article',
  visibility: 'review',
  slug: 'review-candidate',
  title: 'Review candidate',
  description: 'A local editorial candidate that must not enter indexable Blog outputs before publication.',
  topic: 'Inside Cortrix',
  bodyFile: 'review-candidate.html',
  readMinutes: 3,
  image: '/assets/blog/research-map.svg',
  imageAlt: 'Abstract review candidate illustration',
  sourceLabel: 'Public scenario',
  sourceUrl: 'https://github.com/cortrix/cortrix-demos',
};

async function fixture(run, { paperCount = 1 } = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), 'cortrix-blog-test-'));
  try {
    for (const part of ['scripts', 'components', 'content/blog']) await mkdir(path.join(dir, part), { recursive: true });
    await copyFile(path.join(root, 'scripts/build-blog.mjs'), path.join(dir, 'scripts/build-blog.mjs'));
    await copyFile(path.join(root, 'components/site-header.html'), path.join(dir, 'components/site-header.html'));
    const posts = JSON.parse(await readFile(path.join(root, 'content/blog/posts.json'), 'utf8'))
      .filter(post => (post.kind ?? 'paper') === 'paper')
      .slice(0, paperCount);
    await writeFile(path.join(dir, 'content/blog/posts.json'), JSON.stringify(posts));
    for (const [index, post] of posts.entries()) {
      const heading = index === 0 ? '<h2 id="stable-mechanism">Mechanism</h2>' : '<h2>Mechanism</h2>';
      await writeFile(path.join(dir, 'content/blog', post.bodyFile), `<p>Test article.</p>${heading}<p>Explanation.</p>`);
    }
    await writeFile(path.join(dir, 'sitemap.xml'), '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://cortrix.ai/</loc></url></urlset>');
    await writeFile(path.join(dir, 'llms.txt'), '# Cortrix\n');
    const build = (...args) => execFileSync(process.execPath, [path.join(dir, 'scripts/build-blog.mjs'), ...args], { encoding: 'utf8', stdio: 'pipe' });
    await run({ dir, posts, build });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function addRelease(dir, posts) {
  const withRelease = [...posts, release];
  await writeFile(path.join(dir, 'content/blog/posts.json'), JSON.stringify(withRelease));
  await writeFile(path.join(dir, 'content/blog', release.bodyFile), '<p>Release introduction.</p><h2>What changed</h2><p>Release details.</p>');
  return withRelease;
}

async function addReviewCandidate(dir, posts) {
  const withCandidate = [...posts, reviewCandidate];
  await writeFile(path.join(dir, 'content/blog/posts.json'), JSON.stringify(withCandidate));
  await writeFile(path.join(dir, 'content/blog', reviewCandidate.bodyFile), '<p>Review introduction.</p><h2>Review scope</h2><p>Local-only candidate.</p>');
  return withCandidate;
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

test('release metadata stays separate from the five-note paper series', async () => {
  await fixture(async ({ dir, posts, build }) => {
    const paper = posts[2];
    await addRelease(dir, posts);
    build();

    const index = await readFile(path.join(dir, 'blog/index.html'), 'utf8');
    const releaseArticle = await readFile(path.join(dir, 'blog', release.slug, 'index.html'), 'utf8');
    const paperArticle = await readFile(path.join(dir, 'blog', paper.slug, 'index.html'), 'utf8');
    const rss = await readFile(path.join(dir, 'blog/rss.xml'), 'utf8');

    assert.ok(index.indexOf('id="latest-release"') < index.indexOf('Start here'));
    assert.ok(index.indexOf(`/blog/${release.slug}/`) < index.indexOf(`/blog/${paper.slug}/`));
    assert.ok(rss.indexOf(`/blog/${release.slug}/`) < rss.indexOf(`/blog/${paper.slug}/`));
    assert.match(releaseArticle, /Release update · Product updates/);
    assert.match(releaseArticle, /Released Sept 5, 2026/);
    assert.match(releaseArticle, /"@type": "SoftwareSourceCode"/);
    assert.match(releaseArticle, /Related reading/);
    assert.doesNotMatch(releaseArticle, /Source paper|Research Note 0|Paper published|papers being implemented/);
    assert.match(paperArticle, /"@type": "ScholarlyArticle"/);
    assert.doesNotMatch(paperArticle, /cortrix-rc2-release|Next note[^]*Cortrix RC2/);
    const series = paperArticle.split('<section class="article-series"', 2)[1].split('</section>', 1)[0];
    assert.equal((series.match(/<li/g) ?? []).length, 5);
  }, { paperCount: 5 });
});

test('release entries do not require paper metadata or a Blog publication date', async () => {
  await fixture(async ({ dir, posts, build }) => {
    await addRelease(dir, posts);
    build();
    const article = await readFile(path.join(dir, 'blog', release.slug, 'index.html'), 'utf8');
    assert.doesNotMatch(article, /article:published_time|"datePublished"/);
    assert.match(article, new RegExp(release.releaseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(article, new RegExp(release.evidenceUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
});

test('review candidates are generated locally but excluded from public Blog outputs', async () => {
  await fixture(async ({ dir, posts, build }) => {
    await addReviewCandidate(dir, posts);
    build();
    const index = await readFile(path.join(dir, 'blog/index.html'), 'utf8');
    const rss = await readFile(path.join(dir, 'blog/rss.xml'), 'utf8');
    const sitemap = await readFile(path.join(dir, 'sitemap.xml'), 'utf8');
    const article = await readFile(path.join(dir, 'blog', reviewCandidate.slug, 'index.html'), 'utf8');
    assert.doesNotMatch(index, new RegExp(`/blog/${reviewCandidate.slug}/`));
    assert.doesNotMatch(rss, new RegExp(`/blog/${reviewCandidate.slug}/`));
    assert.doesNotMatch(sitemap, new RegExp(`/blog/${reviewCandidate.slug}/`));
    assert.match(article, /noindex, nofollow, noarchive/);
  });
});
