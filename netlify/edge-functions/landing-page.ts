import type { Config, Context } from "@netlify/edge-functions";
import { annBarSnippet } from "../../src/ann-bar.ts";
import { optimizeBundle, preloadReact } from "../../src/bundle.ts";
import { LANDING_PAGES, META_PIXEL_ID, STORE_FALLBACK } from "../../src/lps.ts";
import { injectIntoHead, trackingSnippet } from "../../src/tracking.ts";
import { fetchPageHtml } from "../../src/upstream.ts";

const VIEWPORT_META = '<meta name="viewport" content="width=device-width, initial-scale=1">';
const FONT_PRECONNECT =
  '<link rel="preconnect" href="https://fonts.googleapis.com">' +
  '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>';
// The Kept "k" from the store (public/favicon.png), so every page has a tab icon.
const FAVICON =
  '<link rel="icon" type="image/png" href="/favicon.png">' +
  '<link rel="apple-touch-icon" href="/favicon.png">';

// Netlify appends a "Powered by Netlify" badge script to pages on each design's
// own site (Project configuration > General > Powered by Netlify badge). It has
// no place on a Kept page, so drop it here rather than toggling every project.
// It sits at the very end of the HTML, so only the tail is searched.
function stripNetlifyBadge(html: string): string {
  const tailStart = Math.max(0, html.length - 4000);
  const tail = html.slice(tailStart).replace(/<script\b[^>]*\/\.netlify\/scripts\/hud[^>]*>\s*<\/script>/gi, "");
  return html.slice(0, tailStart) + tail;
}

// Serves go.keptcollection.com/<page> from that page's Netlify site, with the
// tracking snippet added and photos split out of the bundle (see src/bundle.ts).
// Paths that aren't a landing page fall through to public/_redirects, which
// sends them to the store.
export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  const firstSegment = url.pathname.split("/").filter(Boolean)[0] ?? "";
  const slug = (context.params?.slug ?? firstSegment).toLowerCase();
  const page = LANDING_PAGES[slug];
  if (!page) return;

  const html = await fetchPageHtml(slug, page.origin);
  if (html === null) {
    // Never strand an ad click: send them to the product page, params intact.
    const to = new URL(STORE_FALLBACK);
    url.searchParams.forEach((v, k) => to.searchParams.set(k, v));
    return new Response(null, {
      status: 302,
      headers: { location: to.toString(), "cache-control": "no-store" },
    });
  }

  let body = stripNetlifyBadge(html);
  let preloads = "";
  try {
    const optimized = optimizeBundle(body, { slug, origin: url.origin, videos: page.videos });
    if (optimized) {
      body = optimized.html;
      preloads = optimized.preloads;
    }
  } catch (err) {
    // A bundle format we don't recognize: serve it as exported (heavier, but whole).
    console.error(`[lp] ${slug}: could not optimize bundle`, err);
  }
  try {
    // Load React before the page's scripts so they can't race it (see src/bundle.ts).
    body = preloadReact(body) ?? body;
  } catch (err) {
    console.error(`[lp] ${slug}: could not move React ahead of the page scripts`, err);
  }

  // Claude Design exports ship without a viewport tag, so phones would render
  // the page as a shrunken 980px desktop layout. Add one unless the page has it.
  const hasViewport = /<meta[^>]+name=["']?viewport/i.test(body.slice(0, 20000));
  const usesGoogleFonts = body.includes("fonts.googleapis.com");
  // Design exports don't carry a favicon either. Use the store's unless the page has one.
  const hasIcon = /<link[^>]+rel=["']?[^"'>]*\bicon\b/i.test(body.slice(0, 20000));
  const extras =
    (hasViewport ? "" : VIEWPORT_META) +
    (usesGoogleFonts ? FONT_PRECONNECT : "") +
    preloads +
    trackingSnippet({ pixelId: META_PIXEL_ID, lp: slug, fallback: STORE_FALLBACK }) +
    // The store's offer bar in place of the design's (see src/ann-bar.ts).
    annBarSnippet({ lp: slug }) +
    (hasIcon ? "" : FAVICON);

  return new Response(injectIntoHead(body, extras), {
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
  excludedPath: ["/robots.txt", "/favicon.ico", "/favicon.png"],
  cache: "manual",
  // If this function ever errors, skip it: _redirects sends the visitor to the store.
  onError: "bypass",
};
