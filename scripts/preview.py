#!/usr/bin/env python3
"""Serve the static site locally with the same source exclusions as deployment."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIRECTORIES = {"content", "components", "scripts", "tests"}


class PreviewHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        parts = Path(unquote(urlsplit(self.path).path)).parts
        if any(part.startswith(".") for part in parts if part != "/") or any(
            part in SOURCE_DIRECTORIES for part in parts
        ):
            self.send_error(404, "Not found")
            return None
        return super().send_head()

    def end_headers(self):
        self.send_header("X-Robots-Tag", "noindex")
        super().end_headers()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bind", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=4190)
    args = parser.parse_args()
    handler = partial(PreviewHandler, directory=str(ROOT))
    server = ThreadingHTTPServer((args.bind, args.port), handler)
    print(f"Preview: http://{args.bind}:{args.port}/blog/", flush=True)
    server.serve_forever()
