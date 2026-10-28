// Tracking added to every landing page as it's served. Keeping it here (not in
// the designs) means every page gets the same pixel and link handling, and a
// change here reaches all of them on the next push.
//
// What it does in the visitor's browser:
//  0. Keeps a mobile viewport tag and the Kept favicon on the page (see
//     ensureViewport, ensureFavicon).
//  1. Loads the Meta pixel and fires PageView.
//  2. When someone clicks a link to keptcollection.com, copies the ad and
//     attribution params from the landing page URL (utm_*, fbclid, trybe, ...)
//     onto that link, adds lp=<page>, and fires a custom "LPClick" event.
//  3. Error guard (see guard() below): reports script errors as a custom
//     "LPError" event, hides the export's red debug box from shoppers, and if
//     the page never renders, fires "LPBlank" and sends the visitor to the
//     product page with their params, so a broken page can't waste the click.

// Guard timings, in ms. Exported for the tests.
export const GUARD = {
  // After a script error, how long past the load event the page gets to show
  // something before the visitor is sent to the store.
  afterErrorMs: 4000,
  // With no error at all, how long the page gets in total (from the first
  // byte of HTML) before an empty page counts as stuck.
  stuckMs: 20000,
  // How often the guard looks again while it waits.
  pollMs: 2000,
  // Most LPError events one page view can send (one bad loop shouldn't flood the pixel).
  maxErrors: 3,
};

