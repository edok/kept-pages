// Claude Design's "Send to Netlify" export is one self-contained HTML file:
// a small loader script, a JSON manifest of every asset as base64
// (<script type="__bundler/manifest">), and the page itself as a JSON string
// (<script type="__bundler/template">) that points at assets by uuid. On
// DOMContentLoaded the loader turns each manifest entry into a blob: URL,
// swaps the uuids in the template for those URLs, and replaces the document.
//
// That means every photo has to download before anything shows. This module
// rewrites the bundle so photos are ordinary image URLs instead:
//   - image entries leave the manifest and are served by lp-asset.ts at
//     /<page>/_img/<uuid>-<fingerprint>.<ext>
//   - the template points at Netlify Image CDN versions of those URLs, which
//     come back as AVIF/WebP, never wider than the original
//   - <img> tags get srcset/sizes, loading="lazy" and decoding="async"
//   - CSS background images (the hero) keep full size and are preloaded
// The loader only swaps uuids that are still in the manifest, so the rewritten
// URLs pass through it untouched.

const MANIFEST_TAG = '<script type="__bundler/manifest">';
const TEMPLATE_TAG = '<script type="__bundler/template">';
const IMAGE_MIME = /^image\/(jpeg|png|webp|gif|avif)$/i;
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" };
// Tiny images (the logo) stay inline: not worth a separate request.
const INLINE_MAX_BYTES = 24 * 1024;
// Candidate widths for srcset; anything wider than the original is dropped.
const WIDTHS = [320, 480, 640, 800, 1200, 1600];

type ManifestEntry = { mime: string; compressed?: boolean; data: string };

export type BundleResult = { html: string; preloads: string; moved: number };

function scriptBody(html: string, tag: string): { start: number; end: number } | null {
  const at = html.lastIndexOf(tag);
  if (at < 0) return null;
  const start = at + tag.length;
  const end = html.indexOf("</script>", start);
  return end < 0 ? null : { start, end };
}

