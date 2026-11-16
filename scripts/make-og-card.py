"""Renders scripts/og-card.html to landing/og-card-v2.png (1200 x 630), the
picture social apps show when someone shares a getgrain.fit link.

    pip install playwright && playwright install chromium
    python3 scripts/make-og-card.py

After changing the picture, save it under a new name (og-card-v3.png) and
point the og:image and twitter:image tags in landing/index.html, privacy.html
and terms.html at it: X, Instagram, WhatsApp and Reddit keep the old picture
for a link they have seen before until the address of the picture changes.
"""

from pathlib import Path

from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parent.parent
src = root / "scripts" / "og-card.html"
out = root / "landing" / "og-card-v2.png"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1200, "height": 630})
    page.goto(src.as_uri(), wait_until="networkidle")
    page.evaluate("document.fonts.ready")
    page.screenshot(path=str(out))
    browser.close()

print(f"wrote {out.relative_to(root)}")
