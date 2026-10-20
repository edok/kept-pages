# kept-pages

Serves Kept's landing pages on **go.keptcollection.com**, one page per path:

| Path | Page | Netlify site |
| --- | --- | --- |
| `/new-baby` | New baby + big siblings (catch-up a) | `cd-5cab7041bb-c09ab7` |
| `/gift-new-mom` | Gift for a new mom | `kept-lp-gift-for-new-moms-cd-fd88715920` |
| `/older-kids` | Kids past the baby stage (catch-up b) | `kept-lp-kids-past-the-baby-stage-cd-0345a20498` |
| `/new-mom` | New mom buying for herself | `kept-lp-new-mom-buying-for-herself-cd-55fbfeb0ce` |
| `/gift-older-kids` | Gift for parents of older kids | `kept-lp-gift-for-parents-of-older-kids-cd-ea3e78dfea` |
| `/look-inside` | The whole book, page by page | this repo: `public/pages/look-inside/` |

`/look-inside` isn't a design export: its 232 page images are too many to inline
in one bundle, so it's plain HTML in `public/pages/look-inside/`, rebuilt from
the "Kept look inside" canvas, and the router serves it the same way (tracking,
favicon, noindex, store fallback).

Anything else on the domain (the bare domain, typos, retired pages) redirects to
keptcollection.com and keeps its query string.

## How it works

Each page is designed in Claude Design and sent to Netlify with **Share → Export →
Send to Netlify**, which gives every page its own Netlify site. This repo is a
small router site that owns the domain:

- `netlify/edge-functions/landing-page.ts` fetches the page from its site and
  adds the tracking snippet at the top of `<head>`. Claude Design exports have
  no mobile viewport tag, so it adds one too (without it, phones show a shrunken
  desktop layout).
- `src/lps.ts` is the list of pages (path → site), plus the Meta pixel ID and
  the fallback URL.
- `src/tracking.ts` is the snippet. It loads the Meta pixel ("Kept Website Pixel",
  the same dataset as the store) and fires `PageView`. On any click to
  keptcollection.com it copies the ad params from the landing page URL
  (`utm_*`, `fbclid`, `gclid`, `ttclid`, `msclkid`, `trybe`) onto the link, adds
  `lp=<path>`, and fires a custom `LPClick` event.
- `src/bundle.ts` makes the page fast. The export inlines every photo as
  base64, about 2.2 MB of a 3.3 MB file, so nothing would show until all of it
  downloaded. The router moves each photo out to `/<path>/_img/…`, which
  `netlify/edge-functions/lp-asset.ts` serves with a year of caching. It points
  the page at Netlify Image CDN copies (AVIF/WebP, never wider than the original)
  with `srcset`, `loading="lazy"` and `decoding="async"`, and preloads the hero
  background. The page HTML drops to about 200 KB over the wire. If the export
  format ever changes and the rewrite can't apply, the page is served as exported.
- `public/_redirects` sends everything that isn't a page to the store.

The page designs themselves carry no tracking code. Changing the snippet here
changes it on every page at the next deploy.

**Never a dead end.** If a page's site can't be reached or answers with
anything but a 200, the visitor is redirected to the product page with their params.
If the function itself errors, the visitor falls through to the store redirect.

**Caching.** Netlify's CDN keeps each page for 5 minutes and ignores ad params in
the cache key. After re-exporting a design, the change is live within 5 minutes; to
see it right away, open the page with `?v=<anything>`. Every push to this repo
clears the cache.

**Search.** Pages are sent with `X-Robots-Tag: noindex`. They're paid landing pages
and shouldn't compete with keptcollection.com in search.

## Add a page

1. In Claude Design: Share → Export → Send to Netlify. Note the new site's
   `cd-…netlify.app` address. Don't rename the site: renaming breaks updating it
   in place on the next export.
2. Make sure that site is public (no team login).
3. Add a line to `LANDING_PAGES` in `src/lps.ts` and push. The page is live at
   `go.keptcollection.com/<path>`.

## Test

```sh
node --experimental-strip-types --test test/router.test.ts test/bundle.test.ts
```
