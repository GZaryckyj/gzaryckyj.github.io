// Welda | motion and interactions
// - intro (once per visit), smooth scrolling (Lenis), hero entrance
// - reveal on scroll, image curtain reveals, parallax
// - manifesto words that light up, scroll-reactive marquee
// - hiding nav, past experiences carousel (continuous drift, swipe, drag, arrows), magnetic buttons
// Everything is skipped for visitors who have "reduce motion" turned on.

(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var vh = window.innerHeight;
  window.addEventListener('resize', function () { vh = window.innerHeight; });

  /* ---------- Intro + hero entrance ---------- */
  function start() {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { root.classList.add('is-loaded'); });
    });
    if (root.classList.contains('show-intro')) {
      try { sessionStorage.setItem('welda-intro', '1'); } catch (e) {}
      setTimeout(function () {
        var intro = document.querySelector('.intro');
        if (intro) intro.remove();
        root.classList.remove('show-intro');
      }, 2400);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();

  /* ---------- Smooth scrolling ---------- */
  var lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new window.Lenis({ duration: 1.15, easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); } });
  }
  // In-page links (#about etc.) glide instead of jumping
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      var target = id === '#top' ? 0 : document.querySelector(id);
      if (target === null) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: -70 });
      else if (target === 0) window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      else target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    });
  });

  /* ---------- Nav: solid on scroll, hides going down, returns going up ---------- */
  var nav = document.querySelector('.nav');
  var toggle = document.querySelector('.nav__toggle');
  toggle.addEventListener('click', function () {
    var open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', open);
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.style.overflow = open ? 'hidden' : '';
    if (lenis) open ? lenis.stop() : lenis.start();
  });
  document.querySelectorAll('.nav__links a').forEach(function (a) {
    a.addEventListener('click', function () {
      if (!nav.classList.contains('is-open')) return;
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      if (lenis) lenis.start();
    });
  });

  /* ---------- Reveal on scroll (with a gentle stagger) ---------- */
  var revealEls = document.querySelectorAll('.reveal, .img-reveal, .split-lines.on-scroll, .footer__word');
  // Photos start fully clipped (the curtain), and Chrome/Edge treat a fully clipped element as
  // never on screen. So for photos we watch their unclipped container and reveal the photo(s) inside.
  var watchMap = new Map();
  revealEls.forEach(function (el) {
    var watched = el.classList.contains('img-reveal') ? el.parentElement : el;
    if (!watchMap.has(watched)) watchMap.set(watched, []);
    watchMap.get(watched).push(el);
  });
  // Checked directly against the screen on every scroll frame instead of IntersectionObserver,
  // which is unreliable here: it ignores clipped elements in Chrome and did not fire in WebKit tests.
  function revealVisible() {
    var i = 0;
    watchMap.forEach(function (els, watched) {
      var r = watched.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;           // not displayed (e.g. hidden on phones)
      if (r.top < vh * 0.92 && r.bottom > 0) {
        els.forEach(function (el) {
          if (el.classList.contains('reveal') && !el.style.transitionDelay) el.style.transitionDelay = (i * 90) + 'ms';
          el.classList.add('is-visible');
          // clear the stagger once it has played, so hover effects respond instantly
          setTimeout(function () { el.style.transitionDelay = ''; }, 1600);
        });
        watchMap.delete(watched);
        i++;
      }
    });
  }
  if (reduce) {
    revealEls.forEach(function (el) { el.classList.add('is-visible'); });
    watchMap.clear();
  } else {
    revealVisible();
    window.addEventListener('scroll', function () { requestAnimationFrame(revealVisible); }, { passive: true });
    window.addEventListener('resize', revealVisible);
  }

  /* ---------- Manifesto: split into words ---------- */
  var manifesto = document.querySelector('[data-words]');
  var words = [];
  if (manifesto && !reduce) {
    (function split(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
            var s = document.createElement('span');
            s.className = 'w';
            s.textContent = part;
            frag.appendChild(s);
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1) {
          split(child);
        }
      });
    })(manifesto);
    words = manifesto.querySelectorAll('.w');
  }

  /* ---------- Parallax targets ---------- */
  var parallax = Array.prototype.map.call(document.querySelectorAll('[data-speed]'), function (el) {
    return { el: el, speed: parseFloat(el.getAttribute('data-speed')) || 0, box: el.parentElement };
  });

  /* ---------- Marquee (drifts left, speeds up with scrolling) ---------- */
  var track = document.querySelector('.marquee__track');
  var mx = 0, half = track ? track.scrollWidth / 2 : 0;
  window.addEventListener('load', function () { if (track) half = track.scrollWidth / 2; });

  /* ---------- Main animation loop ---------- */
  var lastY = window.scrollY, velocity = 0, lit = -1;
  function frame(time) {
    if (lenis) lenis.raf(time);
    var y = window.scrollY;
    var dy = y - lastY;
    if (dy !== 0 && watchMap.size) revealVisible();
    lastY = y;
    velocity += (dy - velocity) * 0.1;

    // nav state
    nav.classList.toggle('is-scrolled', y > 40);
    if (!nav.classList.contains('is-open')) {
      if (dy > 2 && y > vh * 0.6) nav.classList.add('is-hidden');
      else if (dy < -2 || y < vh * 0.6) nav.classList.remove('is-hidden');
    }

    if (!reduce) {
      // parallax
      for (var i = 0; i < parallax.length; i++) {
        var p = parallax[i];
        var r = p.box.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) continue;
        var shift = (vh / 2 - (r.top + r.height / 2)) * p.speed;
        var limit = r.height * 0.11;
        if (!p.el.classList.contains('hero__media') && !p.el.classList.contains('quote__media')) shift = Math.max(-limit, Math.min(limit, shift));
        p.el.style.transform = 'translate3d(0,' + shift.toFixed(1) + 'px,0)';
      }

      // marquee
      if (track && half) {
        mx -= 0.5 + Math.min(Math.abs(velocity) * 0.25, 8);
        if (mx <= -half) mx += half;
        track.style.transform = 'translate3d(' + mx.toFixed(1) + 'px,0,0)';
      }

      // manifesto words
      if (words.length) {
        var mr = manifesto.getBoundingClientRect();
        var progress = (vh * 0.8 - mr.top) / (mr.height + vh * 0.25);
        var count = Math.round(Math.max(0, Math.min(1, progress)) * words.length);
        if (count !== lit) {
          for (var w = 0; w < words.length; w++) words[w].classList.toggle('is-on', w < count);
          lit = count;
        }
      }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* ---------- Past experiences carousel ---------- */
  // Drifts slowly and continuously, looping forever (the cards are duplicated once so the
  // end flows straight back into the start). Pauses on hover, focus, touch/drag, the pause
  // button, when off screen or the tab is hidden. Arrows, swipe, drag and keyboard still work.
  var SPEED = 35; // pixels per second; raise for faster, lower for slower
  var carousel = document.querySelector('[data-carousel]');
  if (carousel) {
    var trackEl = carousel.querySelector('.carousel__track');
    var originals = Array.prototype.slice.call(trackEl.querySelectorAll('.event-card'));
    var count = originals.length;
    var bar = carousel.querySelector('.carousel__progress span');
    var current = carousel.querySelector('.carousel__current');
    var prevBtn = document.querySelector('.carousel__btn[data-dir="-1"]');
    var nextBtn = document.querySelector('.carousel__btn[data-dir="1"]');
    var playBtn = document.querySelector('.carousel__play');

    // duplicate the set once for a seamless loop (hidden from screen readers)
    originals.forEach(function (card) {
      var c = card.cloneNode(true);
      c.classList.remove('reveal');
      c.style.transitionDelay = '';
      c.setAttribute('aria-hidden', 'true');
      trackEl.appendChild(c);
    });
    var allCards = trackEl.querySelectorAll('.event-card');

    function step() {
      var gap = parseFloat(getComputedStyle(trackEl).columnGap) || 20;
      return originals[0].getBoundingClientRect().width + gap;
    }
    function setWidth() { return allCards[count].offsetLeft - allCards[0].offsetLeft; }
    // keep the position inside the first copy so there is always room to keep moving
    function wrap() {
      var w = setWidth();
      if (trackEl.scrollLeft >= w) trackEl.scrollLeft -= w;
      else if (trackEl.scrollLeft < 1 && w) trackEl.scrollLeft += w;
    }

    function update() {
      var w = setWidth() || 1;
      var pos = ((trackEl.scrollLeft % w) + w) % w;
      bar.style.transform = 'scaleX(' + Math.max(0.06, pos / w).toFixed(3) + ')';
      current.textContent = String((Math.round(pos / step()) % count) + 1).padStart(2, '0');
      // each photo drifts a little as its card slides past
      if (!reduce) {
        var mid = window.innerWidth / 2;
        allCards.forEach(function (c) {
          var r = c.getBoundingClientRect();
          if (r.right < -200 || r.left > window.innerWidth + 200) return;
          var off = ((r.left + r.width / 2) - mid) / window.innerWidth;
          c.querySelector('.event-card__img > div').style.transform = 'translate3d(' + (off * -9).toFixed(2) + '%,0,0)';
        });
      }
    }
    trackEl.addEventListener('scroll', function () { requestAnimationFrame(update); }, { passive: true });
    window.addEventListener('resize', update);
    update();

    // pause / resume bookkeeping
    var userPaused = reduce, hovering = false, focused = false, inView = false, holdUntil = 0, smoothUntil = 0;
    function hold(ms) { holdUntil = Date.now() + (ms || 3000); }
    function setPlayState() {
      if (!playBtn) return;
      playBtn.setAttribute('aria-pressed', userPaused ? 'true' : 'false');
      playBtn.setAttribute('aria-label', userPaused ? 'Play slideshow' : 'Pause slideshow');
      playBtn.classList.toggle('is-paused', userPaused);
    }

    // arrows and keyboard: glide one card
    function nudge(dir) {
      wrap();
      if (dir < 0 && trackEl.scrollLeft < step()) trackEl.scrollLeft += setWidth();
      trackEl.scrollBy({ left: step() * dir, behavior: reduce ? 'auto' : 'smooth' });
      smoothUntil = Date.now() + 900;
      hold(4000);
    }
    [prevBtn, nextBtn].forEach(function (btn) {
      btn.addEventListener('click', function () { nudge(parseInt(btn.getAttribute('data-dir'), 10)); });
    });
    trackEl.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); nudge(e.key === 'ArrowRight' ? 1 : -1); }
    });

    // click-and-drag with the mouse (touch devices swipe natively)
    var down = false, startX = 0, startScroll = 0, moved = 0, lastX = 0, vel = 0;
    trackEl.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true; moved = 0; startX = lastX = e.clientX; startScroll = trackEl.scrollLeft; vel = 0;
    });
    window.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - startX;
      moved = Math.max(moved, Math.abs(dx));
      if (moved > 4) trackEl.classList.add('is-dragging');
      vel = e.clientX - lastX; lastX = e.clientX;
      trackEl.scrollLeft = startScroll - dx;
    });
    window.addEventListener('pointerup', function () {
      if (!down) return;
      down = false;
      if (!trackEl.classList.contains('is-dragging')) return;
      trackEl.classList.remove('is-dragging');
      trackEl.scrollBy({ left: -vel * 8, behavior: reduce ? 'auto' : 'smooth' }); // a little momentum
      smoothUntil = Date.now() + 700;
      hold(3000);
    });
    trackEl.addEventListener('dragstart', function (e) { e.preventDefault(); });
    ['pointerdown', 'touchstart', 'wheel'].forEach(function (ev) {
      trackEl.addEventListener(ev, function () { hold(3000); }, { passive: true });
    });

    carousel.addEventListener('mouseenter', function () { hovering = true; });
    carousel.addEventListener('mouseleave', function () { hovering = false; });
    trackEl.addEventListener('focusin', function () { focused = true; });
    trackEl.addEventListener('focusout', function () { focused = false; });
    if (playBtn) {
      playBtn.addEventListener('click', function () { userPaused = !userPaused; holdUntil = 0; setPlayState(); });
      setPlayState();
    }

    // the continuous drift
    var pos = trackEl.scrollLeft, lastT = 0;
    function drift(t) {
      var dt = lastT ? Math.min(64, t - lastT) / 1000 : 0;
      lastT = t;
      var now = Date.now();
      var tr = trackEl.getBoundingClientRect();
      inView = tr.bottom > 0 && tr.top < window.innerHeight;
      var moving = !userPaused && !hovering && !focused && inView && !document.hidden &&
                   now > holdUntil && now > smoothUntil && !down && !trackEl.classList.contains('is-dragging');
      if (moving) {
        pos += SPEED * dt;
        var w = setWidth();
        if (w && pos >= w) pos -= w;
        trackEl.scrollLeft = pos;
      } else {
        if (now > smoothUntil && !down) wrap();
        pos = trackEl.scrollLeft;   // pick up from wherever the visitor left it
      }
      requestAnimationFrame(drift);
    }
    requestAnimationFrame(drift);
  }

  /* ---------- Retreat video: loads as you approach, plays only while on screen ---------- */
  var film = document.querySelector('.retreats__film');
  var video = film && film.querySelector('video');
  if (video) {
    var vBtn = film.querySelector('.video-toggle');
    var vPaused = reduce, vOnScreen = false;  // reduce motion: shows the still until play is pressed
    var vSync = function () {
      var want = vOnScreen && !vPaused && !document.hidden;
      if (want && video.paused) { var p = video.play(); if (p && p.catch) p.catch(function () {}); }
      else if (!want && !video.paused) video.pause();
      vBtn.classList.toggle('is-paused', vPaused);
      vBtn.setAttribute('aria-pressed', vPaused ? 'true' : 'false');
    };
    var vCheck = function () {
      var r = film.getBoundingClientRect(), h = window.innerHeight;
      if (video.preload === 'none' && r.top < h * 2 && r.bottom > -h) video.preload = 'auto';
      var on = r.top < h && r.bottom > 0;
      if (on !== vOnScreen) { vOnScreen = on; vSync(); }
    };
    vBtn.addEventListener('click', function () { vPaused = !vPaused; vSync(); });
    document.addEventListener('visibilitychange', vSync);
    window.addEventListener('scroll', function () { requestAnimationFrame(vCheck); }, { passive: true });
    window.addEventListener('resize', vCheck);
    vSync();
    vCheck();
  }

  /* ---------- Partnership inquiry pop-up ----------
     The buttons are plain email links, so without JavaScript they still open an email to
     hello@welda.club. With it, they open the form, which is sent through Web3Forms. */
  var inquiry = document.getElementById('inquiry');
  if (inquiry && typeof inquiry.showModal === 'function') {
    var iForm = inquiry.querySelector('form');
    var iBody = inquiry.querySelector('.inquiry__body');
    var iDone = inquiry.querySelector('.inquiry__done');
    var iStatus = inquiry.querySelector('.inquiry__status');
    var iSend = iForm.querySelector('[type="submit"]');
    var ENDPOINT = 'https://api.web3forms.com/submit';

    var setStatus = function (html, isError) {
      iStatus.innerHTML = html;
      iStatus.classList.toggle('is-error', !!isError);
    };
    var fields = function () {
      var data = {};
      new FormData(iForm).forEach(function (v, k) { data[k] = String(v).trim(); });
      return data;
    };
    // a pre-filled email with their answers, in case sending fails
    var mailtoFallback = function (data) {
      var lines = ['Name', 'email', 'Phone', 'Date', 'Partnership type', 'Budget', 'Message']
        .filter(function (k) { return data[k]; })
        .map(function (k) { return (k === 'email' ? 'Email' : k) + ': ' + data[k]; });
      return 'mailto:hello@welda.club?subject=' + encodeURIComponent('Partnership inquiry') +
        '&body=' + encodeURIComponent(lines.join('\n'));
    };

    // Phone: US numbers format as you type, (555) 123-4567. Numbers starting with + are left as typed.
    var phone = iForm.querySelector('#iq-phone');
    var phoneDigits = '';
    var formatUS = function (d) {
      var cc = '';
      if (d.length === 11 && d.charAt(0) === '1') { cc = '+1 '; d = d.slice(1); }
      if (d.length > 10) return d;                     // too long for a US number: leave it alone
      if (d.length < 4) return cc + d;
      if (d.length < 7) return cc + '(' + d.slice(0, 3) + ') ' + d.slice(3);
      return cc + '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6);
    };
    var checkPhone = function () {
      var v = phone.value, n = v.replace(/\D/g, '').length;
      var ok = !v || (v.charAt(0) === '+' ? n >= 8 && n <= 15 : n === 10 || (n === 11 && v.replace(/\D/g, '').charAt(0) === '1'));
      phone.setCustomValidity(ok ? '' : 'Please enter a full phone number, like (555) 123-4567.');
    };
    phone.addEventListener('input', function (e) {
      var v = phone.value;
      var lead = v.replace(/^\s+/, '');
      if (lead.charAt(0) === '+') {                  // international: just tidy stray characters
        phone.value = '+' + lead.slice(1).replace(/[^\d\s().-]/g, '');
      } else {
        var caret = phone.selectionStart || 0;
        var before = v.slice(0, caret).replace(/\D/g, '').length;
        var d = v.replace(/\D/g, '');
        // backspacing over a bracket, space or dash removes the digit before it instead
        if (e.inputType === 'deleteContentBackward' && d === phoneDigits && before > 0) {
          d = d.slice(0, before - 1) + d.slice(before);
          before--;
        }
        var out = formatUS(d);
        phone.value = out;
        var pos = 0, seen = 0;
        while (pos < out.length && seen < before) { if (/\d/.test(out.charAt(pos))) seen++; pos++; }
        if (document.activeElement === phone) phone.setSelectionRange(pos, pos);
      }
      phoneDigits = phone.value.replace(/\D/g, '');
      checkPhone();
    });

    document.querySelectorAll('[data-open-inquiry]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        if (!iDone.hidden) { iForm.reset(); phoneDigits = ''; checkPhone(); iDone.hidden = true; iBody.hidden = false; }
        setStatus('');
        inquiry.showModal();
        if (lenis) lenis.stop();
      });
    });
    inquiry.querySelectorAll('[data-close-inquiry]').forEach(function (btn) {
      btn.addEventListener('click', function () { inquiry.close(); });
    });
    // clicking the dimmed area outside the box closes it
    inquiry.addEventListener('click', function (e) { if (e.target === inquiry) inquiry.close(); });
    inquiry.addEventListener('close', function () { if (lenis) lenis.start(); });

    iForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = fields();
      if (data.botcheck) { iBody.hidden = true; iDone.hidden = false; return; } // a bot ticked the hidden box
      delete data.botcheck;
      iSend.disabled = true;
      iSend.textContent = 'Sending...';
      setStatus('');
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(data)
      })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (String(res.success) !== 'true') throw new Error(res.message || 'not sent');
          iBody.hidden = true;
          iDone.hidden = false;
          iDone.querySelector('button').focus();
        })
        .catch(function () {
          setStatus('Sorry, that did not go through. Please <a href="' + mailtoFallback(data) +
            '">email us your details</a> at hello@welda.club instead.', true);
        })
        .then(function () { iSend.disabled = false; iSend.textContent = 'Send inquiry'; });
    });
  }

  /* ---------- Magnetic buttons (desktop) ---------- */
  if (finePointer && !reduce) {
    document.querySelectorAll('.magnetic').forEach(function (el) {
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        var x = (e.clientX - r.left - r.width / 2) * 0.25;
        var yy = (e.clientY - r.top - r.height / 2) * 0.35;
        el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + yy.toFixed(1) + 'px)';
      });
      el.addEventListener('mouseleave', function () { el.style.transform = ''; });
    });
  }

  /* ---------- Keep the copyright year current ---------- */
  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
