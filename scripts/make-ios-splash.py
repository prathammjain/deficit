#!/usr/bin/env python3
"""
make-ios-splash.py: the launch screens iOS shows while an installed Grain
starts. Without them an iPhone shows a blank white screen. Each one is the
bone background with the app icon in the middle, for one iPhone screen
size (portrait), named by its points and pixel ratio.

Re-run after changing the icon:  python3 scripts/make-ios-splash.py
"""
from PIL import Image, ImageDraw

BG = (237, 234, 228)  # #EDEAE4, the app background
ICON = 'public/icons/icon-512.png'

# (width pt, height pt, pixel ratio): every current iPhone screen.
SCREENS = [
    (440, 956, 3),  # 16 Pro Max, 17 Pro Max
    (402, 874, 3),  # 16 Pro, 17, 17 Pro
    (420, 912, 3),  # Air
    (430, 932, 3),  # 14 Pro Max, 15 Plus and Pro Max, 16 Plus
    (393, 852, 3),  # 14 Pro, 15, 15 Pro, 16
    (428, 926, 3),  # 12 and 13 Pro Max, 14 Plus
    (390, 844, 3),  # 12, 13, 14, 16e
    (414, 896, 3),  # XS Max, 11 Pro Max
    (414, 896, 2),  # XR, 11
    (375, 812, 3),  # X, XS, 11 Pro, 12 and 13 mini
    (375, 667, 2),  # SE (2nd and 3rd), 8
]

ICON_PT = 96  # icon size in points, the same on every phone

def rounded(img, radius):
    mask = Image.new('L', img.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, *img.size), radius, fill=255)
    out = Image.new('RGBA', img.size)
    out.paste(img, (0, 0), mask)
    return out

icon = Image.open(ICON).convert('RGB')
for w, h, r in SCREENS:
    px = ICON_PT * r
    canvas = Image.new('RGB', (w * r, h * r), BG)
    mark = rounded(icon.resize((px, px), Image.LANCZOS), int(px * 0.225))
    canvas.paste(mark, ((w * r - px) // 2, (h * r - px) // 2), mark)
    canvas.save(f'public/splash/iphone-{w}x{h}@{r}x.png', optimize=True)
    print(f'iphone-{w}x{h}@{r}x.png')
