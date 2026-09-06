#!/usr/bin/env python3
"""Check the generated site's search metadata, links, sources, and feeds."""
import json
import re
import sys
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
SKIP = {"content", "components", "scripts", "tests", ".git"}
errors = []


def require(condition, message):
    if not condition:
        errors.append(message)


class Page(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.ids = set()
        self.duplicates = []
        self.links = []
        self.meta = {}
        self.canonical = []
        self.h1 = 0
        self.h1_parts = []
        self.in_h1 = False
        self.lang = ""
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        identity = attrs.get("id")
        if identity:
            if identity in self.ids:
                self.duplicates.append(identity)
            self.ids.add(identity)
        if tag == "html":
            self.lang = attrs.get("lang")
        if tag == "h1":
            self.h1 += 1
            self.in_h1 = True
        if tag == "meta":
            self.meta[attrs.get("name", attrs.get("property", ""))] = attrs.get("content")
        if tag == "link" and attrs.get("rel") == "canonical":
            self.canonical.append(attrs.get("href"))
        for key in ("href", "src"):
            if key in attrs:
                self.links.append(attrs[key])
        if tag == "img":
            require("alt" in attrs, "Image is missing alt text")


    def handle_data(self, data):
        if self.in_h1:
            self.h1_parts.append(data)

    def handle_endtag(self, tag):
        if tag == "h1":
            self.in_h1 = False


pages = {}
titles = set()
descriptions = set()
canonical_urls = set()
sitemap = {node.text for node in ET.parse(ROOT / "sitemap.xml").findall(".//{*}loc")}
for file in ROOT.rglob("*.html"):
    rel = file.relative_to(ROOT)
    if any(part in SKIP for part in rel.parts):
        continue
    source = file.read_text()
    page = Page(source)
    pages[file.resolve()] = page
    title = re.findall(r"<title>(.*?)</title>", source, re.S)
    require(len(title) == 1, f"{rel}: expected one title")
    require(page.lang == "en" and page.h1 == 1, f"{rel}: expected English and one H1")
    require(not page.duplicates, f"{rel}: duplicate IDs {page.duplicates}")
    require(len(page.canonical) == 1, f"{rel}: expected one canonical")
    canonical = page.canonical[0] if page.canonical else ""
    expected = "https://cortrix.ai/" + str(rel.parent).replace(".", "").strip("/")
    expected = expected.rstrip("/") + "/"
    require(canonical == expected, f"{rel}: wrong canonical {canonical}")
    require(canonical not in canonical_urls, f"{rel}: duplicate canonical")
    canonical_urls.add(canonical)
    require(title and title[0] not in titles, f"{rel}: duplicate title")
    titles.update(title)
    description = page.meta.get("description", "")
    require(50 <= len(description) <= 200, f"{rel}: missing or unsuitable description")
    require(description not in descriptions, f"{rel}: duplicate description")
    descriptions.add(description)
    for key in ("og:title", "og:description", "og:url", "og:image", "twitter:title", "twitter:description", "twitter:image"):
        require(bool(page.meta.get(key)), f"{rel}: missing {key}")
    require(page.meta.get("og:url") == canonical, f"{rel}: OG URL mismatch")
    require(page.meta.get("og:description") == description, f"{rel}: OG description mismatch")
    require(page.meta.get("twitter:description") == description, f"{rel}: Twitter description mismatch")
    require((canonical in sitemap) == ("noindex" not in page.meta.get("robots", "")), f"{rel}: sitemap/index policy mismatch")
    blocks = re.findall(r'<script type="application/ld\+json">([\s\S]*?)</script>', source)
    require(bool(blocks), f"{rel}: missing structured data")
    for block in blocks:
        structured = json.loads(block)
        for node in structured.get("@graph", [structured]):
            if node.get("@type") == "BlogPosting":
                require(node.get("author", {}).get("name") == "Scott", f"{rel}: wrong Blog author")
                require(node.get("headline") == "".join(page.h1_parts).strip(), f"{rel}: visible H1 differs from structured headline")
                require(node.get("citation", {}).get("url") in page.links, f"{rel}: missing visible paper link")
    if rel.parts[0] == "blog":
        require(not re.search(r"[\u3400-\u9fff]", source), f"{rel}: non-English text")
        require("citation_title" not in source, f"{rel}: Blog misidentified as source paper")

for file, page in pages.items():
    for link in page.links:
        parsed = urlsplit(link)
        if parsed.scheme or parsed.netloc:
            if parsed.netloc != "cortrix.ai":
                continue
        path = unquote(parsed.path)
        if not path:
            target = file
        elif path.startswith("/"):
            target = ROOT / path.lstrip("/")
        else:
            target = file.parent / path
        if target.is_dir():
            target = target / "index.html"
        require(target.is_file(), f"{file.relative_to(ROOT)}: missing target {link}")
        if parsed.fragment and target.suffix == ".html" and target.resolve() in pages:
            require(unquote(parsed.fragment) in pages[target.resolve()].ids, f"{file.relative_to(ROOT)}: missing anchor {link}")

posts = json.loads((ROOT / "content/blog/posts.json").read_text())
items = ET.parse(ROOT / "blog/rss.xml").findall("./channel/item")
require(len(items) == len(posts), "RSS item count differs from post count")
require({item.findtext("link") for item in items} == {"https://cortrix.ai/blog/" + p["slug"] + "/" for p in posts}, "RSS URLs differ from articles")
for post in posts:
    body = (ROOT / "content/blog" / post["bodyFile"]).read_text()
    require(len(re.sub(r"<[^>]+>", " ", body).split()) > 650, f"{post['slug']}: incomplete article")
    require(not re.search(r"/assets/blog/figures/[^\"]+\.(?:png|jpg|jpeg)", body), f"{post['slug']}: unexpected paper image")
for file in (ROOT / "assets/blog").rglob("*.svg"):
    ET.parse(file)
require((ROOT / "assets/blog/social-card.png").read_bytes().startswith(b"\x89PNG"), "Missing PNG share image")
robots = (ROOT / "robots.txt").read_text()
require("User-agent: OAI-SearchBot\nAllow: /" in robots, "Search crawler policy changed")
require("User-agent: GPTBot\nDisallow: /" in robots, "Training crawler policy changed")
home = (ROOT / "index.html").read_text().lower()
for term in ("semantic storage", "agent storage", "context storage", "memory storage"):
    require(term in home, f"Missing visible storage term: {term}")
require("el.style.opacity = '0'" not in (ROOT / "script.js").read_text(), "Content depends on scroll reveal")
if errors:
    print("\n".join(errors))
    sys.exit(1)
print(f"PASS: {len(pages)} English pages, {len(posts)} complete articles, metadata, structured data, local links, anchors, RSS, Sitemap, original figures, and crawler policy")
