import type { Config, Context } from "@netlify/edge-functions";
import { LANDING_PAGES, META_PIXEL_ID, STORE_FALLBACK } from "../../src/lps.ts";
import { injectIntoHead, trackingSnippet } from "../../src/tracking.ts";

const VIEWPORT_META = '<meta name="viewport" content="width=device-width, initial-scale=1">';

// Serves go.keptcollection.com/<page> from that page's Netlify site, with the
// tracking snippet added. Paths that aren't a landing page fall through to
// public/_redirects, which sends them to the store.
export default async (request: Request, context: Context) => {
  const firstSegment = new URL(request.url).pathname.split("/").filter(Boolean)[0] ?? "";
  const slug = (context.params?.slug ?? firstSegment).toLowerCase();
  const page = LANDING_PAGES[slug];
  if (!page) return;

  let html: string | null = null;
  try {
    const upstream = await fetch(page.origin + "/", {
      redirect: "manual",
      headers: { accept: "text/html" },
    });
    if (upstream.status === 200) {
      html = await upstream.text();
    } else {
      console.error(`[lp] ${slug}: ${page.origin} answered ${upstream.status}`);
    }
  } catch (err) {
    console.error(`[lp] ${slug}: could not reach ${page.origin}`, err);
  }

  if (html === null) {
    // Never strand an ad click: send them to the product page, params intact.
    const to = new URL(STORE_FALLBACK);
    new URL(request.url).searchParams.forEach((v, k) => to.searchParams.set(k, v));
    return new Response(null, {
      status: 302,
      headers: { location: to.toString(), "cache-control": "no-store" },
    });
  }

  // Claude Design exports ship without a viewport tag, so phones would render
  // the page as a shrunken 980px desktop layout. Add one unless the page has it.
  const hasViewport = /<meta[^>]+name=["']?viewport/i.test(html.slice(0, 20000));
  const extras = (hasViewport ? "" : VIEWPORT_META) + trackingSnippet({ pixelId: META_PIXEL_ID, lp: slug });
  const body = injectIntoHead(html, extras);
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Browsers always revalidate; Netlify's CDN keeps a copy for 5 minutes
      // and ignores ad params (fbclid etc.) in the cache key. Add ?v=<anything>
      // to bypass the cached copy right after a design update.
      "cache-control": "public, max-age=0, must-revalidate",
      "netlify-cdn-cache-control": "public, durable, s-maxage=300, stale-while-revalidate=86400",
      "netlify-vary": "query=v",
      // Paid landing pages: keep them out of search results.
      "x-robots-tag": "noindex",
    },
  });
};

export const config: Config = {
  path: ["/:slug", "/:slug/"],
  excludedPath: ["/robots.txt", "/favicon.ico"],
  cache: "manual",
  // If this function ever errors, skip it: _redirects sends the visitor to the store.
  onError: "bypass",
};
