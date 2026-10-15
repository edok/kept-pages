import type { Config, Context } from "@netlify/edge-functions";
import { extractAsset } from "../../src/bundle.ts";
import { LANDING_PAGES } from "../../src/lps.ts";
import { fetchPageHtml } from "../../src/upstream.ts";

// Serves a photo that src/bundle.ts moved out of a landing page's bundle:
// /<page>/_img/<uuid>-<fingerprint>.<ext>. The fingerprint changes whenever the
// photo does, so responses can be cached for a year.
const FILE = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-[a-z0-9]+\.(jpg|png|webp|gif|avif)$/;

export default async (request: Request, context: Context) => {
  const parts = new URL(request.url).pathname.split("/").filter(Boolean);
  const slug = (context.params?.slug ?? parts[0] ?? "").toLowerCase();
  const file = context.params?.file ?? parts[2] ?? "";
  const page = LANDING_PAGES[slug];
  const match = FILE.exec(file);
  if (!page || !match) return new Response("Not found", { status: 404 });

  const html = await fetchPageHtml(slug, page.origin);
  const asset = html ? await extractAsset(html, match[1]) : null;
  if (!asset) return new Response("Not found", { status: 404, headers: { "cache-control": "no-store" } });

  return new Response(asset.bytes, {
    status: 200,
    headers: {
      "content-type": asset.mime,
      "cache-control": "public, max-age=31536000, immutable",
      "netlify-cdn-cache-control": "public, durable, max-age=31536000, immutable",
      "x-robots-tag": "noindex",
    },
  });
};

export const config: Config = {
  path: "/:slug/_img/:file",
  cache: "manual",
};
