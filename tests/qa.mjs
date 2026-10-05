// Welda site QA. Runs automatically on GitHub (see .github/workflows/qa.yml) on every change,
// every pull request and once a week. Can also be run locally: `node tests/qa.mjs`.
//
// For each browser (Chrome, Firefox, Safari/WebKit) at desktop and phone sizes it:
//   - loads the page and fails on JavaScript errors, security-policy (CSP) violations,
//     or any missing file from this site
//   - scrolls the whole page like a visitor and checks every photo and text block appears
//   - checks nothing makes the page scroll sideways on phones
//   - checks the past experiences carousel is moving
//   - runs an accessibility scan (fails only on critical issues)
//   - saves a full-page screenshot to qa-results/
// Then it checks every outside link (Luma, Flodesk, Instagram) still works.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'qa-results');
fs.mkdirSync(OUT, { recursive: true });

let pw;
try { pw = await import('playwright'); }
catch { pw = await import(process.env.PLAYWRIGHT_MODULE || 'playwright'); }

const BROWSERS = (process.env.QA_BROWSERS || 'chromium,firefox,webkit').split(',');
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'phone', width: 390, height: 844 },
];

const failures = [];
const warnings = [];
const fail = (where, msg) => failures.push(`[${where}] ${msg}`);
const warn = (where, msg) => warnings.push(`[${where}] ${msg}`);

// ---------- tiny static server (same as GitHub Pages: files from the repo root) ----------
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml', '.txt': 'text/plain', '.json': 'application/json',
  '.mp4': 'video/mp4', '.webm': 'video/webm' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'content-type': 'text/html' });
    return res.end(fs.readFileSync(path.join(ROOT, '404.html')));
  }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const axeSource = (() => { try { return fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'); } catch { return null; } })();
if (!axeSource) warn('setup', 'axe-core not installed, accessibility scan skipped');

// ---------- per browser / screen size ----------
for (const browserName of BROWSERS) {
  const launchOpts = browserName === 'chromium' && process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
  let browser;
  try { browser = await pw[browserName].launch(launchOpts); }
  catch (e) { fail(browserName, `could not start browser: ${e.message.split('\n')[0]}`); continue; }

  for (const vp of VIEWPORTS) {
    const where = `${browserName} ${vp.name}`;
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    // analytics only accepts reports from welda.club, so don't send any from the test server
    await context.route(/cloudflareinsights\.com/, r => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));

    page.on('pageerror', e => fail(where, `JavaScript error: ${e.message}`));
    let scanning = false; // the accessibility scanner fetches stylesheets itself; visitors never do
    page.on('console', m => {
      const t = m.text();
      if (!scanning && /content security policy|content-security-policy|csp/i.test(t)) fail(where, `security policy blocked something: ${t}`);
      else if (m.type() === 'error' && !scanning) warn(where, `browser console error: ${t.slice(0, 200)}`);
    });
    page.on('response', r => {
      if (r.url().startsWith(BASE) && r.status() >= 400) fail(where, `missing file (${r.status()}): ${r.url().replace(BASE, '')}`);
    });
    page.on('requestfailed', r => {
      // browsers routinely cancel video downloads (seeking, pausing, or a codec the test browser
      // lacks), so a cancelled video request is normal; a missing video still fails as a 404 above
      if (/\.(mp4|webm)$/.test(r.url()) && /abort/i.test(r.failure()?.errorText || '')) return;
      if (r.url().startsWith(BASE)) fail(where, `file failed to load: ${r.url().replace(BASE, '')}`);
    });

    await page.goto(BASE + '/', { waitUntil: 'load' });
    await page.waitForTimeout(4500); // intro + headline animation

    const headline = await page.evaluate(() => getComputedStyle(document.querySelector('.hero h1 .line__inner')).transform);
    if (headline !== 'none') fail(where, 'headline did not finish animating in');

    // every photo file referenced on the page exists (each size in srcset, including slideshow photos
    // that load later), and has a description
    const imgs = await page.evaluate(() => [...new Set([...document.querySelectorAll('img')]
      .flatMap(i => [i.getAttribute('src'), i.getAttribute('data-src'),
        ...(i.getAttribute('srcset') || i.getAttribute('data-srcset') || '').split(',').map(s => s.trim().split(' ')[0])])
      .filter(Boolean))]);
    for (const src of imgs) {
      const r = await page.request.get(BASE + src);
      if (!r.ok()) fail(where, `photo missing: ${src}`);
    }
    const noAlt = await page.evaluate(() => [...document.querySelectorAll('img:not([alt])')].map(i => i.getAttribute('src')));
    noAlt.forEach(s => fail(where, `photo has no description (alt text): ${s}`));

    // scroll the whole page like a visitor (mouse wheel, so smooth scrolling is exercised too)
    await page.mouse.move(vp.width / 2, vp.height / 2);
    let last = -1;
    for (let i = 0; i < 400; i++) {
      await page.mouse.wheel(0, 250);
      await page.waitForTimeout(40);
      const y = await page.evaluate(() => Math.round(window.scrollY + window.innerHeight));
      const h = await page.evaluate(() => document.documentElement.scrollHeight);
      if (y >= h - 2) break;
      if (i % 20 === 19) { if (y === last) break; last = y; }
    }
    const wheelY = await page.evaluate(() => Math.round(window.scrollY));
    if (wheelY < 300) {
      fail(where, `mouse-wheel scrolling did not move the page (scrollY=${wheelY})`);
      // keep going with the keyboard so the remaining checks still mean something
      for (let i = 0; i < 80; i++) { await page.keyboard.press('PageDown'); await page.waitForTimeout(60); }
    }
    await page.waitForTimeout(2500);

    const hidden = await page.evaluate(() => [...document.querySelectorAll('.reveal, .img-reveal')]
      .filter(e => !e.closest('.carousel'))        // carousel cards appear as they drift into view
      .filter(e => !e.classList.contains('is-visible'))
      .map(e => (e.className + ' ' + (e.textContent || '').trim().slice(0, 40)).replace(/\s+/g, ' ')));
    hidden.forEach(h => fail(where, `never appeared after scrolling: ${h}`));

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 1) {
      const culprits = await page.evaluate(() => [...document.querySelectorAll('body *')]
        .filter(e => { const r = e.getBoundingClientRect(); return r.right > window.innerWidth + 1 && !e.closest('.carousel__track, .marquee, .partners__marquee'); })
        .slice(0, 4).map(e => e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : '')));
      fail(where, `page scrolls sideways by ${overflow}px (sticking out: ${culprits.join(', ') || 'unknown'})`);
    }

    // carousel keeps moving
    await page.evaluate(() => document.querySelector('.carousel__head').scrollIntoView({ block: 'start' }));
    await page.mouse.move(2, 2);
    await page.waitForTimeout(1200);
    const x1 = await page.evaluate(() => document.querySelector('.carousel__track').scrollLeft);
    await page.waitForTimeout(2000);
    const x2 = await page.evaluate(() => document.querySelector('.carousel__track').scrollLeft);
    if (Math.abs(x2 - x1) < 20) fail(where, `carousel is not moving (${Math.round(x1)} -> ${Math.round(x2)})`);

    // in-page menu links point at real sections
    const badAnchors = await page.evaluate(() => [...document.querySelectorAll('a[href^="#"]')]
      .map(a => a.getAttribute('href')).filter(h => h !== '#top' && !document.querySelector(h)));
    badAnchors.forEach(h => fail(where, `menu link points nowhere: ${h}`));

    // accessibility scan (once per browser, desktop)
    if (axeSource && vp.name === 'desktop') {
      // injected through the browser's automation channel; the page's own security policy
      // (correctly) refuses inline scripts, so addScriptTag would be blocked
      scanning = true;
      await page.evaluate(axeSource);
      const res = await page.evaluate(async () => await window.axe.run(document, { resultTypes: ['violations'] }));
      await page.waitForTimeout(500);
      scanning = false;
      for (const v of res.violations) {
        const where2 = v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(', ');
        const msg = `accessibility (${v.impact}): ${v.help} [${v.nodes.length} place(s): ${where2}]`;
        if (v.impact === 'critical') fail(where, msg); else warn(where, msg);
      }
    }

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: path.join(OUT, `${browserName}-${vp.name}.png`), fullPage: true }).catch(() => {});
    await context.close();
  }
  await browser.close();
}

