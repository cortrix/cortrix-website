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

Run the shared-component renderer, then open `index.html` in a browser or serve this directory with any static file server:

```bash
node scripts/render-static-components.mjs
python3 -m http.server 4190 --bind 127.0.0.1
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

Vercel runs the renderer during the build and serves the repository root as the static output.
