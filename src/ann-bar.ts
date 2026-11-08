// The offer bar at the top of every landing page: the same three lines, type
// and copy icon as the announcement bar on keptcollection.com, so a visitor
// sees one bar from the ad to the cart.
//
// The designs draw their own bar (old wording, 11px). This snippet hides it
// and puts this one in its place, so a wording change is one edit here and
// reaches every page, look-inside included, on the next deploy. A page whose
// design has no bar with the code in it is left alone.

export const ANN_BAR = {
  // First line, by date. Each entry shows until its `until` time (UTC, checked
  // on the visitor's clock); the last one has no end.
  headlines: [
    // The fall sale ends at midnight Oct 31, store time (Eastern).
    { text: "Fall sale ends soon!", until: "2026-11-01T04:00:00Z" },
    // From Nov 1: Black Friday, the name Cody picked after the sale-name test
    // (Nov 1-3: Holiday 40 orders / $3,899, Black Friday 40 / $4,027, no
    // difference). Same wording as the store's bar ("is Live!" since Nov 3,
    // 9:49 AM PT). It stops being true after Cyber Monday (Nov 30): give it an
    // until and add the next line before then.
    { text: "Black Friday Sale is Live!" },
  ] as { text: string; until?: string }[],
  code: "KEPT25",
};

// The store's sale-name test (Intelligems, "Sale name v2"), extended to the
// landing pages so landing-page visitors are in it too. Each visitor gets one
// name at random, kept in the kept_sale cookie on keptcollection.com (shared
// with the store, which also writes it for visitors it assigns first), shown
// in this bar and passed to the store as ks=<arm> on every store link. The
// store test assigns ks/kept_sale visitors to the matching group, so a visitor
// sees the same name on the landing page, in the store bar, by the price and
// in the cart. The pages also count the split with pixel custom events
// (LPSaleName_, LPSaleNew_ and LPSaleClick_ + h or b; see the snippet).
// Set to null to stop (the dated headline above applies again).
// Off since Nov 3 (test ended, Black Friday chosen). To run another name test,
// set it to e.g. { from, cookie: "kept_sale", param: "ks", arms: { h: "...", b: "..." } }.
export const SALE_TEST: {
  from: string;
  cookie: string;
  param: string;
  arms: Record<string, string>;
} | null = null;

// The store's announcement bar test (Intelligems, "Announcement bar: Tidy vs
// Serif", Nov 7, 2026), extended to the landing pages the same way as the
// sale-name test: each visitor got one bar version at random, kept in the
// kept_bar cookie on keptcollection.com (the store writes it too, for visitors
// it assigns first), drawn here and passed to the store as kb=<arm> on every
// store link, so the store test put them in the matching group. The pages
// counted the split with pixel custom events LPBar_<arm> (every page view),
// LPBarNew_<arm> (a visitor's first version) and LPBarClick_<arm> (with each
// LPClick, from src/tracking.ts).
//   t = Tidy (A, control): the three lines, first line in Jost Bold (was
//       ExtraBold), "with code KEPT25" in place of the dash.
//   s = Serif (B): the first line in EB Garamond, then one small line.
// Off since Nov 7, 4:15 PM PT: Cody picked Tidy after the first day (store:
// Tidy 14 orders, $5.55 per visitor; Serif 7, $2.26). Tidy is now the bar below
// for every visitor, and Serif is gone. To run another bar test, set this to e.g.
// { from, cookie: "kept_bar", param: "kb", arms: ["t", "x"] }: each visitor's
// bar then gets the class kept-ann--<arm>, so add that version's CSS (and any
// wording change in build()) for each arm other than the default.
export const BAR_TEST: {
  from: string;
  cookie: string;
  param: string;
  arms: string[];
} | null = null;

