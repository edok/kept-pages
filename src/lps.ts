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
  "gift-new-mom": {
    origin: "https://kept-lp-gift-for-new-moms-cd-fd88715920.netlify.app",
    name: "Gift for a new mom",
    videos: ["/media/gift-new-mom/hero-4057d3e3.mp4"],
  },
  "older-kids": {
    origin: "https://kept-lp-kids-past-the-baby-stage-cd-0345a20498.netlify.app",
    name: "Kids past the baby stage (catch-up b)",
  },
  "new-mom": {
    origin: "https://kept-lp-new-mom-buying-for-herself-cd-55fbfeb0ce.netlify.app",
    name: "New mom buying for herself",
    // Same pregnant-mom clip as the gift page.
    videos: ["/media/gift-new-mom/hero-4057d3e3.mp4"],
  },
  "gift-older-kids": {
    origin: "https://kept-lp-gift-for-parents-of-older-kids-cd-ea3e78dfea.netlify.app",
    name: "Gift for parents of older kids",
  },
  // The whole book, page by page (linked from the product page's exit pop-up).
  // Not a design export: 232 page images are too many to inline, so the page is
  // plain HTML kept in this repo (public/pages/look-inside/) and the router
  // serves it like any other page. Rebuilt from the "Kept look inside" canvas.
  "look-inside": {
    origin: "https://go.keptcollection.com/pages/look-inside",
    name: "Look inside (flip-through)",
  },
};

// Where a visitor goes if a page can't be loaded, so an ad click never dead-ends.
export const STORE_FALLBACK = "https://keptcollection.com/products/childhood-a-history";

// "Kept Website Pixel" — the same Meta dataset that runs on keptcollection.com.
export const META_PIXEL_ID = "2658218640937959";
