#!/usr/bin/env python3
"""Builds the web versions of the site photos.

The JPGs in assets/images/ are the originals. This makes smaller WebP copies of each one at a few
widths (assets/images/web/NAME-WIDTH.webp) so phones download small files and computers get sharp
ones. Run it after adding or replacing a photo:

    pip install pillow
    python3 tools/optimize-images.py

It also writes assets/images/web/manifest.json, which the site's quality check uses to spot a photo
that was replaced without re-running this script.
"""
import hashlib, json, pathlib
from PIL import Image, ImageOps

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets' / 'images'
OUT = SRC / 'web'

# widths to build for each photo, chosen from how wide it shows on the page
WIDTHS = {
    'hero': [640, 1024, 1600, 2400],   # also used for hero-2, hero-3... (the top slideshow)
    'quote': [800, 1280, 1620],
    'about': [480, 800, 1200],
    'about-2': [400, 700],
    'format-city': [480, 800, 1200],
    'format-weekend': [480, 800, 1200],
    'format-retreat': [480, 800, 1200],
}
DEFAULT = [400, 700, 1000]   # past experiences carousel and Instagram grid
SKIP = {'og', 'retreat'}     # og.jpg is the social sharing preview, used as is
QUALITY = 74


def main():
    OUT.mkdir(exist_ok=True)
    manifest = {}
    for src in sorted(SRC.glob('*.jpg')):
        name = src.stem
        if name in SKIP:
            continue
        im = ImageOps.exif_transpose(Image.open(src)).convert('RGB')
        built = []
        for w in WIDTHS.get(name, WIDTHS['hero'] if name.startswith('hero') else DEFAULT):
            w = min(w, im.width)
            if w in built:
                continue
            h = round(im.height * w / im.width)
            im.resize((w, h), Image.LANCZOS).save(OUT / f'{name}-{w}.webp', 'WEBP', quality=QUALITY, method=6)
            built.append(w)
        manifest[name] = {
            'source': hashlib.sha256(src.read_bytes()).hexdigest(),
            'widths': built,
            'size': [im.width, im.height],
        }
        print(f'{name}: {built}')
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')


if __name__ == '__main__':
    main()
