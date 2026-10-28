// Browser checks for the landing pages. Run:
//   node --experimental-strip-types smoke/check-pages.ts [base-url]
// base-url defaults to https://go.keptcollection.com (a deploy preview works too).
//
// Two parts:
//  1. The error guard, on made-up pages served inside the browser (no network):
//     a crashed page goes to the store with its params, a slow page and a page
//     with a harmless error stay put, and ?lpdebug=1 never redirects.
//  2. Every real page, in iPhone Safari's engine (WebKit) and in Chrome on
//     Android: it must draw itself with a link to the store, throw no script
//     errors and not trip the guard. Then one real page is broken on purpose
//     to check the guard on the deployed code.
//
// The Meta pixel is swapped for a stub that only records calls, and
// keptcollection.com is never contacted, so the checks add no pixel events
// and no store sessions.
//
// Exit code 1 if anything fails. A summary is written to smoke/summary.md
// (the scheduled GitHub check posts it as an issue).

import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { LANDING_PAGES, META_PIXEL_ID, STORE_FALLBACK } from "../src/lps.ts";
import { trackingSnippet } from "../src/tracking.ts";

const require = createRequire(import.meta.url);
const { chromium, webkit, devices } = require("playwright");

const BASE = (process.argv[2] || "https://go.keptcollection.com").replace(/\/+$/, "");
const FAST = { afterErrorMs: 1500, stuckMs: 6000, pollMs: 500 };

