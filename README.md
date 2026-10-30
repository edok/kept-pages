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
- `src/ann-bar.ts` is the offer bar at the top of every page: the same three
  lines, type and copy icon as the announcement bar on keptcollection.com. It
  hides the bar the design drew (the one holding the code) and puts this one in
  its place, so a wording change is one edit in `ANN_BAR` and reaches every page,
  look-inside included. The first line is listed by date and switches on its
  own (e.g. "Fall sale ends soon!" until midnight Oct 31 ET, then "Holiday Sale
  is Live!"). The icon only copies the code (the shopper still pastes it and
  hits Apply at checkout); each copy fires a custom `LPCopyCode` pixel event.
- `public/_redirects` sends everything that isn't a page to the store.

The page designs themselves carry no tracking code. Changing the snippet here
changes it on every page at the next deploy.

**Never a dead end.** If a page's site can't be reached or answers with
anything but a 200, the visitor is redirected to the product page with their params.
If the function itself errors, the visitor falls through to the store redirect.

**Errors and blank pages.** The tracking snippet also guards the page in the
visitor's browser (`guard()` in `src/tracking.ts`):

- Every script error is sent to the pixel as a custom `LPError` event
  (`lp`, a short message, and whether it was an error or a failed promise),
  at most 3 per page view. In Events Manager it sits next to `LPClick`.
- The export draws script errors in a red box at the bottom of the page. The
  guard hides it, since shoppers shouldn't see it.
- If the page hasn't drawn itself (a link to the store or a real amount of
  text) 4 seconds after loading and there was a script error, or after 20
  seconds with no error, the guard fires `LPBlank` and sends the visitor to the
  product page with all their params plus `lp=<page>` and `lpf=error` or
  `lpf=stuck`, so Shopify shows how many came that way.
- Add `?lpdebug=1` to a page to see its errors on screen and skip the redirect.

**Checks.** `.github/workflows/lp-checks.yml` runs `smoke/check-pages.ts`, which
loads every page in iPhone Safari's engine (WebKit) and in Chrome on Android,
with the pixel stubbed out and the store never contacted:

- on every pull request, against its deploy preview, so a broken change
  can't be merged;
- after every merge, and each morning at 7:17 am Pacific, against
  go.keptcollection.com. A failure opens an issue labeled `lp-check` (or adds to
  the open one), which notifies the repo owner.

A page fails if it doesn't draw itself with a link to the store, throws a
script error, trips the guard, or doesn't fire the pixel's PageView. The run also
tests the guard on made-up pages and on a real page broken on purpose. Netlify's
build writes the deployed commit to `/_commit.txt`, which the check waits for.

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
# Browser checks (needs Playwright with WebKit and Chromium; KEPT_ENGINES=chromium for one):
node --experimental-strip-types smoke/check-pages.ts https://go.keptcollection.com
```
