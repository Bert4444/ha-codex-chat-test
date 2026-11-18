#!/usr/bin/env python3
"""Embed a self-contained responsive composer in ttyd's extracted index.

No extra HTTP routes are required: ttyd --index serves just this one file.
This script runs against a generated /tmp HTML page at container startup.
"""
import re
import sys
from pathlib import Path


def inject(page: str, css: str, bridge_js: str, composer_js: str) -> str:
    if "ha-codex-composer-bridge" in page:
        raise ValueError("Composer has already been injected")
    if not (re.search(r"<head(?:\s[^>]*)?>", page, re.I) and re.search(r"</body>", page, re.I)):
        raise ValueError("Expected a complete ttyd HTML page")
    # Run before ttyd's own bundled script establishes its WebSocket.
    page = re.sub(
        r"(<head(?:\s[^>]*)?>)",
        lambda m: m.group(1) + '\n<script id="ha-codex-composer-bridge">\n' + bridge_js + '\n</script>\n',
        page, count=1, flags=re.I,
    )
    page = re.sub(
        r"</head>",
        lambda m: '<style id="ha-codex-composer-style">\n' + css + '\n</style>\n' + m.group(0),
        page, count=1, flags=re.I,
    )
    page = re.sub(
        r"</body>",
        lambda m: '<script id="ha-codex-composer-ui">\n' + composer_js + '\n</script>\n' + m.group(0),
        page, count=1, flags=re.I,
    )
    return page


def main() -> None:
    if len(sys.argv) != 5:
        raise SystemExit('Usage: inject_composer.py index.html composer.css composer-bridge.js composer.js')
    html_file, css_file, bridge_file, ui_file = [Path(path) for path in sys.argv[1:]]
    new = inject(
        html_file.read_text(encoding='utf-8'),
        css_file.read_text(encoding='utf-8'),
        bridge_file.read_text(encoding='utf-8'),
        ui_file.read_text(encoding='utf-8'),
    )
    tmp = html_file.with_suffix('.compose-tmp')
    tmp.write_text(new, encoding='utf-8')
    tmp.replace(html_file)


if __name__ == '__main__':
    main()