const CSS = `
.kept-ann{display:block!important;box-sizing:border-box;width:100%;margin:0;padding:10px 16px;background:#657686;color:#fff;text-align:center;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
.kept-ann *{box-sizing:border-box}
.kept-ann .kept-ann__text{margin:0!important;padding:0;color:#fff!important;font-family:"Jost","Avenir Next","Helvetica Neue",sans-serif!important;font-weight:500!important;font-style:normal;font-size:13px!important;letter-spacing:.14em!important;line-height:1.7!important;text-transform:uppercase!important;text-align:center}
@media (max-width:374px){.kept-ann .kept-ann__text{font-size:12px!important;letter-spacing:.12em!important}}
.kept-ann .kept-ann__lead{font-weight:700!important}
.kept-ann u{color:inherit;text-decoration:underline}
.kept-ann .kept-ann__group{white-space:nowrap}
.kept-ann .kept-ann__copy{-webkit-appearance:none;appearance:none;box-sizing:content-box;position:relative;display:inline-grid;place-items:center;width:14px;height:14px;margin:0 0 0 6px;padding:0;border:0;border-radius:0;background:transparent;color:inherit;line-height:0;vertical-align:-2px;cursor:pointer;-webkit-tap-highlight-color:transparent}
.kept-ann .kept-ann__copy::after{content:"";position:absolute;inset:-12px -10px}
.kept-ann .kept-ann__copy>span{grid-area:1/1;display:block;width:14px;height:14px}
.kept-ann .kept-ann__copy svg{display:block;width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
.kept-ann .kept-ann__done{visibility:hidden}
.kept-ann .kept-ann__copy.is-copied .kept-ann__icon{visibility:hidden}
.kept-ann .kept-ann__copy.is-copied .kept-ann__done{visibility:visible}
@media (hover:hover){.kept-ann .kept-ann__copy:hover{opacity:.7}}
.kept-ann .kept-ann__copy:focus-visible{outline:1px solid currentColor;outline-offset:3px}
.kept-ann .kept-ann__sr{position:absolute!important;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
@media (min-width:641px){.kept-ann{padding:11px 24px}.kept-ann .kept-ann__text{font-size:12px!important;letter-spacing:.16em!important;line-height:1.6!important}}
@media (min-width:1000px){.kept-ann{padding:11px 48px}}
[data-kept-ann-replaced]{display:none!important}
`.replace(/\n/g, "");

