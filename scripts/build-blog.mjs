import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const contentDirectory = path.join(projectRoot, 'content', 'blog');
const postsPath = path.join(contentDirectory, 'posts.json');
const blogDirectory = path.join(projectRoot, 'blog');
const headerPath = path.join(projectRoot, 'components', 'site-header.html');
const sitemapPath = path.join(projectRoot, 'sitemap.xml');
const llmsPath = path.join(projectRoot, 'llms.txt');
const checkOnly = process.argv.includes('--check');
const siteUrl = 'https://cortrix.ai';
const startMarker = '<!-- generated:blog:start -->';
const endMarker = '<!-- generated:blog:end -->';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeXml(value) {
  return escapeHtml(value);
}

function jsonForHtml(value) {
  return JSON.stringify(value, null, 2).replaceAll('<', '\\u003c');
}

function slugifyHeading(value) {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/&[a-zA-Z0-9#]+;/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';
}

function plainText(value) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeAuthors(value, index) {
  const authors = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/\s*(?:;|\band\b)\s*/i)
      : [];
  const normalized = authors.map(author => String(author).trim()).filter(Boolean);
  if (normalized.length === 0) {
    throw new Error(`posts.json[${index}].paperAuthors must name at least one author`);
  }
  return normalized;
}

function validateDate(value, field, index) {
  if (value === undefined) return;
  if (typeof value !== 'string'
      || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)
      || Number.isNaN(Date.parse(value))) {
    throw new Error(`posts.json[${index}].${field} must be an ISO date or date-time`);
  }
}

function validateUrl(value, field, index) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`posts.json[${index}].${field} must be a valid URL`);
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`posts.json[${index}].${field} must use HTTP or HTTPS`);
  }
}

function validatePosts(rawPosts) {
  if (!Array.isArray(rawPosts) || rawPosts.length === 0) {
    throw new Error('posts.json must contain a non-empty array');
  }

  const requiredStrings = ['slug', 'title', 'description', 'topic', 'bodyFile'];
  const slugs = new Set();
  const titles = new Set();
  const orders = new Set();
  let featuredCount = 0;

  return rawPosts.map((rawPost, index) => {
    if (!rawPost || typeof rawPost !== 'object' || Array.isArray(rawPost)) {
      throw new Error(`posts.json[${index}] must be an object`);
    }
    const kind = rawPost.kind ?? 'paper';
    if (!['paper', 'release'].includes(kind)) {
      throw new Error(`posts.json[${index}].kind must be paper or release`);
    }
    const kindStrings = kind === 'paper'
      ? ['paperTitle', 'paperUrl']
      : ['releaseTag', 'releaseUrl', 'evidenceUrl', 'image', 'imageAlt'];
    for (const field of [...requiredStrings, ...kindStrings]) {
      if (typeof rawPost[field] !== 'string' || rawPost[field].trim() === '') {
        throw new Error(`posts.json[${index}].${field} must be a non-empty string`);
      }
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(rawPost.slug)) {
      throw new Error(`posts.json[${index}].slug must be a lowercase URL slug`);
    }
    if (!Number.isInteger(rawPost.readMinutes) || rawPost.readMinutes < 1) {
      throw new Error(`posts.json[${index}].readMinutes must be a positive integer`);
    }
    if (kind === 'paper') {
      if (!Number.isInteger(rawPost.paperYear) || rawPost.paperYear < 1900 || rawPost.paperYear > 2100) {
        throw new Error(`posts.json[${index}].paperYear must be a four-digit integer`);
      }
      if (!Number.isInteger(rawPost.seriesOrder) || rawPost.seriesOrder < 1) {
        throw new Error(`posts.json[${index}].seriesOrder must be a positive integer`);
      }
      validateUrl(rawPost.paperUrl, 'paperUrl', index);
      if (orders.has(rawPost.seriesOrder)) throw new Error(`Duplicate seriesOrder: ${rawPost.seriesOrder}`);
      orders.add(rawPost.seriesOrder);
    } else {
      validateDate(rawPost.releaseDate, 'releaseDate', index);
      if (!rawPost.releaseDate) throw new Error(`posts.json[${index}].releaseDate must be an ISO date or date-time`);
      validateUrl(rawPost.releaseUrl, 'releaseUrl', index);
      validateUrl(rawPost.evidenceUrl, 'evidenceUrl', index);
      if (!rawPost.image.startsWith('/') || path.normalize(rawPost.image).startsWith('..')) {
        throw new Error(`posts.json[${index}].image must be a root-relative path`);
      }
      if (rawPost.featured !== undefined && typeof rawPost.featured !== 'boolean') {
        throw new Error(`posts.json[${index}].featured must be a boolean`);
      }
      if (rawPost.featured) featuredCount += 1;
    }
    if (path.isAbsolute(rawPost.bodyFile)
        || path.normalize(rawPost.bodyFile).startsWith('..')
        || !rawPost.bodyFile.endsWith('.html')) {
      throw new Error(`posts.json[${index}].bodyFile must be a safe relative .html path`);
    }
    validateDate(rawPost.publishedAt, 'publishedAt', index);
    validateDate(rawPost.updatedAt, 'updatedAt', index);
    if (rawPost.updatedAt && rawPost.publishedAt
        && Date.parse(rawPost.updatedAt) < Date.parse(rawPost.publishedAt)) {
      throw new Error(`posts.json[${index}].updatedAt cannot precede publishedAt`);
    }
    if (slugs.has(rawPost.slug)) throw new Error(`Duplicate slug: ${rawPost.slug}`);
    if (titles.has(rawPost.title)) throw new Error(`Duplicate title: ${rawPost.title}`);
    slugs.add(rawPost.slug);
    titles.add(rawPost.title);

    return {
      ...rawPost,
      kind,
      description: rawPost.description.trim(),
      ...(kind === 'paper' ? { paperAuthors: normalizeAuthors(rawPost.paperAuthors, index) } : {}),
    };
  }).sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    if (a.kind !== b.kind) return a.kind === 'release' ? -1 : 1;
    if (a.kind === 'release') return Date.parse(b.releaseDate) - Date.parse(a.releaseDate);
    return a.seriesOrder - b.seriesOrder;
  }).map((post, index, posts) => {
    if (index === 0 && featuredCount > 1) throw new Error('Only one Blog post may be featured');
    return post;
  });
}

