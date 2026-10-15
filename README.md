# kept-pages

Serves Kept's landing pages on **go.keptcollection.com**, one page per path:

| Path | Page | Netlify site |
| --- | --- | --- |
| `/new-baby` | New baby + big siblings (catch-up a) | `cd-5cab7041bb-c09ab7` |

Anything else on the domain (the bare domain, typos, retired pages) redirects to
keptcollection.com and keeps its query string.

## How it works

Each page is designed in Claude Design and sent to Netlify with **Share → Export →
Send to Netlify**, which gives every page its own Netlify site. This repo is a
small router site that owns the domain:

- `netlify/edge-functions/landing-page.ts` fetches the page from its site and
  adds the tracking snippet at the top of `<head>`.
- `src/lps.ts` is the list of pages (path → site), plus the Meta pixel ID and
  the fallback URL.
- `src/tracking.ts` is the snippet. It loads the Meta pixel ("Kept Website Pixel",
  the same dataset as the store) and fires `PageView`. On any click to
  keptcollection.com it copies the ad params from the landing page URL
  (`utm_*`, `fbclid`, `gclid`, `ttclid`, `msclkid`, `trybe`) onto the link, adds
  `lp=<path>`, and fires a custom `LPClick` event.
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
node --experimental-strip-types --test test/router.test.ts
```