// Cheap, stable fingerprint of an asset's base64 so a changed image gets a new URL.
export function fingerprint(b64: string): string {
  let h = 0x811c9dc5;
  const step = Math.max(1, Math.floor(b64.length / 4096));
  for (let i = 0; i < b64.length; i += step) {
    h ^= b64.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return (h >>> 0).toString(36) + b64.length.toString(36);
}

function decodeBase64(b64: string, maxBytes = Infinity): Uint8Array {
  const chars = Number.isFinite(maxBytes) ? b64.slice(0, Math.ceil(maxBytes / 3) * 4) : b64;
  const bin = atob(chars);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Width/height from a PNG or JPEG header (null if it can't tell).
export function imageSize(bytes: Uint8Array): { w: number; h: number } | null {
  if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { w: dv.getUint32(16), h: dv.getUint32(20) };
  }
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let i = 2;
    while (i + 9 < bytes.length) {
      if (bytes[i] !== 0xff) { i++; continue; }
      const marker = bytes[i + 1];
      const len = (bytes[i + 2] << 8) | bytes[i + 3];
      const isSOF = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isSOF) return { h: (bytes[i + 5] << 8) | bytes[i + 6], w: (bytes[i + 7] << 8) | bytes[i + 8] };
      i += 2 + len;
    }
  }
  return null;
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

export function optimizeBundle(html: string, opts: { slug: string; origin: string; videos?: string[] }): BundleResult | null {
  const m = scriptBody(html, MANIFEST_TAG);
  const t = scriptBody(html, TEMPLATE_TAG);
  if (!m || !t || t.start < m.end) return null;

  const manifest = JSON.parse(html.slice(m.start, m.end)) as Record<string, ManifestEntry>;
  let template = JSON.parse(html.slice(t.start, t.end)) as string;

  const cdn = (src: string, w?: number) =>
    `/.netlify/images?url=${encodeURIComponent(src)}${w ? `&w=${w}` : ""}`;

  let moved = 0;
  const preloadHrefs: string[] = [];
  const tokens: Array<[string, string]> = [];

  // Videos: swap each inline video for the static copy configured for this page
  // (src/lps.ts `videos`, in the order they appear on the page). Static files
  // support the byte-range requests phones need to stream video. A video with
  // no configured copy stays inline.
  const videoUuids = Object.keys(manifest)
    .filter((uuid) => /^video\//i.test(manifest[uuid]?.mime ?? "") && template.includes(uuid))
    .sort((a, b) => template.indexOf(a) - template.indexOf(b));
  videoUuids.forEach((uuid, i) => {
    const url = opts.videos?.[i];
    if (!url) return;
    template = template.split(uuid).join(url);
    delete manifest[uuid];
    moved++;
  });

  for (const [uuid, entry] of Object.entries(manifest)) {
    if (!entry || typeof entry.data !== "string" || entry.compressed) continue;
    if (!IMAGE_MIME.test(entry.mime)) continue;
    if (entry.data.length * 0.75 <= INLINE_MAX_BYTES) continue;
    if (!template.includes(uuid)) continue;

    const ext = EXT[entry.mime.toLowerCase()] ?? "img";
    // Build URLs around a placeholder, not the uuid itself, so the catch-all
    // uuid replacement below can't rewrite the URLs it just wrote.
    const token = `KEPTIMGTOKEN${moved}X`;
    tokens.push([token, uuid]);
    const src = `${opts.origin}/${opts.slug}/_img/${token}-${fingerprint(entry.data)}.${ext}`;
    const size = imageSize(decodeBase64(entry.data, 128 * 1024));
    const natural = size?.w ?? 0;
    const widths = natural ? WIDTHS.filter((w) => w < natural) : [];

    // <img src="uuid" ...> → responsive, lazy image.
    template = template.replace(new RegExp(`<img\\b[^>]*\\bsrc="${uuid}"[^>]*>`, "g"), (tag) => {
      const srcset = [...widths.map((w) => `${cdn(src, w)} ${w}w`), ...(natural ? [`${cdn(src)} ${natural}w`] : [])].join(", ");
      const best = widths.filter((w) => w <= 1200).pop();
      let out = tag.replace(`src="${uuid}"`, `src="${escapeAttr(cdn(src, best))}"` + (srcset ? ` srcset="${escapeAttr(srcset)}" sizes="auto, (max-width: 760px) 100vw, 600px"` : ""));
      if (!/\sloading=/.test(out)) out = out.replace(/\s*\/?>$/, ' loading="lazy">');
      if (!/\sdecoding=/.test(out)) out = out.replace(/\s*\/?>$/, ' decoding="async">');
      return out;
    });

    // CSS url("uuid") (backgrounds such as the hero) → full-size optimized copy, preloaded.
    if (new RegExp(`url\\((["']?)${uuid}\\1\\)`).test(template)) {
      const bg = cdn(src);
      template = template.replace(new RegExp(`url\\((["']?)${uuid}\\1\\)`, "g"), `url("${bg}")`);
      preloadHrefs.push(bg);
    }

    // <video poster="uuid"> → optimized full-size copy, preloaded (it's the first paint of a video hero).
    if (template.includes(`poster="${uuid}"`)) {
      const poster = cdn(src);
      template = template.split(`poster="${uuid}"`).join(`poster="${escapeAttr(poster)}"`);
      preloadHrefs.unshift(poster);
    }

    // Any other reference (inline style attribute, script) gets the plain URL.
    template = template.split(uuid).join(src);

    delete manifest[uuid];
    moved++;
  }

  if (moved === 0) return null;

  const restore = (s: string) => tokens.reduce((acc, [token, uuid]) => acc.split(token).join(uuid), s);
  template = restore(template);
  const restoredPreloads = preloadHrefs.map(restore);

  const json = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");
  const out = html.slice(0, m.start) + json(manifest) + html.slice(m.end, t.start) + json(template) + html.slice(t.end);
  const preloads = restoredPreloads.slice(0, 2)
    .map((h) => `<link rel="preload" as="image" href="${escapeAttr(h)}" fetchpriority="high">`).join("");
  return { html: out, preloads, moved };
}

// Pull one image out of a bundle for lp-asset.ts.
export async function extractAsset(html: string, uuid: string): Promise<{ mime: string; bytes: Uint8Array } | null> {
  const m = scriptBody(html, MANIFEST_TAG);
  if (!m) return null;
  const key = `"${uuid}":`;
  const at = html.indexOf(key, m.start);
  if (at < 0 || at > m.end) return null;
  const open = html.indexOf("{", at + key.length);
  const close = html.indexOf("}", html.indexOf('"data":"', open) + 8);
  if (open < 0 || close < 0 || close > m.end) return null;
  const entry = JSON.parse(html.slice(open, close + 1)) as ManifestEntry;
  if (!IMAGE_MIME.test(entry.mime)) return null;
  let bytes = decodeBase64(entry.data);
  if (entry.compressed) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  }
  return { mime: entry.mime, bytes };
}
