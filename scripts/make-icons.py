"""Redraw the small web icons from the 1024 master (assets/images/icon.png).

Run: python3 scripts/make-icons.py

The master leaves a wide margin around the g because Android crops icons to a
circle. An iPhone shows the whole square and a browser tab is tiny, so those
two are cut closer to the g before scaling down. Every output is checked to
still contain the orange g: the previous files were plain dark squares.
"""

from PIL import Image

MASTER = "assets/images/icon.png"
ORANGE = (244, 81, 30)

# output file -> (side of the square cut from the master, vertical centre, size)
ICONS = {
    "public/icons/icon-192.png": (1024, 512, 192),
    "public/icons/apple-touch-icon.png": (740, 512, 180),
    "landing/apple-touch-icon.png": (740, 512, 180),
    "assets/images/favicon.png": (580, 497, 48),
}

master = Image.open(MASTER).convert("RGB")
for path, (side, cy, size) in ICONS.items():
    left, top = 512 - side // 2, cy - side // 2
    icon = master.crop((left, top, left + side, top + side)).resize(
        (size, size), Image.LANCZOS
    )
    orange = sum(
        count
        for count, (r, g, b) in icon.getcolors(size * size)
        if abs(r - ORANGE[0]) < 60 and abs(g - ORANGE[1]) < 60 and b < 90
    )
    assert orange > size * size * 0.02, f"{path} came out without the g"
    icon.save(path, optimize=True)
    print(f"{path}: {size}px, {orange} orange pixels")
