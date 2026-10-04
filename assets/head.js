// Runs before the page draws: turns animations on only when JavaScript works (so the page is never
// blank without it) and plays the intro once per visit. Kept in a file, not inline, so the strict
// Content Security Policy in index.html can block all inline scripts.
document.documentElement.classList.add('js');
try {
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && !sessionStorage.getItem('welda-intro')) {
    document.documentElement.classList.add('show-intro');
  }
} catch (e) {}