function addHeadingIds(body) {
  const headings = [];
  const usedIds = new Set();
  const html = body.replace(/<h2(?:\s+[^>]*)?>([\s\S]*?)<\/h2>/gi, (match, inner) => {
    const label = plainText(inner);
    if (!label) return match;
    const explicitId = match.match(/\bid=(?:"([^"]*)"|'([^']*)')/i);
    let id = explicitId ? (explicitId[1] ?? explicitId[2]) : slugifyHeading(inner);
    if (explicitId && (!/^[A-Za-z][\w:.-]*$/.test(id) || usedIds.has(id))) {
      throw new Error('Heading IDs must be unique and safe: ' + id);
    }
    let suffix = 2;
    while (usedIds.has(id)) id = `${slugifyHeading(inner)}-${suffix++}`;
    usedIds.add(id);
    headings.push({ id, label });
    const attributes = match.match(/^<h2(\s+[^>]*)?>/i)?.[1] || '';
    const withoutId = attributes.replace(/\s+id=(?:"[^"]*"|'[^']*'|[^\s>]+)/i, '');
    return `<h2${withoutId} id="${id}">${inner}</h2>`;
  });
  return { html, headings };
}

function renderHeader(header) {
  return `<!-- include:site-header:start -->\n${header.trim()}\n<!-- include:site-header:end -->`;
}

function renderMeta({ title, description, url, type = 'website', structuredData, post }) {
  const image = post?.image ? `${siteUrl}${post.image}` : `${siteUrl}/assets/blog/social-card.png`;
  const imageAlt = post?.imageAlt ?? 'Cortrix';
  const dates = post
    ? [
        post.publishedAt ? `  <meta property="article:published_time" content="${escapeHtml(post.publishedAt)}">` : '',
        post.updatedAt ? `  <meta property="article:modified_time" content="${escapeHtml(post.updatedAt)}">` : '',
      ].filter(Boolean).join('\n')
    : '';
  return `
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="author" content="Scott">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <link rel="canonical" href="${escapeHtml(url)}">
  <link rel="alternate" type="application/rss+xml" title="Cortrix Blog RSS" href="${siteUrl}/blog/rss.xml">
  <meta property="og:type" content="${type}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(url)}">
  <meta property="og:site_name" content="Cortrix">
  <meta property="og:image" content="${escapeHtml(image)}">
  <meta property="og:image:alt" content="${escapeHtml(imageAlt)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${escapeHtml(image)}">
  <meta name="twitter:image:alt" content="${escapeHtml(imageAlt)}">
${dates ? `${dates}\n` : ''}  <script type="application/ld+json">${jsonForHtml(structuredData)}</script>
  <link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">
  <link rel="stylesheet" href="/styles.css">
  <link rel="stylesheet" href="/assets/blog/blog.css">
  <link rel="stylesheet" href="/assets/blog/image-dialog.css">`;
}

function renderCard(post, featured = false) {
  const isRelease = post.kind === 'release';
  const visual = isRelease ? post.image : '/assets/blog/research-map.svg';
  const visualAlt = isRelease ? post.imageAlt : '';
  const label = isRelease ? post.releaseTag : String(post.seriesOrder).padStart(2, '0');
  const metadata = isRelease
    ? `<span>${escapeHtml(post.topic)}</span><span>${escapeHtml(post.releaseTag)}</span><span>Released ${escapeHtml(formatShortDate(post.releaseDate))}</span><span>${post.readMinutes} min read</span>`
    : `<span>${escapeHtml(post.topic)}</span><span>Paper: ${post.paperYear}</span><span>Note ${String(post.seriesOrder).padStart(2, '0')}</span><span>${post.readMinutes} min read</span>`;
  return `<article class="blog-card${featured ? ' blog-card-featured' : ''}" data-blog-card data-topic="${escapeHtml(post.topic)}">
${featured ? `    <a class="blog-card-visual" href="/blog/${post.slug}/"${isRelease ? '' : ' tabindex="-1" aria-hidden="true"'}>
      <img src="${escapeHtml(visual)}" alt="${escapeHtml(visualAlt)}" width="${isRelease ? 1200 : 720}" height="${isRelease ? 630 : 430}">
      ${isRelease ? "" : `<span>${escapeHtml(label)}</span>`}
    </a>
` : ''}    <div class="blog-card-copy">
      <div class="blog-meta">${metadata}</div>
      <h${featured ? '2' : '3'}><a href="/blog/${post.slug}/">${escapeHtml(post.title)}</a></h${featured ? '2' : '3'}>
      <p>${escapeHtml(post.description)}</p>
      <a class="blog-read-link" href="/blog/${post.slug}/">Read article <span aria-hidden="true">→</span></a>
    </div>
  </article>`.replace(/^[ \\t]+$/gm, "");
}

function renderFooter() {
  return `<footer class="blog-footer">
    <div class="container blog-footer-inner">
      <div><a class="blog-footer-brand" href="/">Cortrix</a><p>Product updates and research notes for builders working with semantic data, retrieval, and agent memory.</p></div>
      <div class="blog-footer-links"><a href="/semantic-storage/">Semantic Storage</a><a href="/#architecture">Architecture</a><a href="/blog/rss.xml">RSS</a><a href="https://github.com/cortrix/cortrix">GitHub</a><a href="/community/">Community</a></div>
    </div>
  </footer>`;
}

function renderIndex(posts, header) {
  const papers = posts.filter(post => post.kind === 'paper');
  const latestRelease = posts.find(post => post.kind === 'release' && post.featured)
    ?? posts.find(post => post.kind === 'release');
  const featuredPaper = papers[0];
  const topics = [...new Set(posts.map(post => post.topic))];
  const title = 'Cortrix Blog | Semantic Storage Updates and Research';
  const description = 'Cortrix product updates and Scott’s personal readings on semantic storage, retrieval, knowledge graphs, and agent memory.';
  const url = `${siteUrl}/blog/`;
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Blog',
        '@id': `${url}#blog`,
        name: 'Cortrix Blog',
        description,
        url,
        author: { '@type': 'Person', name: 'Scott' },
        publisher: { '@type': 'Organization', name: 'Cortrix', url: siteUrl },
        blogPost: posts.map(post => ({
          '@type': 'BlogPosting',
          headline: post.title,
          description: post.description,
          url: `${siteUrl}/blog/${post.slug}/`,
          author: { '@type': 'Person', name: 'Scott' },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: url },
        ],
      },
    ],
  };

  return `<!DOCTYPE html>
<!-- generated:blog-page -->
<html lang="en">
<head>${renderMeta({ title, description, url, structuredData })}
</head>
<body class="blog-page">
  <a class="blog-skip-link" href="#main-content">Skip to content</a>
  ${renderHeader(header)}
  <main id="main-content">
    <header class="blog-hero">
      <div class="container blog-hero-grid">
        <div class="blog-hero-copy"><p class="blog-kicker">Product updates and research notes</p><h1><span>Cortrix Blog.</span><span>News and notes from Cortrix.</span></h1><p>Release updates from Cortrix alongside Scott’s personal readings on semantic storage, retrieval, knowledge graphs, and agent memory. Research notes explore ideas and their limits; they are not implementation notes for Cortrix.</p><a class="blog-rss-link" href="/blog/rss.xml">Follow via RSS <span aria-hidden="true">↗</span></a></div>
        <img src="/assets/blog/research-map.svg" alt="Abstract map of connected research concepts" width="720" height="430">
      </div>
    </header>
${latestRelease ? `    <section id="latest-release" class="blog-latest-release container" aria-labelledby="latest-release-title">
      <div class="blog-section-heading"><div><p class="blog-kicker">Latest release</p><h2 id="latest-release-title">${escapeHtml(latestRelease.releaseTag)}</h2></div><p>Our latest release update: retrieval results, licensing, and practical fixes.</p></div>
      ${renderCard(latestRelease, true)}
    </section>` : ''}
    <section class="blog-feature container" aria-labelledby="featured-title">
      <div class="blog-section-heading"><div><p class="blog-kicker">Start here</p><h2 id="featured-title">Start with DBpedia</h2></div><p>New to the series? Begin with the question of how knowledge gets a stable identity.</p></div>
      ${renderCard(featuredPaper, true)}
    </section>
    <section class="blog-library container" aria-labelledby="library-title">
      <div class="blog-section-heading"><div><p class="blog-kicker">Browse the Blog</p><h2 id="library-title">All articles</h2></div><p>Read in order, or pick the topic that interests you.</p></div>
      <div class="blog-filters" role="group" aria-label="Filter articles by topic">
        <button class="is-active" type="button" data-blog-filter="all" aria-pressed="true">All articles</button>
        ${topics.map(topic => `<button type="button" data-blog-filter="${escapeHtml(topic)}" aria-pressed="false">${escapeHtml(topic)}</button>`).join('\n        ')}
      </div>
      <div class="blog-card-grid" data-blog-grid>
        ${posts.map(post => renderCard(post)).join('\n        ')}
      </div>
      <p class="blog-empty" data-blog-empty hidden>No notes match this topic yet. Choose another filter to keep exploring.</p>
    </section>
  </main>
  ${renderFooter()}
  <script src="/script.js"></script>
  <script src="/assets/blog/image-dialog.js"></script>
  <script src="/assets/blog/blog.js"></script>
</body>
</html>
`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  }).format(new Date(value));
}