type Result = { name: string; ok: boolean; detail: string };
const results: Result[] = [];
function record(name: string, ok: boolean, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${detail ? ` - ${detail}` : ""}`);
}

// Stand-in for fbevents.js: hands every fbq call to the test (through an
// exposed function that survives navigation, so calls made just before a
// redirect still arrive).
const FBQ_STUB = `(function () {
  var f = window.fbq; if (!f) return;
  f.callMethod = function () {
    var a = [].slice.call(arguments);
    try { if (window.__keptRecord) window.__keptRecord(JSON.parse(JSON.stringify(a))); } catch (e) {}
  };
  var q = f.queue || []; f.queue = [];
  for (var i = 0; i < q.length; i++) f.callMethod.apply(f, q[i]);
})();`;

type Ctx = { calls: any[][]; storeHits: string[]; pageErrors: string[] };

async function newPage(browser: any, device: any, ctx: Ctx) {
  const context = await browser.newContext({ ...device });
  await context.exposeBinding("__keptRecord", (_src: any, call: any[]) => { ctx.calls.push(call); });
  const page = await context.newPage();
  page.on("pageerror", (e: Error) => ctx.pageErrors.push(e.message));
  await page.route("https://connect.facebook.net/**", (r: any) =>
    r.fulfill({ status: 200, contentType: "application/javascript", body: FBQ_STUB }));
  await page.route("https://www.facebook.com/**", (r: any) => r.fulfill({ status: 204, body: "" }));
  // The store (keptcollection.com, www., shop.) but not go.keptcollection.com, the pages themselves.
  await page.route((u: URL) => /(^|\.)keptcollection\.com$/.test(u.hostname) && u.hostname !== "go.keptcollection.com", (r: any) => {
    ctx.storeHits.push(r.request().url());
    return r.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>store stub</title><p>store</p>" });
  });
  return { context, page };
}

const events = (ctx: Ctx, name: string) => ctx.calls.filter((c) => c[0] === "trackCustom" && c[1] === name).map((c) => c[2] || {});

// ---- Part 1: the guard on synthetic pages ----------------------------------

// A page shaped like a Claude Design export: placeholder and status line first,
// then whatever `script` does on DOMContentLoaded.
function syntheticPage(script: string, guard = FAST) {
  return `<!doctype html><html><head>${trackingSnippet({ pixelId: META_PIXEL_ID, lp: "new-baby", fallback: STORE_FALLBACK, guard })}</head>
<body><div id="__bundler_placeholder">Loading Kept — One for the new baby.</div><div id="__bundler_loading">Unpacking...</div>
<script>
// Same red error box the export's loader draws.
window.addEventListener('error', function (e) {
  if (!e.message) return;
  var d = document.getElementById('__bundler_err') || document.body.appendChild(document.createElement('div'));
  d.id = '__bundler_err'; d.textContent = '[bundle] ' + e.message;
}, true);
document.addEventListener('DOMContentLoaded', function () { ${script} });
</script></body></html>`;
}
const RENDER = `document.body.innerHTML = '<h1>One for the new baby. One for their older sibling.</h1><p>Childhood, A History is the baby book you can start anytime, for every kid in the family.</p><a href="https://keptcollection.com/products/childhood-a-history">Shop now</a>';`;
const CRASH = `document.body.innerHTML = '<div id="root"></div>'; setTimeout(function () { undefinedThing.useState(); }, 0);`;

async function guardChecks(browser: any, label: string, device: any) {
  const origin = "https://guard.test";
  const cases: { name: string; html: string; query?: string; expect: (ctx: Ctx, page: any) => Promise<string | null> }[] = [
    {
      name: "crashed page goes to the store with its params",
      html: syntheticPage(CRASH),
      query: "?utm_source=meta&utm_campaign=q4&fbclid=abc&trybe=ab12cd34",
      expect: async (ctx) => {
        const hit = ctx.storeHits[0];
        if (!hit) return "no redirect";
        const u = new URL(hit);
        if (u.origin + u.pathname !== STORE_FALLBACK) return `went to ${u.origin + u.pathname}`;
        for (const [k, v] of [["utm_source", "meta"], ["utm_campaign", "q4"], ["fbclid", "abc"], ["trybe", "ab12cd34"], ["lp", "new-baby"], ["lpf", "error"]])
          if (u.searchParams.get(k) !== v) return `${k}=${u.searchParams.get(k)} (wanted ${v})`;
        if (!events(ctx, "LPError").length) return "no LPError event";
        const blank = events(ctx, "LPBlank")[0];
        if (!blank || blank.reason !== "error") return "no LPBlank event";
        return null;
      },
    },
    {
      name: "slow page (draws at 3s, no error) stays put",
      html: syntheticPage(`setTimeout(function () { ${RENDER} }, 3000);`),
      expect: async (ctx) => (ctx.storeHits.length ? "redirected" : events(ctx, "LPBlank").length ? "LPBlank fired" : null),
    },
    {
      name: "page that draws but throws stays put, reports LPError, hides the red box",
      html: syntheticPage(`${RENDER} setTimeout(function () { nope(); }, 50);`),
      expect: async (ctx, page) => {
        if (ctx.storeHits.length) return "redirected";
        if (!events(ctx, "LPError").length) return "no LPError event";
        const shown = await page.evaluate(() => { const d = document.getElementById("__bundler_err"); return !!d && getComputedStyle(d).display !== "none"; });
        return shown ? "red error box still showing" : null;
      },
    },
    {
      name: "loader that can't unpack counts as a crash",
      html: syntheticPage(`document.getElementById('__bundler_loading').textContent = 'Error: missing bundle data';`),
      expect: async (ctx) => {
        const u = ctx.storeHits[0] && new URL(ctx.storeHits[0]);
        if (!u) return "no redirect";
        return u.searchParams.get("lpf") === "error" ? null : `lpf=${u.searchParams.get("lpf")}`;
      },
    },
    {
      name: "page that never draws (no error) goes to the store as stuck",
      html: syntheticPage(``),
      expect: async (ctx) => {
        const u = ctx.storeHits[0] && new URL(ctx.storeHits[0]);
        if (!u) return "no redirect";
        return u.searchParams.get("lpf") === "stuck" ? null : `lpf=${u.searchParams.get("lpf")}`;
      },
    },
    {
      name: "?lpdebug=1 keeps a crashed page in place with the red box",
      html: syntheticPage(CRASH),
      query: "?lpdebug=1",
      expect: async (ctx, page) => {
        if (ctx.storeHits.length) return "redirected";
        if (!events(ctx, "LPBlank").length) return "no LPBlank event";
        const shown = await page.evaluate(() => { const d = document.getElementById("__bundler_err"); return !!d && getComputedStyle(d).display !== "none"; });
        return shown ? null : "red error box hidden";
      },
    },
  ];
  for (const c of cases) {
    const ctx: Ctx = { calls: [], storeHits: [], pageErrors: [] };
    const { context, page } = await newPage(browser, device, ctx);
    await page.route(`${origin}/new-baby*`, (r: any) => r.fulfill({ status: 200, contentType: "text/html", body: c.html }));
    try {
      await page.goto(`${origin}/new-baby${c.query || ""}`, { waitUntil: "load" });
      await page.waitForTimeout(FAST.stuckMs + 2500);
      const problem = await c.expect(ctx, page);
      record(`guard (${label}): ${c.name}`, !problem, problem || "");
    } catch (err) {
      record(`guard (${label}): ${c.name}`, false, String(err).slice(0, 200));
    }
    await context.close();
  }
}

// ---- Part 2: the real pages -------------------------------------------------

async function pageChecks(browser: any, label: string, device: any) {
  const origin = new URL(BASE).origin;
  for (const slug of Object.keys(LANDING_PAGES)) {
    const ctx: Ctx = { calls: [], storeHits: [], pageErrors: [] };
    const { context, page } = await newPage(browser, device, ctx);
    const name = `page (${label}): /${slug}`;
    try {
      const res = await page.goto(`${BASE}/${slug}?utm_source=smoketest`, { waitUntil: "load", timeout: 45000 });
      // Longer than the guard's wait after an error, so a crash would have redirected by now.
      await page.waitForTimeout(7000);
      const problems: string[] = [];
      if (!res || res.status() !== 200) problems.push(`HTTP ${res?.status()}`);
      if (ctx.storeHits.length) problems.push(`sent to the store (${new URL(ctx.storeHits[0]).searchParams.get("lpf") || "no lpf"})`);
      const state = await page.evaluate(() => ({
        host: location.host,
        links: document.querySelectorAll('a[href*="//keptcollection.com"], a[href*="//www.keptcollection.com"]').length,
        text: (document.body?.innerText || "").replace(/\s+/g, " ").trim().length,
        title: document.title,
      })).catch(() => null);
      if (!state) problems.push("page went away");
      else {
        if (state.links < 1) problems.push("no link to the store");
        if (state.text < 200) problems.push(`only ${state.text} characters of text`);
      }
      if (ctx.pageErrors.length) problems.push(`script errors: ${ctx.pageErrors.slice(0, 3).join(" | ").slice(0, 300)}`);
      const lpErrors = events(ctx, "LPError");
      if (lpErrors.length && !ctx.pageErrors.length) problems.push(`LPError: ${lpErrors.map((e) => e.msg).join(" | ").slice(0, 300)}`);
      if (!ctx.calls.some((c) => c[0] === "track" && c[1] === "PageView")) problems.push("pixel PageView not fired");
      record(name, problems.length === 0, problems.join("; ") || `${state?.links} store links, ${state?.text} chars`);
    } catch (err) {
      record(name, false, String(err).slice(0, 200));
    }
    await context.close();
  }

  // The deployed guard, on a real page broken on purpose: hide the export's
  // template so its loader fails, as a crash would leave the page.
  const ctx: Ctx = { calls: [], storeHits: [], pageErrors: [] };
  const { context, page } = await newPage(browser, device, ctx);
  const name = `deployed guard (${label}): broken /new-baby goes to the store`;
  await page.route(`${BASE}/new-baby*`, async (r: any) => {
    const real = await r.fetch();
    const html = (await real.text()).replace('<script type="__bundler/template">', '<script type="__bundler/broken">');
    return r.fulfill({ status: real.status(), contentType: "text/html; charset=utf-8", body: html });
  });
  try {
    await page.goto(`${BASE}/new-baby?utm_source=smoketest&trybe=ab12cd34&v=guard${Date.now()}`, { waitUntil: "load", timeout: 45000 });
    await page.waitForTimeout(9000);
    const u = ctx.storeHits[0] ? new URL(ctx.storeHits[0]) : null;
    const problem = !u ? "no redirect"
      : u.origin + u.pathname !== STORE_FALLBACK ? `went to ${u.origin + u.pathname}`
      : u.searchParams.get("trybe") !== "ab12cd34" ? "trybe param lost"
      : u.searchParams.get("lpf") !== "error" ? `lpf=${u.searchParams.get("lpf")}`
      : !events(ctx, "LPBlank").length ? "no LPBlank event" : null;
    record(name, !problem, problem || "");
  } catch (err) {
    record(name, false, String(err).slice(0, 200));
  }
  await context.close();
}

const engines: [string, any, any][] = [
  ["iPhone Safari", webkit, devices["iPhone 14"]],
  ["Android Chrome", chromium, devices["Pixel 7"]],
];
// KEPT_ENGINES=chromium (or webkit) runs one engine, e.g. where only one is installed.
const only = (process.env.KEPT_ENGINES || "").split(",").map((s) => s.trim()).filter(Boolean);
for (const [label, engine, device] of engines) {
  if (only.length && !only.includes(engine.name())) continue;
  // Use the machine's HTTPS proxy when it has one (CI doesn't).
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
  const browser = await engine.launch(proxy ? { proxy: { server: proxy } } : {});
  await guardChecks(browser, label, device);
  await pageChecks(browser, label, device);
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
const lines = [
  failed.length ? `**${failed.length} of ${results.length} landing page checks failed** on ${BASE}` : `All ${results.length} landing page checks passed on ${BASE}`,
  "",
  ...results.map((r) => `- ${r.ok ? "✅" : "❌"} ${r.name}${r.detail ? `: ${r.detail}` : ""}`),
];
writeFileSync(new URL("./summary.md", import.meta.url), lines.join("\n") + "\n");
console.log(`\n${lines[0]}`);
process.exit(failed.length ? 1 : 0);