// ---------- photos replaced without rebuilding their web versions ----------
{
  const crypto = await import('node:crypto');
  const manifestPath = path.join(ROOT, 'assets/images/web/manifest.json');
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
  for (const [name, info] of Object.entries(manifest)) {
    const src = path.join(ROOT, 'assets/images', name + '.jpg');
    if (!fs.existsSync(src)) continue;
    const hash = crypto.createHash('sha256').update(fs.readFileSync(src)).digest('hex');
    if (hash !== info.source) fail('photos', `${name}.jpg was replaced but its web versions were not rebuilt; run: python3 tools/optimize-images.py`);
  }
}

// ---------- the 404 page ----------
{
  const r = await fetch(BASE + '/no-such-page');
  const t = await r.text();
  if (!/rest day/i.test(t)) fail('404', 'the "page not found" page is not being shown');
}

// ---------- outside links ----------
if (process.env.QA_SKIP_LINKS !== '1') {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const links = [...new Set([...html.matchAll(/href="(https?:\/\/[^"]+)"/g)].map(m => m[1].replace(/&amp;/g, '&')))]
    .filter(u => !/fonts\.(googleapis|gstatic)\.com\/?$/.test(u));
  for (const url of links) {
    try {
      const r = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (Macintosh) WeldaSiteQA/1.0' }, signal: AbortSignal.timeout(20000) });
      if ([404, 410].includes(r.status)) fail('links', `dead link (${r.status}): ${url}`);
      else if (r.status >= 400) warn('links', `link returned ${r.status} (often bot-blocking, check by hand): ${url}`);
    } catch (e) {
      warn('links', `could not reach ${url}: ${e.cause?.code || e.message}`);
    }
  }
}

server.close();

// ---------- report ----------
const lines = [];
lines.push(failures.length ? `## Site QA: ${failures.length} problem(s) found` : '## Site QA: all checks passed');
lines.push(`Browsers: ${BROWSERS.join(', ')} at ${VIEWPORTS.map(v => `${v.width}x${v.height}`).join(' and ')}`);
if (failures.length) lines.push('', '### Problems', ...failures.map(f => `- ${f}`));
if (warnings.length) lines.push('', '### Worth a look (not failing)', ...warnings.map(w => `- ${w}`));
const report = lines.join('\n');
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + '\n');
fs.writeFileSync(path.join(OUT, 'report.md'), report + '\n');
process.exit(failures.length ? 1 : 0);
