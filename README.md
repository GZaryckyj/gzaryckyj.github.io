# Welda website (welda.club)

A fast, single-page static site for Welda, hosted free on GitHub Pages.

## Files

| File | What it is |
|---|---|
| `index.html` | All the page text and sections |
| `assets/styles.css` | Colors, fonts, layout (brand colors are at the top in `:root`) |
| `assets/main.js` | All animations and interactions (see "Animations" below) |
| `assets/vendor/` | Lenis smooth-scrolling library (MIT license), bundled so the site has no outside dependencies |
| `assets/logo-monogram.svg` | The WC monogram used in the header area and footer |
| `assets/brand/` | Original Welda logo files, kept for reference |
| `assets/images/` | Photos go here (see below) |
| `CNAME` | Tells GitHub Pages to serve the site at `welda.club` |
| `404.html` | "Page not found" page |
| `robots.txt`, `sitemap.xml` | Tell search engines what to index |
| `assets/head.js` | Tiny script that runs before the page draws (animations and intro) |
| `assets/logo.png` | Square logo used by search engines |
| `tests/qa.mjs`, `.github/workflows/qa.yml` | Automatic quality checks (see "Quality checks" below) |

## 1. Add the photos

The site works without photos (it shows soft color gradients instead), but it looks best with them.
Export photos from Google Drive / Instagram, rename them exactly as below, and drop them into
`assets/images/`. JPG, about 2000px wide for the big ones and 1200px for the rest, keeps the site fast.

| Filename | Where it shows | Best shot |
|---|---|---|
| `hero.jpg` | Full-screen top banner | Wide, atmospheric: a rooftop or beach group shot |
| `about.jpg` | "Our story" (tall) | Georgia, or a candid community moment |
| `about-2.jpg` | Small overlapping photo | Detail shot: mat, coffee, journal |
| `format-city.jpg` | "City mornings" card | NYC rooftop session |
| `format-weekend.jpg` | "Weekend gatherings" card | Miami court or beach day |
| `format-retreat.jpg` | "Retreats" card | Nature, travel, a destination |
| `quote.jpg` | "Presence, not perfection" banner | Calm, wide, not busy |
| `retreat.jpg` | Retreats section (tall) | Scenic or a slow moment |
| `gallery-1.jpg` to `gallery-6.jpg` | Instagram grid | Six favorite Instagram posts (square) |
| `past-1.jpg` to `past-6.jpg` | Past experiences carousel | One photo per event, in carousel order (portrait, about 4:5) |

## 2. Put it on GitHub

1. In GitHub (signed in as **GZaryckyj**), create a new **public** repository named `gzaryckyj.github.io`.
2. Click **uploading an existing file**, drag in everything from this folder (including the `assets`
   folder and the `CNAME` file), and click **Commit changes**.
3. Go to **Settings, then Pages**. Under "Build and deployment" choose **Deploy from a branch**, branch `main`, folder `/ (root)`, and save.
4. Under **Custom domain** it should already say `welda.club` (from the CNAME file). Once the DNS check
   passes, tick **Enforce HTTPS**.

## 3. DNS (in Georgia's Cloudflare account, `welda.club` then DNS then Records)

All five set to **DNS only** (grey cloud). Leave the Google email records alone.

| Type | Name | Content |
|---|---|---|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `gzaryckyj.github.io` |

## Animations

Inspired by luxury wellness sites like Remedy Place (smooth scrolling, moody emerald palette) and Equinox (photo-led, refined hover effects):

- **Intro:** the monogram and wordmark fade in, then the screen lifts away. Plays once per visit.
- **Hero:** the headline rises line by line from behind a mask; the background photo slowly settles in.
- **Smooth scrolling** (Lenis) gives the whole page a soft, gliding feel.
- **Manifesto:** "Our belief" text lights up word by word as you scroll.
- **Photos:** open with a curtain wipe and a slow zoom-out, then drift slightly slower than the page (parallax).
- **Marquee:** the scrolling word band speeds up when you scroll.
- **Past experiences carousel:** drifts slowly and continuously in an endless loop (pauses on hover, touch or the
  pause button; change `SPEED` in `assets/main.js`). Swipe on phones; drag, arrows, trackpad or keyboard on desktop.
  Photos drift slightly as cards slide past, with a gold progress bar and an "01 / 06" counter.
