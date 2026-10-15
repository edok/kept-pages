// Kept landing pages served on go.keptcollection.com.
//
// One entry per page. The key is the path people land on
// (go.keptcollection.com/<key>); `origin` is the Netlify site that the
// Claude Design export for that page was imported into.
//
// To add a page: import the design to Netlify, make sure that site is public
// (no team login), then add a line here and push. See README.md.

export type LandingPage = {
  origin: string; // e.g. "https://cd-xxxxxxxxxx-xxxxxx.netlify.app"
  name: string; // human label, for logs and the README
  // Static copies of the page's videos, in the order they appear on the page,
  // usually files under public/media/. Each replaces the copy the design
  // export inlines (see src/bundle.ts).
  videos?: string[];
};

export const LANDING_PAGES: Record<string, LandingPage> = {
  "new-baby": {
    origin: "https://cd-5cab7041bb-c09ab7.netlify.app",
    name: "New baby + big siblings (catch-up a)",
  },
};

// Where a visitor goes if a page can't be loaded, so an ad click never dead-ends.
export const STORE_FALLBACK = "https://keptcollection.com/products/childhood-a-history";

// "Kept Website Pixel" — the same Meta dataset that runs on keptcollection.com.
export const META_PIXEL_ID = "2658218640937959";
