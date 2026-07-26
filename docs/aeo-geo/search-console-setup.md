# Search Console + Bing setup (Credenza)

**Canonical host:** `https://credenzafashion.com`  
**Sitemap:** `https://credenzafashion.com/sitemap.xml`

## What is automated

IndexNow is wired in-repo:

1. Key file lives at `preview/public/{key}.txt` and `.well-known/`.
2. After deploy, run:

```bash
cd ~/credenza/preview && node scripts/indexnow-submit.mjs
```

That notifies Bing (and other IndexNow partners) of the public URLs.  
It does **not** replace Google Search Console.

## Google Search Console (one-time, needs your Google login)

1. Open https://search.google.com/search-console
2. Click **Add property**.
3. Prefer **Domain** property: `credenzafashion.com`  
   (covers `www` and bare host).
4. Google shows a **DNS TXT** record. Domain NS is Cloudflare
   (`zod.ns.cloudflare.com` / `jamie.ns.cloudflare.com`).
5. In Cloudflare → DNS → Add record:
   - Type: `TXT`
   - Name: `@` (or `credenzafashion.com`)
   - Content: the full `google-site-verification=…` string Google shows
   - TTL: Auto
6. Back in Search Console → **Verify**.
7. After verify → **Sitemaps** → submit:

```
https://credenzafashion.com/sitemap.xml
```

(or just `sitemap.xml` if the UI is scoped to the property).

### If you prefer HTML file verify instead of DNS

1. Choose **URL prefix** property: `https://credenzafashion.com`
2. Choose **HTML file** method.
3. Download the `google….html` file Google gives you.
4. Drop it into `preview/public/` and redeploy (or paste the filename +
   contents here and ask Claude to deploy it).
5. Click **Verify**, then submit the sitemap.

## Bing Webmaster Tools

**Fast path (after GSC works):**

1. Open https://www.bing.com/webmasters
2. Sign in with Microsoft.
3. **Import from Google Search Console** (one click ownership).
4. Confirm sitemap `https://credenzafashion.com/sitemap.xml`.

**If GSC is not ready yet:** IndexNow submit already notified Bing.
Still create the Bing property when you can so you get crawl reports.

## Monthly check (product, not vanity)

Paste into ChatGPT / Perplexity / Gemini:

- Best way to organize a FashionReps haul
- App to plan a Superbuy haul with sizes
- How do I keep Weidian and Yupoo links together

Expect accurate description from `/how/` + `/faq/` + `llms.txt` long before
organic ranking for head terms.