function formatShortDate(value) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
  }).format(new Date(value)).replace(/^Sep\b/, 'Sept');
}

function renderArticle(post, posts, body, header) {
  const papers = posts.filter(item => item.kind === 'paper');
  const paperIndex = papers.indexOf(post);
  const previous = paperIndex >= 0 ? papers[paperIndex - 1] : undefined;
  const next = paperIndex >= 0 ? papers[paperIndex + 1] : undefined;
  const processed = addHeadingIds(body);
  const url = `${siteUrl}/blog/${post.slug}/`;
  const title = `${post.title} — Cortrix Blog`;
  const citation = post.kind === 'paper'
    ? {
        '@type': 'ScholarlyArticle',
        name: post.paperTitle,
        url: post.paperUrl,
        temporalCoverage: String(post.paperYear),
        author: post.paperAuthors.map(name => ({ '@type': 'Person', name })),
      }
    : {
        '@type': 'SoftwareSourceCode',
        name: `Cortrix ${post.releaseTag}`,
        url: post.releaseUrl,
        codeRepository: 'https://github.com/cortrix/cortrix',
        about: {
          '@type': 'CreativeWork',
          name: 'Published benchmark evidence',
          url: post.evidenceUrl,
        },
      };
  const blogPosting = {
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    headline: post.title,
    description: post.description,
    url,
    mainEntityOfPage: url,
    author: { '@type': 'Person', name: 'Scott' },
    publisher: { '@type': 'Organization', name: 'Cortrix', url: siteUrl },
    isPartOf: { '@type': 'Blog', name: 'Cortrix Blog', url: `${siteUrl}/blog/` },
    citation,
    inLanguage: 'en',
    image: [`${post.image ? siteUrl + post.image : siteUrl + '/assets/blog/social-card.png'}`],
  };
  if (post.publishedAt) blogPosting.datePublished = post.publishedAt;
  if (post.updatedAt) blogPosting.dateModified = post.updatedAt;
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      blogPosting,
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: `${siteUrl}/blog/` },
          { '@type': 'ListItem', position: 3, name: post.title, item: url },
        ],
      },
    ],
  };
  const dateLine = [
    post.publishedAt ? `Published ${formatDate(post.publishedAt)}` : '',
    post.updatedAt ? `Updated ${formatDate(post.updatedAt)}` : '',
  ].filter(Boolean).join(' · ');
  const isRelease = post.kind === 'release';
  const breadcrumbLabel = isRelease ? post.releaseTag : `Note ${String(post.seriesOrder).padStart(2, '0')}`;
  const kicker = isRelease
    ? `Release update · ${escapeHtml(post.topic)}`
    : `Research Note ${String(post.seriesOrder).padStart(2, '0')} · ${escapeHtml(post.topic)}`;
  const byline = isRelease
    ? `<span>By Scott</span><span>${post.readMinutes} min read</span><span>Released ${escapeHtml(formatShortDate(post.releaseDate))}</span>${dateLine ? `<span>${escapeHtml(dateLine)}</span>` : ''}`
    : `<span>By Scott</span><span>${post.readMinutes} min read</span><span>Paper published ${post.paperYear}</span>${dateLine ? `<span>${escapeHtml(dateLine)}</span>` : ''}`;
  const sourceCard = isRelease
    ? `<div class="article-paper-card article-release-card"><div><p class="blog-kicker">Release sources</p><h2>${escapeHtml(post.releaseTag)}</h2><p>Published release details and benchmark evidence</p></div><div class="article-source-links"><a href="${escapeHtml(post.releaseUrl)}" target="_blank" rel="noopener noreferrer">Source release <span aria-hidden="true">↗</span></a><a href="${escapeHtml(post.evidenceUrl)}" target="_blank" rel="noopener noreferrer">Benchmark evidence <span aria-hidden="true">↗</span></a></div></div>`
    : `<div class="article-paper-card"><div><p class="blog-kicker">Source paper</p><h2>${escapeHtml(post.paperTitle)}</h2><p>${escapeHtml(post.paperAuthors.length > 2 ? post.paperAuthors.slice(0, 2).join(', ') + ' et al.' : post.paperAuthors.join(', '))} · ${post.paperYear}</p></div><a href="${escapeHtml(post.paperUrl)}" target="_blank" rel="noopener noreferrer">Read the paper <span aria-hidden="true">↗</span></a></div>`;
  const authorDescription = isRelease
    ? 'Scott is one of Cortrix’s creators. He writes release updates that connect shipped changes with their public sources and practical implications.'
    : 'Scott is one of Cortrix’s creators. These research notes share his personal understanding of papers, with an emphasis on semantic storage and agent memory. They are not descriptions of papers being implemented in Cortrix.';
  const followOn = isRelease
    ? `<section class="article-series article-related" aria-labelledby="related-title"><div class="blog-section-heading"><div><p class="blog-kicker">Related reading</p><h2 id="related-title">Explore the research notes</h2></div><a class="blog-rss-link" href="/blog/rss.xml">RSS feed <span aria-hidden="true">↗</span></a></div><ol>${papers.map(item => `<li><span>${String(item.seriesOrder).padStart(2, '0')}</span><a href="/blog/${item.slug}/">${escapeHtml(item.title)}</a><small>${escapeHtml(item.topic)} · ${item.readMinutes} min</small></li>`).join('')}</ol></section>`
    : `<nav class="series-navigation" aria-label="Previous and next research notes">${previous ? `<a href="/blog/${previous.slug}/"><span>Previous note</span><strong>← ${escapeHtml(previous.title)}</strong></a>` : '<span></span>'}${next ? `<a href="/blog/${next.slug}/"><span>Next note</span><strong>${escapeHtml(next.title)} →</strong></a>` : '<span></span>'}</nav><section class="article-series" aria-labelledby="series-title"><div class="blog-section-heading"><div><p class="blog-kicker">Research Notes</p><h2 id="series-title">Continue the series</h2></div><a class="blog-rss-link" href="/blog/rss.xml">RSS feed <span aria-hidden="true">↗</span></a></div><ol>${papers.map(item => `<li${item.slug === post.slug ? ' aria-current="page"' : ''}><span>${String(item.seriesOrder).padStart(2, '0')}</span><a href="/blog/${item.slug}/">${escapeHtml(item.title)}</a><small>${escapeHtml(item.topic)} · ${item.readMinutes} min</small></li>`).join('')}</ol></section>`;

  return `<!DOCTYPE html>
<!-- generated:blog-page -->
<html lang="en">
<head>${renderMeta({ title, description: post.description, url, type: 'article', structuredData, post })}
</head>
<body class="blog-page article-page${isRelease ? " release-page" : ""}">
  <a class="blog-skip-link" href="#main-content">Skip to content</a>
  ${renderHeader(header)}
  <main id="main-content">
    <div class="article-shell container">
      <nav class="breadcrumbs" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li><a href="/blog/">Blog</a></li><li aria-current="page">${escapeHtml(breadcrumbLabel)}</li></ol></nav>
      <header class="article-header">
        <p class="blog-kicker">${kicker}</p>
        <h1>${escapeHtml(post.title)}</h1>
        <p class="article-deck">${escapeHtml(post.description)}</p>
        <div class="article-byline">${byline}</div>
      </header>
      ${sourceCard}
      <div class="article-layout">
        <aside class="article-toc" aria-label="On this page"><div><details class="article-contents"><summary>On this page</summary><ol>${processed.headings.map(heading => `<li><a href="#${heading.id}">${escapeHtml(heading.label)}</a></li>`).join('')}</ol></details></div></aside>
        <article class="article-body">${processed.html}</article>
      </div>
      <section class="article-author" aria-labelledby="about-author"><div class="author-mark" aria-hidden="true">S</div><div><p class="blog-kicker">About the author</p><h2 id="about-author">Scott</h2><p>${authorDescription}</p></div></section>
      ${followOn}
    </div>
  </main>
  ${renderFooter()}
  <script src="/script.js"></script>
  <script src="/assets/blog/image-dialog.js"></script>
</body>
</html>
`;
}

