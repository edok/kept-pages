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
    // From Nov 1 the store tests "Holiday Sale is Live!" against "Black Friday
    // Sale is Live!" in Intelligems. Visitors who arrive from a landing page
    // (lp= on the URL) are kept in the Holiday group there, so this matches.
    // When the test picks a winner, change this line to it.
    { text: "Holiday Sale is Live!" },
  ] as { text: string; until?: string }[],
  code: "KEPT25",
};

const CSS = `
.kept-ann{display:block!important;box-sizing:border-box;width:100%;margin:0;padding:10px 16px;background:#657686;color:#fff;text-align:center}
.kept-ann *{box-sizing:border-box}
.kept-ann .kept-ann__text{margin:0!important;padding:0;color:#fff!important;font-family:"Jost","Avenir Next","Helvetica Neue",sans-serif!important;font-weight:500!important;font-style:normal;font-size:13px!important;letter-spacing:.14em!important;line-height:1.7!important;text-transform:uppercase!important;text-align:center}
.kept-ann .kept-ann__lead{font-weight:800!important}
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
  const cfg = JSON.stringify({ lp: opts.lp, headlines: ANN_BAR.headlines, code: ANN_BAR.code, css: CSS }).replace(/</g, "\\u003c");
  return `<script>/* Kept LP offer bar, added by the go.keptcollection.com router (src/ann-bar.ts) */
(function (cfg) {
  try {
    var now = Date.now(), headline = '';
    for (var i = 0; i < cfg.headlines.length; i++) {
      var h = cfg.headlines[i];
      if (!h.until || now < Date.parse(h.until)) { headline = h.text; break; }
    }
    var NB = '\\u00a0';
    var SVG = '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">';
    var ICON_COPY = SVG + '<rect x="8.5" y="8.5" width="12" height="12" rx="1"/><path d="M15.5 8.5V4.5a1 1 0 0 0-1-1h-10a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h4"/></svg>';
    var ICON_DONE = SVG + '<path d="M4.5 12.5l5 5L19.5 7"/></svg>';
    var ours = null, theirs = null;

    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

    function build() {
      var bar = document.createElement('div');
      bar.className = 'kept-ann';
      bar.setAttribute('role', 'region');
      bar.setAttribute('aria-label', 'Offer');
      bar.innerHTML =
        '<style>' + cfg.css + '</style>' +
        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Jost:wght@500;800&display=swap">' +
        '<p class="kept-ann__text">' +
          (headline ? '<span class="kept-ann__lead">' + esc(headline) + '</span><br>' : '') +
          '\\ud83d\\udce6' + NB + 'Free shipping' + NB + 'on <u>all</u> orders<br>' +
          '<span class="kept-ann__group">\\ud83d\\udcda' + NB + '25% off 2+ books' + NB + '\\u2014 code:' + NB + '</span><wbr>' +
          '<span class="kept-ann__group"><u class="kept-ann__code">' + esc(cfg.code) + '</u>' +
            '<button type="button" class="kept-ann__copy" aria-label="Copy code ' + esc(cfg.code) + '" title="Copy code">' +
              '<span class="kept-ann__icon">' + ICON_COPY + '</span><span class="kept-ann__done">' + ICON_DONE + '</span>' +
            '</button></span>' +
        '</p>' +
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
