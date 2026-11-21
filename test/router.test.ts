// Run: node --experimental-strip-types --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import handler from "../netlify/edge-functions/landing-page.ts";
import { ANN_BAR, SALE_TEST, BAR_TEST } from "../src/ann-bar.ts";

const LP_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>LP</title></head><body><a href="https://keptcollection.com/products/childhood-a-history">Start</a></body></html>`;

function mockFetch(status: number, body = LP_HTML) {
  globalThis.fetch = (async () => new Response(status === 200 ? body : null, { status, headers: status === 301 ? { location: "https://go.keptcollection.com/" } : {} })) as typeof fetch;
}
const ctx = (slug?: string) => ({ params: slug === undefined ? {} : { slug } }) as any;

test("serves a known page with the pixel injected at the top of <head>", async () => {
  mockFetch(200);
  const res = await handler(new Request("https://go.keptcollection.com/new-baby?utm_source=meta&fbclid=abc"), ctx("new-baby"));
  assert.ok(res instanceof Response);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<head><meta name="viewport" content="width=device-width, initial-scale=1"><script>\/\* Kept LP tracking/);
  assert.match(html, /fbq\('init', cfg\.pixelId\)/);
  assert.match(html, /\{"pixelId":"2658218640937959","lp":"new-baby","fallback":"https:\/\/keptcollection\.com\/products\/childhood-a-history","guard":\{/);
  assert.ok(html.indexOf("Kept LP tracking") < html.indexOf("<meta charset"));
  assert.equal(res.headers.get("x-robots-tag"), "noindex");
  assert.equal(res.headers.get("netlify-vary"), "query=v");
});

test("removes the Powered by Netlify badge script the design's site appends", async () => {
  const withBadge = LP_HTML + `<script async src="/.netlify/scripts/hud?variant=public" data-nf-variant="public" data-netlify-site-id="x" data-app-host="app.netlify.com" data-account-tier="personal"></script> `;
  mockFetch(200, withBadge);
  const res = (await handler(new Request("https://go.keptcollection.com/new-baby"), ctx("new-baby"))) as Response;
  const html = await res.text();
  assert.ok(!html.includes("/.netlify/scripts/hud"));
  assert.ok(html.includes("</body></html>"));
});

test("doesn't add a second viewport tag when the page already has one", async () => {
  mockFetch(200, LP_HTML.replace("<title>", '<meta name="viewport" content="width=device-width"><title>'));
  const res = (await handler(new Request("https://go.keptcollection.com/new-baby"), ctx("new-baby"))) as Response;
  const html = await res.text();
  assert.equal(html.match(/<meta name="viewport"/g)?.length, 1);
});

test("adds the Kept favicon unless the page has its own", async () => {
  mockFetch(200);
  let res = (await handler(new Request("https://go.keptcollection.com/new-baby"), ctx("new-baby"))) as Response;
  let html = await res.text();
  assert.match(html, /<link rel="icon" type="image\/png" href="\/favicon.png">/);
  assert.match(html, /function ensureFavicon\(\)/);

  mockFetch(200, LP_HTML.replace("<title>", '<link rel="icon" href="/own.png"><title>'));
  res = (await handler(new Request("https://go.keptcollection.com/new-baby"), ctx("new-baby"))) as Response;
  html = await res.text();
  assert.ok(!html.includes('href="/favicon.png">'));
});

test("slug is case-insensitive and falls back to the path when params are missing", async () => {
  mockFetch(200);
  const res = await handler(new Request("https://go.keptcollection.com/New-Baby/"), ctx());
  assert.equal((res as Response).status, 200);
});

test("unknown paths fall through to _redirects", async () => {
  mockFetch(200);
  const res = await handler(new Request("https://go.keptcollection.com/nope"), ctx("nope"));
  assert.equal(res, undefined);
});

test("upstream redirect or error sends the click to the product page with params", async () => {
  for (const status of [301, 404, 500]) {
    mockFetch(status);
    const res = (await handler(new Request("https://go.keptcollection.com/new-baby?utm_campaign=q4&trybe=ab12cd34"), ctx("new-baby"))) as Response;
    assert.equal(res.status, 302);
    const loc = new URL(res.headers.get("location")!);
    assert.equal(loc.origin + loc.pathname, "https://keptcollection.com/products/childhood-a-history");
    assert.equal(loc.searchParams.get("utm_campaign"), "q4");
    assert.equal(loc.searchParams.get("trybe"), "ab12cd34");
    assert.equal(res.headers.get("cache-control"), "no-store");
  }
});

test("network failure also falls back to the product page", async () => {
  globalThis.fetch = (async () => { throw new Error("boom"); }) as typeof fetch;
  const res = (await handler(new Request("https://go.keptcollection.com/new-baby"), ctx("new-baby"))) as Response;
  assert.equal(res.status, 302);
});

test("look-inside is served from the static copy in this repo, tracking added", async () => {
  let asked = "";
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    asked = String(input);
    return new Response(LP_HTML, { status: 200 });
  }) as typeof fetch;
  const res = (await handler(new Request("https://go.keptcollection.com/look-inside?utm_source=zigpoll"), ctx("look-inside"))) as Response;
  assert.equal(res.status, 200);
  assert.equal(asked, "https://go.keptcollection.com/pages/look-inside/");
  const html = await res.text();
  assert.match(html, /\{"pixelId":"2658218640937959","lp":"look-inside","fallback":"https:\/\/keptcollection\.com\/products\/childhood-a-history"/);
});

test("adds the error guard: LPError, LPBlank, the store fallback and ?lpdebug", async () => {
  mockFetch(200);
  const res = (await handler(new Request("https://go.keptcollection.com/older-kids"), ctx("older-kids"))) as Response;
  const html = await res.text();
  assert.match(html, /trackCustom', name, data\)/);
  assert.match(html, /send\('LPError'/);
  assert.match(html, /send\('LPBlank'/);
  assert.match(html, /params\.has\('lpdebug'\)/);
  assert.match(html, /"guard":\{"afterErrorMs":4000,"stuckMs":20000,"pollMs":2000,"maxErrors":3\}/);
  // The guard sits inside the tracking script, so it's in place before the page's own scripts run.
  assert.ok(html.indexOf("function guard(g)") < html.indexOf("<meta charset"));
});

test("adds the store's offer bar (dated first line, code, copy icon) to every page", async () => {
  mockFetch(200);
  const res = (await handler(new Request("https://go.keptcollection.com/older-kids"), ctx("older-kids"))) as Response;
  const html = await res.text();
  assert.match(html, /<script>\/\* Kept LP offer bar/);
  assert.ok(html.indexOf("Kept LP tracking") < html.indexOf("Kept LP offer bar"));
  assert.ok(html.includes('"lp":"older-kids"'));
  assert.ok(html.includes('"code":"KEPT25"'));
  for (const h of ANN_BAR.headlines) assert.ok(html.includes(JSON.stringify(h.text)), h.text);
  assert.match(html, /kept-ann__copy/);
  // The config is embedded in a <script>: no raw "<" may end up inside it.
  const cfg = html.slice(html.indexOf("Kept LP offer bar"));
  assert.ok(!/\}\)\(\{[^\n]*<\/style>/.test(cfg));
});

test("offer bar headlines are in date order and only the last one has no end", () => {
  const hs = ANN_BAR.headlines;
  assert.ok(hs.length >= 1);
  assert.equal(hs[hs.length - 1].until, undefined);
  for (let i = 0; i < hs.length - 1; i++) {
    assert.ok(hs[i].until && !Number.isNaN(Date.parse(hs[i].until!)), `headline ${i} needs a valid until`);
    if (i > 0) assert.ok(Date.parse(hs[i].until!) > Date.parse(hs[i - 1].until!));
  }
});

test("sale-name test off: every visitor gets the dated line, with no cookie, store param or split events", async () => {
  assert.equal(SALE_TEST, null);
  mockFetch(200);
  const res = (await handler(new Request("https://go.keptcollection.com/gift-new-mom"), ctx("gift-new-mom"))) as Response;
  const html = await res.text();
  assert.ok(html.includes('"test":null'));
  assert.ok(html.includes("Black Friday Sale is Live!"));
  assert.ok(!html.includes("Black Friday Sale is here!"));
  assert.ok(!html.includes("Holiday Sale is Live!"));
  // The switch code stays in place for the next test, but does nothing while test is null.
  assert.match(html, /if \(t && now >= Date\.parse\(t\.from\)\)/);
});

test("bar test off: every visitor gets the Tidy bar, with no cookie, store param or split events", async () => {
  assert.equal(BAR_TEST, null);
  mockFetch(200);
  const res = (await handler(new Request("https://go.keptcollection.com/new-mom"), ctx("new-mom"))) as Response;
  const html = await res.text();
  // Just the offer bar's script (the page design has its own fonts and weights).
  const start = html.indexOf("Kept LP offer bar");
  assert.ok(start > 0);
  const bar = html.slice(start, html.indexOf("</script>", start));
  assert.ok(bar.includes('"barTest":null'));
  // Tidy, the Nov 7 winner, is the bar itself now: Jost Bold first line,
  // "with code KEPT25", smoother type, the narrow-phone size step.
  assert.match(bar, /\.kept-ann \.kept-ann__lead\{font-weight:700!important\}/);
  assert.ok(!bar.includes("font-weight:800"));
  assert.match(bar, /\.kept-ann\{[^}]*-webkit-font-smoothing:antialiased/);
  // Phones: 10px sides, as in the store's bar, so the third line fits on a 375px iPhone.
  assert.match(bar, /\.kept-ann\{[^}]*padding:10px;/);
  // Type 1px bigger than the Nov 7 Tidy bar (Nov 13, matching the store): phones 14px at .12em, 13.5px under 390px,
  // 13px at .11em under 375px, desktop 13px; three lines at every width.
  assert.match(bar, /font-size:14px!important;letter-spacing:\.12em!important;/);
  assert.match(bar, /@media \(max-width:389px\)\{\.kept-ann \.kept-ann__text\{font-size:13\.5px!important\}\}/);
  assert.match(bar, /@media \(max-width:374px\)\{\.kept-ann \.kept-ann__text\{font-size:13px!important;letter-spacing:\.11em!important\}\}/);
  assert.match(bar, /@media \(min-width:641px\)\{[^}]*\}\.kept-ann \.kept-ann__text\{font-size:13px!important;letter-spacing:\.16em!important/);
  assert.ok(bar.includes("25% off 2+ books' + NB + 'with code' + NB"));
  assert.ok(!bar.includes("\\u2014 code:"));
  assert.ok(bar.includes("family=Jost:wght@500;700&display=swap"));
  // Serif is gone.
  assert.ok(!/kept-ann--s|kept-ann__head|Garamond|"sentence"/.test(bar));
  // The switch code stays in place for the next test, but does nothing while barTest is null.
  assert.match(bar, /if \(bt && now >= Date\.parse\(bt\.from\)\)/);
  assert.match(html, /'LPBarClick_' \+ window\.__keptBarArm/);
});
