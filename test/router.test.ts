// Run: node --experimental-strip-types --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import handler from "../netlify/edge-functions/landing-page.ts";

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
