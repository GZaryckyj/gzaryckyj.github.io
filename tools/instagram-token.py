#!/usr/bin/env python3
"""Keeps the Instagram access token (secret IG_TOKEN) from expiring.

Instagram tokens last 60 days; refreshing one extends it. Run daily by
.github/workflows/instagram.yml before the grid update. If Instagram hands back a different token
and the SECRETS_PAT secret exists, it saves the new one into IG_TOKEN; otherwise it warns in the
workflow run. Never prints the token.
"""
import json, os, subprocess, sys, urllib.error, urllib.parse, urllib.request

token = os.environ.get('IG_TOKEN', '').strip()
if not token:
    sys.exit(0)
url = 'https://graph.instagram.com/refresh_access_token?' + urllib.parse.urlencode(
    {'grant_type': 'ig_refresh_token', 'access_token': token})
try:
    with urllib.request.urlopen(url, timeout=30) as r:
        res = json.load(r)
except urllib.error.HTTPError as e:
    try:
        reason = json.load(e).get('error', {}).get('message', '')
    except Exception:
        reason = ''
    # a brand-new token can't be refreshed for 24 hours; anything else is worth a look
    print(f'::warning::Could not refresh the Instagram token ({e.code}). {reason}')
    sys.exit(0)

new = res.get('access_token', '')
days = int(res.get('expires_in', 0)) // 86400
if new:
    print(f'::add-mask::{new}')
print(f'Instagram token refreshed; valid for about {days} more days.')
if new and new != token:
    if os.environ.get('GH_TOKEN'):
        subprocess.run(['gh', 'secret', 'set', 'IG_TOKEN', '--repo', os.environ['GITHUB_REPOSITORY'], '--body', new],
                       check=True, stdout=subprocess.DEVNULL)
        print('Saved the refreshed token to the IG_TOKEN secret.')
    else:
        print('::warning::Instagram issued a new token but SECRETS_PAT is not set, so it could not be saved. '
              'The current token keeps working until it expires; see README, "Instagram grid".')