// `guard` overrides the timings (the browser checks in smoke/ use shorter ones).
export function trackingSnippet(opts: { pixelId: string; lp: string; fallback?: string; guard?: Partial<typeof GUARD> }): string {
  const guard = { ...GUARD, ...opts.guard };
  const cfg = JSON.stringify({ pixelId: opts.pixelId, lp: opts.lp, fallback: opts.fallback ?? "", guard }).replace(/</g, "\\u003c");
  return `<script>/* Kept LP tracking, added by the go.keptcollection.com router */
(function (cfg) {
  // The Claude Design export unpacks itself and replaces <head>, dropping the
  // viewport tag the router added. Put it back whenever it goes missing.
  function ensureViewport() {
    if (document.querySelector('meta[name="viewport"]')) return;
    var m = document.createElement('meta');
    m.name = 'viewport';
    m.content = 'width=device-width, initial-scale=1';
    (document.head || document.documentElement).appendChild(m);
  }
  // Same for the favicon: the head swap drops the icon link the router added.
  function ensureFavicon() {
    if (document.querySelector('link[rel~="icon"]')) return;
    var l = document.createElement('link');
    l.rel = 'icon';
    l.type = 'image/png';
    l.href = '/favicon.png';
    (document.head || document.documentElement).appendChild(l);
  }
  // Decorative loop videos (aria-hidden, like a video hero) must be muted and
  // inline to autoplay on phones. The design sets this too; this is the backup.
  function ensureVideos() {
    var vs = document.querySelectorAll('video[aria-hidden="true"]');
    for (var i = 0; i < vs.length; i++) {
      var v = vs[i];
      if (v.__keptAuto) continue;
      v.__keptAuto = true;
      v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true;
      v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('loop', '');
      if (v.paused) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
    }
  }
  function onChange() { ensureViewport(); ensureFavicon(); ensureVideos(); }
  onChange();
  if (window.MutationObserver) {
    var mo = new MutationObserver(onChange);
    mo.observe(document, { childList: true, subtree: true });
    window.addEventListener('load', function () { onChange(); setTimeout(function () { onChange(); mo.disconnect(); }, 5000); });
  }

  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
  n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
  document,'script','https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', cfg.pixelId);
  fbq('track', 'PageView');

  // Error guard. Until Oct 27 an iPhone-only crash left some pages blank for
  // 12 days before a shopper reported it. This makes a crash show up as a
  // number (LPError in Events Manager) and keeps a broken page from wasting the
  // click: if the page never renders, LPBlank fires and the visitor goes to the
  // product page with their params (plus lpf=<reason>, so Shopify shows it).
  // Add ?lpdebug=1 to a page to see errors on screen and skip the redirect.
  (function guard(g) {
    var t0 = Date.now();
    var params = new URLSearchParams(window.location.search);
    var debug = params.has('lpdebug');
    var errors = 0, sent = 0, done = false, loadedAt = 0;
    function send(name, data) { try { fbq('trackCustom', name, data); } catch (err) {} }
    // The export draws script errors in a red box at the bottom of the page.
    // Useful in Claude Design, not for shoppers.
    function hideDebugBox() {
      if (debug) return;
      var d = document.getElementById('__bundler_err');
      if (d) d.style.display = 'none';
    }
    function report(where, msg, fatal) {
      if (fatal) errors++;
      if (sent >= g.maxErrors) return;
      sent++;
      send('LPError', { lp: cfg.lp, where: where, msg: String(msg || '').replace(/\\s+/g, ' ').slice(0, 120) });
    }
    window.addEventListener('error', function (e) {
      // A failed image or script download fires at the element with no message: not a crash.
      if (!e.message && !e.error) return;
      setTimeout(hideDebugBox, 0);
      var msg = e.message || (e.error && e.error.message) || '';
      // Errors from other origins (the pixel, browser extensions) arrive as a bare
      // "Script error." with nothing to act on; ResizeObserver warnings are harmless.
      if (/^Script error\\.?$/.test(msg) || /ResizeObserver loop/i.test(msg)) return;
      report('error', msg, true);
    }, true);
    window.addEventListener('unhandledrejection', function (e) {
      var r = e && e.reason;
      report('rejection', r && r.message ? r.message : r, false);
    });

    // Has the page drawn itself? A link to the store or a real amount of text
    // counts; the export's own "Loading…" placeholder and error box don't.
    function rendered() {
      if (document.querySelector('a[href*="//keptcollection.com"], a[href*="//www.keptcollection.com"]')) return true;
      var b = document.body;
      if (!b) return false;
      var text = b.innerText || b.textContent || '';
      ['__bundler_err', '__bundler_loading', '__bundler_placeholder'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) text = text.split(el.innerText || el.textContent || '').join('');
      });
      return text.replace(/\\s+/g, ' ').trim().length >= 80;
    }
    // The export's loader writes "Error …" into its status line when it can't unpack.
    function loaderFailed() {
      var l = document.getElementById('__bundler_loading');
      return !!(l && /^\\s*Error/i.test(l.textContent || ''));
    }
    function fallback(reason) {
      if (done) return;
      done = true;
      send('LPBlank', { lp: cfg.lp, reason: reason, errors: errors, secs: Math.round((Date.now() - t0) / 1000) });
      if (debug || !cfg.fallback) return;
      var to;
      try { to = new URL(cfg.fallback); } catch (err) { return; }
      params.forEach(function (v, k) { to.searchParams.set(k, v); });
      to.searchParams.set('lp', cfg.lp);
      to.searchParams.set('lpf', reason);
      // A moment for the LPBlank request to leave before the page changes.
      setTimeout(function () { window.location.replace(to.toString()); }, 400);
    }
    function check() {
      if (done) return;
      if (rendered()) { done = true; return; }
      if (!errors && loaderFailed()) report('loader', (document.getElementById('__bundler_loading') || {}).textContent, true);
      var now = Date.now();
      // A script error and still nothing on screen: the page has crashed.
      if (errors && (loadedAt ? now - loadedAt >= g.afterErrorMs : now - t0 >= g.stuckMs / 2)) return fallback('error');
      // No error, but nothing after this long: stuck. (Not while the HTML is still arriving.)
      if (now - t0 >= g.stuckMs && document.readyState !== 'loading') return fallback('stuck');
      setTimeout(check, g.pollMs);
    }
    window.addEventListener('load', function () { loadedAt = Date.now(); });
    setTimeout(check, g.pollMs);
  })(cfg.guard);

  var KEEP = /^(utm_[a-z_]+|fbclid|gclid|gbraid|wbraid|ttclid|msclkid|trybe)$/i;
  var here = new URLSearchParams(window.location.search);

  function linkFrom(e) {
    var path = e.composedPath ? e.composedPath() : [e.target];
    for (var i = 0; i < path.length; i++) {
      var n = path[i];
      if (n && n.tagName === 'A' && n.href) return n;
    }
    return null;
  }

  function decorate(a) {
    if (!a) return null;
    var u;
    try { u = new URL(a.href, window.location.href); } catch (err) { return null; }
    var toStore = /(^|\\.)keptcollection\\.com$/i.test(u.hostname) && u.hostname !== window.location.hostname;
    if (!toStore) return null;
    here.forEach(function (v, k) { if (KEEP.test(k) && !u.searchParams.has(k)) u.searchParams.set(k, v); });
    if (!u.searchParams.has('lp')) u.searchParams.set('lp', cfg.lp);
    var next = u.toString();
    if (a.href !== next) a.href = next;
    return u;
  }

  // Decorate before the browser follows the link (covers taps, middle-clicks,
  // "open in new tab" and keyboard focus too).
  ['pointerdown', 'focusin', 'contextmenu'].forEach(function (type) {
    document.addEventListener(type, function (e) { decorate(linkFrom(e)); }, true);
  });
  document.addEventListener('click', function (e) {
    var a = linkFrom(e);
    var u = decorate(a);
    if (!u) return;
    var label = (a.textContent || a.getAttribute('aria-label') || '').replace(/\\s+/g, ' ').trim().slice(0, 80);
    try { fbq('trackCustom', 'LPClick', { lp: cfg.lp, cta: label, destination: u.pathname }); } catch (err) {}
  }, true);
})(${cfg});
</script>`;
}

// Put the snippet at the top of <head> (where Meta recommends the pixel).
export function injectIntoHead(html: string, snippet: string): string {
  const m = /<head(\s[^>]*)?>/i.exec(html);
  if (!m) return snippet + html;
  const at = m.index + m[0].length;
  return html.slice(0, at) + snippet + html.slice(at);
}
