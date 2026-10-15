// Run: node --experimental-strip-types --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { extractAsset, imageSize, optimizeBundle } from "../src/bundle.ts";
import landingPage from "../netlify/edge-functions/landing-page.ts";
import lpAsset from "../netlify/edge-functions/lp-asset.ts";

const A = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa"; // photo in an <img>
const B = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb"; // hero background
const LOGO = "cccccccc-3333-4333-8333-cccccccccccc"; // tiny png, stays inline
const FONT = "dddddddd-4444-4444-8444-dddddddddddd";

function jpeg(w: number, h: number, size: number): Uint8Array {
  const b = new Uint8Array(size);
  b.set([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10], 0); // SOI + APP0 (len 16)
  b.set([0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255], 20); // SOF0
  for (let i = 40; i < size; i++) b[i] = (i * 7) & 255;
  return b;
}
function png(w: number, h: number, size: number): Uint8Array {
  const b = new Uint8Array(size);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 0);
  new DataView(b.buffer).setUint32(16, w);
  new DataView(b.buffer).setUint32(20, h);
  return b;
}
const b64 = (u: Uint8Array) => Buffer.from(u).toString("base64");

const photoA = jpeg(1200, 1200, 60_000);
const heroB = jpeg(1200, 800, 90_000);
const manifest = {
  [A]: { mime: "image/jpeg", compressed: false, data: b64(photoA) },
  [B]: { mime: "image/jpeg", compressed: false, data: b64(heroB) },
  [LOGO]: { mime: "image/png", compressed: false, data: b64(png(680, 462, 2000)) },
  [FONT]: { mime: "font/woff2", compressed: false, data: b64(new Uint8Array(3000)) },
};
const templateHtml =
  `<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8"><title>LP</title>` +
  `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=EB+Garamond">` +
  `<style>@font-face{src:url("${FONT}")} .hero{min-height:520px;background:url("${B}") center/cover no-repeat}</style></head>` +
  `<body><a href="https://keptcollection.com/"><img src="${LOGO}" alt="kept" style="width:120px"></a>` +
  `<section class="hero"></section><img src="${A}" alt="Forest" style="width:100%"></body></html>`;
const loader = `<script>document.addEventListener('DOMContentLoaded', async function(){ document.querySelector('script[type="__bundler/manifest"]'); });</script>`;
const BUNDLE =
  `<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n<title>LP</title>\n</head>\n<body>\n${loader}\n` +
  `<script type="__bundler/manifest">${JSON.stringify(manifest)}</script>\n` +
  `<script type="__bundler/ext_resources">[]</script>\n` +
  `<script type="__bundler/template">${JSON.stringify(templateHtml).replace(/<\//g, "<\\u002F")}</script>\n</body>\n</html>`;

function readScript(html: string, type: string) {
  const tag = `<script type="${type}">`;
  const s = html.lastIndexOf(tag) + tag.length;
  return JSON.parse(html.slice(s, html.indexOf("</script>", s)));
}

// What the export's loader does: swap every uuid still in the manifest for a blob URL.
function runLoader(html: string): string {
  const man = readScript(html, "__bundler/manifest");
  let tpl = readScript(html, "__bundler/template") as string;
  for (const uuid of Object.keys(man)) tpl = tpl.split(uuid).join(`blob:test/${uuid.slice(0, 4)}`);
  return tpl;
}

test("reads sizes from JPEG and PNG headers", () => {
  assert.deepEqual(imageSize(photoA), { w: 1200, h: 1200 });
  assert.deepEqual(imageSize(png(680, 462, 100)), { w: 680, h: 462 });
});

