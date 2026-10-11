/* Missing Persons pages: progressive enhancement only.
   Without this file every page is still complete and readable.
   No dependencies, no network requests, no storage.
   Starts automatically when a .mp page is present. For single-page apps:
   MissingPersonsPages.init() after the page renders, .destroy() before leaving. */
(function () {
  'use strict';

  var active = null;

  function init() {
    var root = document.querySelector('.mp');
    if (!root || root.getAttribute('data-mp-ready') === '1') return;
    if (active) destroy();
    root.setAttribute('data-mp-ready', '1');
    document.documentElement.classList.add('mp-js');

    var cleanups = [];
    var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var locale = root.getAttribute('data-locale') || 'en-US';

    function listen(target, type, fn, opts) {
      target.addEventListener(type, fn, opts);
      cleanups.push(function () { target.removeEventListener(type, fn, opts); });
    }

    /* ---- Count-up numbers: the final text is already in the HTML ---- */
    function countUp(el) {
      var target = parseFloat(el.getAttribute('data-count'));
      if (reduce || isNaN(target)) return;
      var finalNodes = Array.prototype.map.call(el.childNodes, function (n) { return n.cloneNode(true); });
      var prefix = el.getAttribute('data-prefix') || '';
      var suffix = el.getAttribute('data-suffix') || '';
      var fmt = new Intl.NumberFormat(locale);
      var numberNode = document.createTextNode('');
      el.textContent = '';
      el.appendChild(numberNode);
      if (suffix) {
        var small = document.createElement('small');
        small.textContent = suffix;
        el.appendChild(small);
      }
      var dur = 1800, t0 = null, raf = 0;
      function frame(t) {
        if (!t0) t0 = t;
        var p = Math.min((t - t0) / dur, 1);
        numberNode.nodeValue = prefix + fmt.format(Math.round(target * (1 - Math.pow(1 - p, 4))));
        if (p < 1) { raf = requestAnimationFrame(frame); return; }
        el.textContent = '';
        finalNodes.forEach(function (n) { el.appendChild(n); });
      }
      raf = requestAnimationFrame(frame);
      cleanups.push(function () { cancelAnimationFrame(raf); });
    }

    /* ---- Reveal on scroll ---- */
    var pending = Array.prototype.slice.call(
      root.querySelectorAll('[data-reveal], [data-count], .mp-bar-fill, .mp-donut, .mp-timeline, .mp-phases'));
    function reveal(el) {
      if (el.classList.contains('is-in')) return;
      el.classList.add('is-in');
      if (el.hasAttribute('data-count')) countUp(el);
    }
    function revealInView() {
      var vh = window.innerHeight || document.documentElement.clientHeight;
      pending = pending.filter(function (el) {
        var r = el.getBoundingClientRect();
        if (r.bottom <= 0 || (r.top < vh - 40 && r.bottom > 0)) { reveal(el); return false; }
        return true;
      });
    }
    if (reduce) {
      pending.forEach(reveal);
      pending = [];
    } else if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) { reveal(e.target); io.unobserve(e.target); }
        });
      }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
      pending.forEach(function (el) { io.observe(el); });
      cleanups.push(function () { io.disconnect(); });
    }
    revealInView();
    listen(window, 'load', revealInView);
    var safety = setTimeout(function () { if (!root.querySelector('.is-in')) pending.forEach(reveal); }, 4000);
    cleanups.push(function () { clearTimeout(safety); });

    /* ---- Reading progress + back to top ---- */
    var bar = root.querySelector('.mp-progress span');
    var toTop = root.querySelector('.mp-totop');
    var ticking = false;
    function onScroll() {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      var p = max > 0 ? h.scrollTop / max : 0;
      if (bar) bar.style.setProperty('--p', p.toFixed(4));
      if (toTop) toTop.classList.toggle('is-shown', h.scrollTop > 700);
      if (pending.length) revealInView();
      ticking = false;
    }
    listen(window, 'scroll', function () {
      if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
    }, { passive: true });
    onScroll();
    if (toTop) listen(toTop, 'click', function () {
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    });

    /* ---- In-page navigation: highlight the current section ---- */
    var links = root.querySelectorAll('.mp-toc a[href^="#"]');
    var strip = root.querySelector('.mp-toc-inner');
    if (links.length && 'IntersectionObserver' in window) {
      var map = {};
      Array.prototype.forEach.call(links, function (a) { map[a.getAttribute('href').slice(1)] = a; });
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          var a = map[e.target.id];
          if (!a) return;
          Array.prototype.forEach.call(links, function (l) { l.classList.remove('is-active'); l.removeAttribute('aria-current'); });
          a.classList.add('is-active');
          a.setAttribute('aria-current', 'true');
          if (strip) {
            var left = a.offsetLeft - strip.clientWidth / 2 + a.clientWidth / 2;
            strip.scrollTo({ left: left, behavior: reduce ? 'auto' : 'smooth' });
          }
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      Object.keys(map).forEach(function (id) {
        var s = document.getElementById(id);
        if (s) spy.observe(s);
      });
      cleanups.push(function () { spy.disconnect(); });
    }

    active = { root: root, cleanups: cleanups };
  }

  function destroy() {
    if (!active) return;
    active.cleanups.forEach(function (fn) { fn(); });
    active.root.removeAttribute('data-mp-ready');
    active = null;
  }

  window.MissingPersonsPages = { init: init, destroy: destroy };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
