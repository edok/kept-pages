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
  assert.match(html, /<head><script>\/\* Kept LP tracking/);
  assert.match(html, /fbq\('init', cfg\.pixelId\)/);
  assert.match(html, /\{"pixelId":"2658218640937959","lp":"new-baby"\}/);
  assert.ok(html.indexOf("Kept LP tracking") < html.indexOf("<meta charset"));
  assert.equal(res.headers.get("x-robots-tag"), "noindex");
  assert.equal(res.headers.get("netlify-vary"), "query=v");
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