- **Details:** magnetic buttons, gold underline sweeps, cards that lift, a header that tucks away when you
  scroll down and returns when you scroll up, a subtle film-grain texture, and an outlined WELDACLUB wordmark
  that rises into the footer.

Visitors who have "reduce motion" turned on in their device settings get a calm, fully static version
automatically. To soften the grain, lower `opacity` in `.grain` in `styles.css` (set `display: none` to remove it).

## Quality checks

Every change pushed to `main` (and every pull request, plus every Monday) runs **Site QA** in the
repo's **Actions** tab. It opens the site in Chrome, Firefox and Safari (WebKit) at desktop and phone
sizes and fails (red X) if there are JavaScript errors, security-policy violations, missing files,
photos or text that never appear when scrolling, sideways scrolling on phones, a stopped carousel,
critical accessibility problems, or dead outside links. Screenshots and the report are saved with
each run (open the run, then "Artifacts"). Run it by hand any time from Actions, "Site QA",
"Run workflow".

## Security and search

- **Content Security Policy** (top of `index.html` and `404.html`): the page may only load files
  from welda.club, Google Fonts and Cloudflare Analytics, and inline scripts are blocked. If you
  add a new outside service (an embed, a widget), its domain must be added there or it will be
  blocked; the quality check will flag it.
- **Referrer policy:** outside sites only see that a visitor came from welda.club, not the full URL.
- **Search:** `robots.txt`, `sitemap.xml`, a canonical URL, and structured data (the
  `application/ld+json` block in `index.html`) describing Welda Club, its logo, email and social
  profiles. Update the `<lastmod>` date in `sitemap.xml` after big content changes.
- Frame protection (stopping other sites embedding welda.club) needs a server header, which
  GitHub Pages cannot send; the risk is low because the site has no logins or forms.

## Editing later

- **Text:** open `index.html` on github.com, click the pencil icon, edit, and commit. The live site updates in about a minute.
- **Photos:** upload a new file with the same name into `assets/images/` to replace it.
- **Colors / fonts:** change the values at the top of `assets/styles.css`. The brand palette, taken from the logo files:
  Welda green `#0A2911`, deep green-black `#051609`, gold `#C2A17F`, cream `#E4D9CA`.
  Fonts: Playfair Display (headings), IBM Plex Mono (labels), DM Sans (body).
- **Add a past event:** in `index.html`, copy one `<article class="event-card ...">` block inside the carousel,
  change the city, name and partner line, point it at a new photo (e.g. `past-7.jpg`), and update the
  `/ 06` total next to it.
- **Retreat list link:** search `index.html` for `myflodesk` to change the form link (two buttons).
- **Analytics:** Cloudflare Web Analytics snippet at the bottom of `index.html` and `404.html`. View visits in
  Georgia's Cloudflare under Analytics & Logs, then Web Analytics.
- **Events link:** the "Upcoming events" buttons point to `https://luma.com/user/weldaclub`.

## Please double-check before launch

The copy was written from Welda's public pages and past event listings. Confirm:

- Past experiences and collaborator names (Mandarin Oriental, Vivobarefoot, Sanctum, Regency Padel,
  GutYa, Joia Beach, JMUVS) are all OK to list publicly.
- Both "Join the retreat list" buttons open the Flodesk sign-up form
  (`https://weldaclubretreat.myflodesk.com/retreatform01`) in a new tab.
- The contact buttons open an email to `hello@welda.club`. Make sure that address exists
  in Google Workspace (as an alias or group) so messages are delivered.
