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

export function trackingSnippet(opts: { pixelId: string; lp: string }): string {
  const cfg = JSON.stringify({ pixelId: opts.pixelId, lp: opts.lp }).replace(/</g, "\\u003c");
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