export function annBarSnippet(opts: { lp: string }): string {
  const cfg = JSON.stringify({ lp: opts.lp, headlines: ANN_BAR.headlines, test: SALE_TEST, barTest: BAR_TEST, code: ANN_BAR.code, css: CSS }).replace(/</g, "\\u003c");
  return `<script>/* Kept LP offer bar, added by the go.keptcollection.com router (src/ann-bar.ts) */
(function (cfg) {
  try {
    var now = Date.now(), headline = '';
    for (var i = 0; i < cfg.headlines.length; i++) {
      var h = cfg.headlines[i];
      if (!h.until || now < Date.parse(h.until)) { headline = h.text; break; }
    }

    // Sale-name test: one name per visitor, shared with the store (see SALE_TEST).
    var t = cfg.test;
    if (t && now >= Date.parse(t.from)) {
      var arm = (document.cookie.match(new RegExp('(?:^|; )' + t.cookie + '=([^;]*)')) || [])[1];
      var fresh = !t.arms[arm];
      if (fresh) {
        var keys = Object.keys(t.arms);
        arm = keys[Math.floor(Math.random() * keys.length)];
      }
      var host = window.location.hostname;
      var domain = /(^|\\.)keptcollection\\.com$/i.test(host) ? '; Domain=keptcollection.com' : '';
      try { document.cookie = t.cookie + '=' + arm + domain + '; Path=/; Max-Age=5184000; SameSite=Lax; Secure'; } catch (err) {}
      headline = t.arms[arm];
      // Added to every store link by the tracking snippet (decorate()).
      window.__keptStoreParams = window.__keptStoreParams || {};
      window.__keptStoreParams[t.param] = arm;
      // Count the split on the landing pages themselves. One pixel custom
      // event per name, so Events Manager shows the counts without a
      // parameter breakdown:
      //   LPSaleName_<arm>  every page view, by the name it showed
      //   LPSaleNew_<arm>   a visitor's first name (no kept_sale cookie yet),
      //                     i.e. the landing pages' own random split
      // The tracking snippet adds LPSaleClick_<arm> to each LPClick.
      window.__keptSaleArm = arm;
      try {
        if (window.fbq) {
          window.fbq('trackCustom', 'LPSaleName_' + arm, { lp: cfg.lp });
          if (fresh) window.fbq('trackCustom', 'LPSaleNew_' + arm, { lp: cfg.lp });
        }
      } catch (err) {}
    }

    // Bar design test: one version per visitor, shared with the store (see
    // BAR_TEST; off while it's null). Same cookie and store-param handling as
    // above; the version only adds a kept-ann--<arm> class to the bar.
    var look = '';
    var bt = cfg.barTest;
    if (bt && now >= Date.parse(bt.from)) {
      var barArm = (document.cookie.match(new RegExp('(?:^|; )' + bt.cookie + '=([^;]*)')) || [])[1];
      var barFresh = bt.arms.indexOf(barArm) < 0;
      if (barFresh) barArm = bt.arms[Math.floor(Math.random() * bt.arms.length)];
      var barDomain = /(^|\\.)keptcollection\\.com$/i.test(window.location.hostname) ? '; Domain=keptcollection.com' : '';
      try { document.cookie = bt.cookie + '=' + barArm + barDomain + '; Path=/; Max-Age=5184000; SameSite=Lax; Secure'; } catch (err) {}
      look = barArm;
      window.__keptStoreParams = window.__keptStoreParams || {};
      window.__keptStoreParams[bt.param] = barArm;
      // LPBar_<arm> on every page view, LPBarNew_<arm> for a visitor's first
      // version; the tracking snippet adds LPBarClick_<arm> to each LPClick.
      window.__keptBarArm = barArm;
      try {
        if (window.fbq) {
          window.fbq('trackCustom', 'LPBar_' + barArm, { lp: cfg.lp });
          if (barFresh) window.fbq('trackCustom', 'LPBarNew_' + barArm, { lp: cfg.lp });
        }
      } catch (err) {}
    }

    var NB = '\\u00a0';
    var SVG = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">';
    var ICON_COPY = SVG + '<rect x="8.5" y="8.5" width="12" height="12" rx="1"/><path d="M15.5 8.5V4.5a1 1 0 0 0-1-1h-10a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h4"/></svg>';
    var ICON_DONE = SVG + '<path d="M4.5 12.5l5 5L19.5 7"/></svg>';
    var ours = null, theirs = null;

    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

    function build() {
      var bar = document.createElement('div');
      bar.className = 'kept-ann' + (look ? ' kept-ann--' + look : '');
      bar.setAttribute('role', 'region');
      bar.setAttribute('aria-label', 'Offer');
      var code = '<span class="kept-ann__group"><u class="kept-ann__code">' + esc(cfg.code) + '</u>' +
        '<button type="button" class="kept-ann__copy" aria-label="Copy code ' + esc(cfg.code) + '" title="Copy code">' +
          '<span class="kept-ann__icon">' + ICON_COPY + '</span><span class="kept-ann__done">' + ICON_DONE + '</span>' +
        '</button></span>';
      // The Tidy bar (won the Nov 7 bar test): first line in Jost Bold, then
      // "with code KEPT25" on the third line, as in the store's bar.
      var lines = (headline ? '<span class="kept-ann__lead">' + esc(headline) + '</span><br>' : '') +
        '\\ud83d\\udce6' + NB + 'Free shipping' + NB + 'on <u>all</u> orders<br>' +
        '<span class="kept-ann__group">\\ud83d\\udcda' + NB + '25% off 2+ books' + NB + 'with code' + NB + '</span><wbr>' + code;
      var fonts = 'https://fonts.googleapis.com/css2?family=Jost:wght@500;700&display=swap';
      bar.innerHTML =
        '<style>' + cfg.css + '</style>' +
        '<link rel="stylesheet" href="' + fonts + '">' +
        '<p class="kept-ann__text">' + lines + '</p>' +
        '<span class="kept-ann__sr" role="status"></span>';
      wire(bar);
      return bar;
    }

    // Copy only: the shopper still pastes the code and hits Apply at checkout.
    function legacyCopy(text) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none;font-size:16px';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) {}
      ta.remove();
      return ok;
    }
    function copyText(text) {
      return new Promise(function (resolve, reject) {
        function fallback() { if (legacyCopy(text)) resolve(); else reject(new Error('copy failed')); }
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(resolve, fallback);
        else fallback();
      });
    }
    function wire(bar) {
      var btn = bar.querySelector('.kept-ann__copy');
      var status = bar.querySelector('.kept-ann__sr');
      var codeEl = bar.querySelector('.kept-ann__code');
      var timer = null;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        copyText(cfg.code).then(function () {
          btn.classList.add('is-copied');
          status.textContent = cfg.code + ' copied. Paste it at checkout.';
          clearTimeout(timer);
          timer = setTimeout(function () { btn.classList.remove('is-copied'); status.textContent = ''; }, 2500);
          try { if (window.fbq) window.fbq('trackCustom', 'LPCopyCode', { lp: cfg.lp }); } catch (err) {}
        }).catch(function () {
          // No clipboard at all: select the code so it can be copied by hand.
          try {
            var sel = window.getSelection(), r = document.createRange();
            r.selectNodeContents(codeEl);
            sel.removeAllRanges();
            sel.addRange(r);
          } catch (err) {}
          status.textContent = 'Select ' + cfg.code + ' to copy it.';
        });
      });
    }

    // The design's own bar: the first element with a background that holds the
    // code, at the top of the page.
    function findTheirs() {
      if (!document.body) return null;
      var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
      while (w.nextNode()) {
        var n = w.currentNode;
        if (n.nodeValue.indexOf(cfg.code) < 0) continue;
        var el = n.parentElement;
        if (!el || el.closest('.kept-ann, script, style, template, noscript')) continue;
        for (var d = 0; el && el !== document.body && d < 6; d++, el = el.parentElement) {
          var bg = window.getComputedStyle(el).backgroundColor;
          if (bg && bg !== 'transparent' && bg !== 'rgba(0, 0, 0, 0)') {
            var r = el.getBoundingClientRect();
            // On screen (not a hidden copy the export keeps), at the top, bar-sized.
            return r.width > 0 && r.height > 0 && r.height < 240 && r.top + (window.pageYOffset || 0) < 80 ? el : null;
          }
        }
        return null;
      }
      return null;
    }

    function ensure() {
      // The export rebuilds its page from a copy of the DOM, which can carry a
      // dead copy of this bar (no copy button behind it). Keep only ours.
      var all = document.querySelectorAll('.kept-ann');
      for (var k = 0; k < all.length; k++) if (all[k] !== ours) all[k].parentNode.removeChild(all[k]);
      if (ours && ours.isConnected && theirs && theirs.isConnected && ours.nextElementSibling === theirs) return;
      var found = findTheirs();
      if (!found) return;
      theirs = found;
      if (!ours) ours = build();
      if (!ours.isConnected || ours.nextElementSibling !== theirs) theirs.parentNode.insertBefore(ours, theirs);
      theirs.setAttribute('data-kept-ann-replaced', '');
      theirs.setAttribute('aria-hidden', 'true');
    }

    ensure();
    if (window.MutationObserver) {
      var mo = new MutationObserver(function () { try { ensure(); } catch (err) {} });
      mo.observe(document, { childList: true, subtree: true });
      window.addEventListener('load', function () { ensure(); setTimeout(function () { ensure(); mo.disconnect(); }, 5000); });
    }
    document.addEventListener('DOMContentLoaded', ensure);
  } catch (err) {}
})(${cfg});
</script>`;
}
