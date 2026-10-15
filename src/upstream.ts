// Fetch a landing page's exported HTML from its own Netlify site.
// Returns null (and logs why) if the site isn't answering with a 200.
export async function fetchPageHtml(slug: string, origin: string): Promise<string | null> {
  try {
    const upstream = await fetch(origin + "/", {
      redirect: "manual",
      headers: { accept: "text/html" },
    });
    if (upstream.status === 200) return await upstream.text();
    console.error(`[lp] ${slug}: ${origin} answered ${upstream.status}`);
  } catch (err) {
    console.error(`[lp] ${slug}: could not reach ${origin}`, err);
  }
  return null;
}