test("moves photos out of the bundle and leaves tiny assets inline", () => {
  const r = optimizeBundle(BUNDLE, { slug: "new-baby", origin: "https://go.keptcollection.com" });
  assert.ok(r);
  assert.equal(r.moved, 2);
  const man = readScript(r.html, "__bundler/manifest");
  assert.deepEqual(Object.keys(man).sort(), [LOGO, FONT].sort());
  assert.ok(r.html.length < BUNDLE.length / 5, "bundle should shrink a lot");
  assert.ok(!/<\/(?!script>)/.test(r.html.slice(r.html.lastIndexOf('<script type="__bundler/template">') + 34).replace(/<\/script>\n<\/body>\n<\/html>$/, "")), "template must not contain a raw </");
});

test("after the loader runs, images are lazy, responsive and point at the image CDN", () => {
  const r = optimizeBundle(BUNDLE, { slug: "new-baby", origin: "https://go.keptcollection.com" })!;
  const page = runLoader(r.html);
  const img = page.match(/<img[^>]*alt="Forest"[^>]*>/)![0];
  const src = encodeURIComponent(`https://go.keptcollection.com/new-baby/_img/${A}-`);
  assert.ok(img.includes(`src="/.netlify/images?url=${src}`), img);
  assert.match(img, /&amp;w=800"/);
  assert.match(img, / 1200w"/);
  assert.ok(!img.includes("1600w"), "never wider than the original");
  assert.match(img, /loading="lazy"/);
  assert.match(img, /decoding="async"/);
  assert.match(img, /sizes="auto, \(max-width: 760px\) 100vw, 600px"/);
  // The logo stays an inline blob, not lazy.
  assert.match(page, /<img src="blob:test\/cccc" alt="kept"/);
  // The hero background is a full-size optimized copy, and it's preloaded.
  const heroUrl = `/.netlify/images?url=${encodeURIComponent(`https://go.keptcollection.com/new-baby/_img/${B}-`)}`;
  assert.ok(page.includes(`background:url("${heroUrl}`), page);
  assert.ok(r.preloads.includes(`href="${heroUrl}`) && r.preloads.includes('fetchpriority="high"'));
  // Fonts still resolve through the loader.
  assert.match(page, /@font-face\{src:url\("blob:test\/dddd"\)\}/);
  assert.ok(!page.includes("KEPTIMGTOKEN"));
});

test("extractAsset returns the original bytes", async () => {
  const asset = await extractAsset(BUNDLE, A);
  assert.equal(asset?.mime, "image/jpeg");
  assert.deepEqual(asset?.bytes, photoA);
  assert.equal(await extractAsset(BUNDLE, FONT), null, "only images are served");
  assert.equal(await extractAsset(BUNDLE, "eeeeeeee-5555-4555-8555-eeeeeeeeeeee"), null);
});

test("edge functions: page is optimized; photo URL serves bytes with a year of caching", async () => {
  globalThis.fetch = (async () => new Response(BUNDLE, { status: 200 })) as typeof fetch;
  const pageRes = (await landingPage(new Request("https://go.keptcollection.com/new-baby?utm_source=meta"), { params: { slug: "new-baby" } } as any)) as Response;
  const html = await pageRes.text();
  assert.match(html, /<head><meta name="viewport"[^>]*><link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">/);
  assert.match(html, /<link rel="preload" as="image"/);

  const page = runLoader(html);
  const file = decodeURIComponent(page.match(/url=([^&"]+)&amp;w=800/)![1]).split("/").pop()!;
  const assetRes = (await lpAsset(new Request(`https://go.keptcollection.com/new-baby/_img/${file}`), { params: { slug: "new-baby", file } } as any)) as Response;
  assert.equal(assetRes.status, 200);
  assert.equal(assetRes.headers.get("content-type"), "image/jpeg");
  assert.match(assetRes.headers.get("cache-control")!, /immutable/);
  assert.deepEqual(new Uint8Array(await assetRes.arrayBuffer()), photoA);

  const bad = (await lpAsset(new Request("https://go.keptcollection.com/new-baby/_img/nope.jpg"), { params: { slug: "new-baby", file: "nope.jpg" } } as any)) as Response;
  assert.equal(bad.status, 404);
});
