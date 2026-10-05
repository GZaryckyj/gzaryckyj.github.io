#!/usr/bin/env python3
"""Fills the "Moments from the community" grid with the latest @weldaclub Instagram posts.

Run daily by .github/workflows/instagram.yml. It:
  1. asks Instagram for the account's recent posts (Instagram API with Instagram Login),
  2. saves light WebP copies of the newest ones in assets/images/ig/,
  3. rewrites the grid in index.html between the instagram:start / instagram:end markers,
     each tile linking to its post, with the caption as the photo description,
  4. removes copies of posts that are no longer shown.
If anything goes wrong it changes nothing, so the grid keeps its last good photos.

Settings (environment variables):
  IG_TOKEN        the long-lived Instagram access token (required; a GitHub secret)
  IG_COUNT        how many posts to show (default 6)
  IG_HASHTAG      only show posts whose caption has this hashtag, e.g. weldaclub (default: all)
  IG_SKIP_VIDEOS  "1" to leave out Reels and videos (default: shown with their cover image)

Local test without Instagram: IG_FAKE_JSON=path/to/media.json (same shape as the API response,
with "file" paths instead of image URLs).
"""
import html, io, json, os, pathlib, re, sys, urllib.error, urllib.parse, urllib.request
from PIL import Image, ImageOps

ROOT = pathlib.Path(__file__).resolve().parent.parent
INDEX = ROOT / 'index.html'
OUT = ROOT / 'assets' / 'images' / 'ig'
API = 'https://graph.instagram.com/v23.0/me/media'
FIELDS = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp'
WIDTHS = [400, 700]
START = re.compile(r'( *)<!-- instagram:start[^>]*-->\n')
END = re.compile(r' *<!-- instagram:end -->')
FALLBACKS = ['', '--fallback: var(--fallback-2)', '--fallback: var(--fallback-3)']


def fetch_json(url):
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:      # show Instagram's reason, never the URL (it holds the token)
        try:
            reason = json.load(e).get('error', {}).get('message', '')
        except Exception:
            reason = ''
        sys.exit(f'Instagram refused the request ({e.code}). {reason}')


def fetch_bytes(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'welda.club site update'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def recent_posts(token):
    fake = os.environ.get('IG_FAKE_JSON')
    if fake:
        return json.loads(pathlib.Path(fake).read_text())['data']
    q = urllib.parse.urlencode({'fields': FIELDS, 'limit': 50, 'access_token': token})
    return fetch_json(f'{API}?{q}').get('data', [])


def describe(caption):
    """A short, plain description from the caption: first line, no hashtags, emoji or links."""
    text = (caption or '').strip().split('\n')[0]
    text = re.sub(r'https?://\S+', '', text)
    text = re.sub(r'#\w+', '', text)
    text = ''.join(ch for ch in text if ch.isalnum() or ch in " .,!?'&:;-()@/$%+’")
    text = re.sub(r'\s+', ' ', text).strip(' -:,')
    if len(text) > 120:
        text = text[:120].rsplit(' ', 1)[0].rstrip('.,;:') + '...'
    return text or 'A moment from the Welda community'


def main():
    token = os.environ.get('IG_TOKEN', '').strip()
    if not token and not os.environ.get('IG_FAKE_JSON'):
        sys.exit('IG_TOKEN is not set: add the Instagram access token as a repository secret named IG_TOKEN.')
    count = int(os.environ.get('IG_COUNT', '6'))
    tag = os.environ.get('IG_HASHTAG', '').lstrip('#').lower()
    skip_videos = os.environ.get('IG_SKIP_VIDEOS') == '1'

    chosen = []
    for p in recent_posts(token):
        kind = p.get('media_type')
        if kind == 'VIDEO' and skip_videos:
            continue
        if tag and ('#' + tag) not in (p.get('caption') or '').lower():
            continue
        src = p.get('thumbnail_url') if kind == 'VIDEO' else p.get('media_url')
        if not (src or p.get('file')) or not p.get('permalink'):
            continue
        chosen.append(p)
        if len(chosen) == count:
            break
    if not chosen:
        sys.exit('No suitable Instagram posts found; leaving the grid as it is.')

    OUT.mkdir(parents=True, exist_ok=True)
    tiles, keep = [], set()
    for n, p in enumerate(chosen):
        pid = re.sub(r'\W', '', p['id'])
        files = {w: OUT / f'{pid}-{w}.webp' for w in WIDTHS}
        if not all(f.exists() for f in files.values()):
            raw = pathlib.Path(p['file']).read_bytes() if p.get('file') else fetch_bytes(
                p['thumbnail_url'] if p.get('media_type') == 'VIDEO' else p['media_url'])
            im = ImageOps.exif_transpose(Image.open(io.BytesIO(raw))).convert('RGB')
            for w, f in files.items():
                w2 = min(w, im.width)
                im.resize((w2, round(im.height * w2 / im.width)), Image.LANCZOS).save(f, 'WEBP', quality=74, method=6)
        keep.update(f.name for f in files.values())
        with Image.open(files[WIDTHS[-1]]) as big:
            W, H = big.size
        alt = html.escape(describe(p.get('caption')), quote=True)
        srcset = ', '.join(f'/assets/images/ig/{files[w].name} {w}w' for w in WIDTHS)
        style = FALLBACKS[n % len(FALLBACKS)]
        span = f'<span style="{style}">' if style else '<span>'
        tiles.append(
            f'<a href="{html.escape(p["permalink"], quote=True)}" target="_blank" rel="noopener" class="gram__item reveal" '
            f'aria-label="{alt} (Welda on Instagram)">{span}<img src="/assets/images/ig/{files[WIDTHS[-1]].name}" '
            f'srcset="{srcset}" sizes="(max-width: 560px) 50vw, 17vw" width="{W}" height="{H}" alt="{alt}" '
            f'loading="lazy" decoding="async"></span></a>')

    page = INDEX.read_text()
    s, e = START.search(page), END.search(page)
    if not s or not e or e.start() < s.end():
        sys.exit('Could not find the instagram:start / instagram:end markers in index.html.')
    indent = s.group(1)
    new = page[:s.end()] + ''.join(indent + t + '\n' for t in tiles) + page[e.start():]
    INDEX.write_text(new)

    for f in OUT.glob('*.webp'):
        if f.name not in keep:
            f.unlink()
    print(f'Grid now shows {len(tiles)} posts: ' + ', '.join(p['permalink'] for p in chosen))


if __name__ == '__main__':
    main()
