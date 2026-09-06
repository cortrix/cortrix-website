# cortrix.ai

This repository contains the public source for cortrix.ai, the official website for Cortrix. We welcome issues and pull requests for website content, broken links, accessibility, layout bugs, and documentation clarity.

This repository is public so the community can inspect cortrix.ai and suggest improvements. It is not an open source repository. No reuse license is granted for cortrix.ai, website content, website source files, brand assets, the Cortrix name, Cortrix logos, brand identifiers, or product messaging.

Cortrix product roadmap, security reports, brand usage, and unapproved product claims are handled through the governance and security channels described in this repository.

## Governance

- [Copyright](COPYRIGHT.md)
- [Brand Usage](BRAND_USAGE.md)
- [Notice](NOTICE.md)
- [Contributing](CONTRIBUTING.md)
- [Security Policy](SECURITY.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)

## Local preview

Build the Blog and shared components, then open `index.html` in a browser or serve this directory with any static file server:

```bash
node scripts/build-blog.mjs
node scripts/render-static-components.mjs
python3 scripts/preview.py --port 4190 --bind 127.0.0.1
```

## Shared static header

The canonical site header is maintained in `components/site-header.html`. The renderer writes that template into every `index.html` between the `include:site-header` markers. The generated pages retain complete static navigation markup so search engines, AI crawlers, accessibility tools, and clients without JavaScript can read the same header.

Run the renderer after changing the template:

```bash
node scripts/render-static-components.mjs
```

Verify that every page is synchronized:

```bash
node scripts/render-static-components.mjs --check
```

Vercel runs the Blog generator followed by the shared-component renderer, then serves the repository root as the static output.

## Writing a Blog research note

The Blog uses small source files and no third party dependencies or CMS. Add an HTML body fragment under `content/blog/`, then add its metadata to `content/blog/posts.json`. Each metadata entry needs `slug`, `title`, `description`, `paperTitle`, `paperYear`, `paperUrl`, `paperAuthors`, `topic`, `seriesOrder`, `bodyFile`, and `readMinutes`. Optional `publishedAt` and `updatedAt` values must use an ISO date or timestamp; leave them out until the dates are confirmed.

The HTML fragment should begin with the article introduction and use `h2` headings for the table of contents. Keep original mechanism diagrams under `/assets/blog/figures/` and reference them with paths starting at the site root. Use a `figure` with `figcaption` whenever an image needs context or attribution.

Generate the Blog index, article pages, RSS feed, sitemap entries, and the Blog section in `llms.txt` before previewing:

```bash
node scripts/build-blog.mjs
node scripts/render-static-components.mjs
```

Check that generated output and the shared header are current:

```bash
node scripts/build-blog.mjs --check
node scripts/render-static-components.mjs --check
```

## Research attribution and reuse

Each research note must identify its source paper, its authors, and a stable publication URL. Write an independent explanation and use original diagrams. Do not assume that a paper available on arXiv permits reuse of its text or figures: check the license of the exact version and any third party material. The [arXiv reuse guide](https://info.arxiv.org/help/license/reuse.html) explains the distinction. Record permission and attribution before adding reused material; the initial five notes do not reproduce paper figures or PDFs.

The generator stops when a Blog directory is no longer listed in the metadata. Decide explicitly whether an existing article needs removal or a redirect before changing a published URL. It does not delete unlisted directories.

## Search discovery

Use unique titles and descriptions that match visible content, stable canonical URLs, and meaningful internal links. The homepage explains semantic storage, agent storage, context storage, and memory storage as workflow terms without expanding capability claims. Article source citations remain distinct from Blog authorship. RSS and Sitemap entries are generated from the same article metadata. Search indexing and AI citations can only be measured after publication; no ranking outcome is implied.

The preview server and deployment routes exclude authoring fragments and tooling from page access. Local previews send an X-Robots-Tag noindex header; published pages retain their own index policy. Run the site checks with:

```bash
python3 scripts/check-site.py
```

## Concept guide and reading experience

The /semantic-storage/ page explains the concept independently from the Blog. Keep its definition scoped to this guide and describe current Cortrix capabilities using the product evidence pages. It is linked from the shared navigation, footer, and relevant article text. Architecture remains available from the homepage and footer.

The Blog uses the homepage color tokens. Its articles are Scott’s personal interpretations of research, not descriptions of papers being implemented in Cortrix. The contents list can be expanded when needed. Images open in a page dialog with a close button and Escape support; article titles and reading links continue to navigate to the article.