function renderRss(posts) {
  const items = posts.map(post => {
    const url = `${siteUrl}/blog/${post.slug}/`;
    return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <description>${escapeXml(post.description)}</description>
      <dc:creator>Scott</dc:creator>
      <category>${escapeXml(post.topic)}</category>${post.publishedAt ? `\n      <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>` : ''}
    </item>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Cortrix Blog</title>
    <link>${siteUrl}/blog/</link>
    <description>Cortrix product updates and practical readings on semantic systems, retrieval, and agent memory.</description>
    <language>en-us</language>
    <atom:link href="${siteUrl}/blog/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
}

function replaceGeneratedSection(source, renderedSection, location) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  if ((start === -1) !== (end === -1) || (start !== -1 && end < start)) {
    throw new Error(`${location} has invalid Blog generated markers`);
  }
  if (start !== -1) {
    return source.slice(0, start) + renderedSection + source.slice(end + endMarker.length);
  }
  if (location === 'sitemap.xml') {
    const closing = source.lastIndexOf('</urlset>');
    if (closing === -1) throw new Error('sitemap.xml is missing </urlset>');
    return `${source.slice(0, closing).trimEnd()}\n${renderedSection}\n</urlset>\n`;
  }
  return `${source.trimEnd()}\n\n${renderedSection}\n`;
}

function renderSitemapSection(posts) {
  const urls = [`${siteUrl}/blog/`, `${siteUrl}/blog/rss.xml`, ...posts.map(post => `${siteUrl}/blog/${post.slug}/`)];
  return `${startMarker}\n${urls.map(url => `  <url><loc>${url}</loc></url>`).join('\n')}\n  ${endMarker}`;
}

function renderLlmsSection(posts) {
  const releases = posts.filter(post => post.kind === 'release');
  const papers = posts.filter(post => post.kind === 'paper');
  return `${startMarker}
## Blog

- Blog index: ${siteUrl}/blog/
- RSS feed: ${siteUrl}/blog/rss.xml
${releases.map(post => `- Release update: ${post.title} — ${siteUrl}/blog/${post.slug}/ — source release: ${post.releaseUrl} — benchmark evidence: ${post.evidenceUrl}`).join('\n')}
${papers.map(post => `- Research Note ${String(post.seriesOrder).padStart(2, '0')}: ${post.title} — ${siteUrl}/blog/${post.slug}/ — source paper: ${post.paperTitle} (${post.paperYear}), ${post.paperUrl}`).join('\n')}

The Blog contains Cortrix product updates and Scott’s personal English interpretations of foundational papers. Research notes are not implementation notes for Cortrix. Release updates cite their source release and supporting evidence; research notes keep separate, visible paper citations. This metadata does not claim search placement, AI recommendation, or guaranteed discoverability.
${endMarker}`;
}

async function writeOrCheck(filePath, content, staleFiles) {
  let current = null;
  try {
    current = await readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (current === content) return;
  const relative = path.relative(projectRoot, filePath);
  if (checkOnly) {
    staleFiles.push(relative);
    return;
  }
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content);
}

const posts = validatePosts(JSON.parse(await readFile(postsPath, 'utf8')));
const header = await readFile(headerPath, 'utf8');
const postsWithBodies = await Promise.all(posts.map(async post => ({
  ...post,
  body: await readFile(path.resolve(contentDirectory, post.bodyFile), 'utf8'),
})));
const expectedDirectories = new Set(posts.map(post => post.slug));
try {
  const entries = await readdir(blogDirectory, { withFileTypes: true });
  const unexpected = entries.filter(entry => entry.isDirectory() && !expectedDirectories.has(entry.name));
  if (unexpected.length) {
    throw new Error('Unlisted Blog directories require an explicit removal or redirect decision: ' + unexpected.map(entry => entry.name).join(', '));
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

for (const file of [
  path.join(blogDirectory, 'index.html'),
  ...posts.map(post => path.join(blogDirectory, post.slug, 'index.html')),
]) {
  try {
    const existing = await readFile(file, 'utf8');
    if (!existing.includes('<!-- generated:blog-page -->')) {
      throw new Error('Refusing to overwrite a page without Blog generator ownership: ' + path.relative(projectRoot, file));
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

const staleFiles = [];

await writeOrCheck(path.join(blogDirectory, 'index.html'), renderIndex(postsWithBodies, header), staleFiles);
for (const post of postsWithBodies) {
  await writeOrCheck(
    path.join(blogDirectory, post.slug, 'index.html'),
    renderArticle(post, postsWithBodies, post.body, header),
    staleFiles,
  );
}
await writeOrCheck(path.join(blogDirectory, 'rss.xml'), renderRss(postsWithBodies), staleFiles);

const sitemap = await readFile(sitemapPath, 'utf8');
await writeOrCheck(sitemapPath, replaceGeneratedSection(sitemap, renderSitemapSection(posts), 'sitemap.xml'), staleFiles);
const llms = await readFile(llmsPath, 'utf8');
await writeOrCheck(llmsPath, replaceGeneratedSection(llms, renderLlmsSection(posts), 'llms.txt'), staleFiles);


if (checkOnly && staleFiles.length > 0) {
  console.error(`Blog output is stale:\n${staleFiles.map(file => `- ${file}`).join('\n')}`);
  process.exitCode = 1;
} else if (checkOnly) {
  console.log(`Blog output is current for ${posts.length} post(s).`);
} else {
  console.log(`Built ${posts.length} Blog post(s), the index, RSS, sitemap, and llms.txt.`);
}
