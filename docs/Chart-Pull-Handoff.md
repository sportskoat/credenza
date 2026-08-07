# Chart Pull — system handoff for agents

Built and proven 2026-08-05. Owner: Kyle. Built by: Kimi K3 lane.
Purpose: collect seller garment size charts into Credenza's cache, daily,
on plan-billed lanes (no API dollars).

## What lives where

| Thing | Path |
|---|---|
| Daily job (aggregator source) | `scripts/w2clinks-chart-pull.py` |
| Reddit job (dormant) | `scripts/reddit-chart-pull.py` |
| Cache table (output) | `data/seller-charts.json` |
| Daily logs | `logs/chart-pull-YYYY-MM-DD.jsonl` |
| Cron output log | `logs/chartpull-cron.log` |
| Checked-items ledger | `logs/checked-items.json` |
| Schedule | launchd `com.kyle.chartpull`, daily 09:17 |
| Reddit creds (when approved) | `~/.config/credenza/reddit.json` |

## How the daily job works

1. Reads the public JSON feed of w2clinks.com:
   `https://w2clinks.com/public/typesense-search.php?q=&category={CAT}&page=1&sort=newest`
   The `sort` parameter is ignored by the server. Every ordering returns the
   newest list. There is no popularity ranking. Do not look for one there.
2. Takes the N newest items per category. Current schedule: 8 categories
   (T-SHIRT, HOODIE, JACKET, PANTS, SHIRT, SWEATER, SHORTS, SNEAKERS) × 4.
3. Renders each item's Weidian page in headless Chrome:
   `Google Chrome --headless=new --disable-gpu --virtual-time-budget=25000 --dump-dom <url>`
   The description block (where charts live) only exists after JS runs.
   Plain HTTP gets the gallery photos only, and charts are almost never
   in the gallery.
4. Picks chart-likely images: seller images on `si.geilicdn.com` with the
   `open<digits>-` or `pcitem<digits>-` prefix, sorted by aspect ratio.
   Tables are wide or tall. Photos are square. Square is ranked last.
5. Sends ONE image per call to the Grok lane:
   `~/.grok/bin/grok -p <prompt> --json-schema <schema> --always-approve`
   Stops at the first chart found. Retries the top suspect once on a
   negative, because Grok vision is inconsistent run to run.
6. Appends rows to `data/seller-charts.json`. Logs every event as JSONL.
   Never rechecks an item (ledger + rows in the cache both count as seen).

## One shared pipeline

`scripts/chartlib.py` is the one pipeline. Both jobs are thin drivers over
it. chartlib classifies every link. It unwraps agent links (superbuy,
fansbuy, mulebuy, hoobuy, oopbuy, usfans, cnfans, joyagoo, and others) to
a marketplace plus an item id. Weidian items go through the proven render
and Grok path above.

New log events:

- `agent_unwrapped` — an agent link held a marketplace item id.
- `skip_marketplace` — a taobao, tmall, or 1688 item. Logged and counted.
  Not harvested yet. Their item pages are anti-bot walled. Their public
  mirrors carry gallery photos only, with a proven 0% chart rate. Harvest
  starts when a real source produces volume.
- `skip_short_link` — a Taobao short link with no item id inside.
- `skip_unclassified` — a link no rule recognizes. The URL is in the log.
- `grok_call_failed` — one Grok read failed. The run tries the next photo.
  The item only fails when every photo fails.

These events replace `skip_no_weidian_id`. No link is dropped silently now.

Review fixes (2026-08-06, after a two-agent review):

- A skipped link never enters the checked-items ledger. When a taobao
  harvester exists later, those items get a fresh chance.
- Every harvested item also records the name `weidian:{id}`. The Reddit
  job builds its keys the same way, from the decoded link. The same item
  found through two sources is harvested once.
- `chart_image` always names the photo Grok actually read, even when an
  earlier photo in the set was skipped.
- lovegobuy and hubbuycn are on the known agent-site list in chartlib.py
  only. resolve.js is out of scope for this job and stays unchanged.
- The self test now checks 18 link fixtures.

## Row shape (extends data/brand-measurements.json conventions)

```json
{
  "size": "S", "chest_cm": 114, "waist_cm": null, "length_cm": 66,
  "shoulder_cm": null, "sleeve_cm": 37,
  "brand": null, "item_key": "w2clinks:wd_7788794288",
  "item_title": "Slaughter Gang Black Mesh Set",
  "garment_type": "T-shirt", "source_kind": "garment",
  "source_url": "<w2clinks item page>", "source_post": null,
  "chart_image": "<geilicdn url>", "date_checked": "2026-08-05",
  "fit_note": "<grok's notes: units, variance, height/weight table hints>"
}
```

`source_kind=garment` means flat measurements of the garment itself. This is
the complement of `source_kind=body` rows in `brand-measurements.json`. The
two kinds must never be averaged together.

## Gotchas — each one cost real time. Do not relearn them.

1. **Grok's envelope.** With `--json-schema`, stdout is a JSON envelope
   `{text, structuredOutput, usage, ...}`. The answer is in
   `structuredOutput`. Parsing the top level returns a dict with no
   `is_chart` key, which reads as "not a chart." This bug burned three
   full runs. Use `parse_grok_output()` in the script.
2. **One image per call.** Grok misses charts when shown a set. Alone he
   reads them perfectly. Never batch images into one call.
3. **Retry the top suspect.** Same image, same prompt: yes by hand, no in
   a run. One retry on the #1 candidate saved 3 of 10 charts in round 1.
4. **Two Weidian layouts.** Some pages serve `open\d+-...` image URLs,
   others serve `pcitem\d+-...`. Match both or whole items go dark
   (the `no_images` failure mode).
5. **Aggregators mirror gallery photos only.** If you skip the browser
   render, expect a 0% hit rate. Round 1 proved it: 0 charts in 24 items
   from gallery alone, then 10 of 12 with the browser path.
6. **Reddit is walled.** Anonymous `.json`, RSS, mirrors, and the lanes'
   own fetch tools all get 403 or robot pages. App creation at
   reddit.com/prefs/apps is locked behind API approval. Kyle's first
   application was denied 2026-08-02 (request 18178900, ticket
   YJX4KE-L6G7P) for lack of detail. A detailed appeal was drafted and
   is Kyle's to send.

## Operating commands

```bash
# manual run (2 items, smoke test)
python3 scripts/w2clinks-chart-pull.py --categories T-SHIRT --per-cat 2

# force recheck of everything already seen
rm logs/checked-items.json   # charted items still skip via the cache rows

# health check
tail -20 logs/chart-pull-$(date +%F).jsonl
python3 -c "import json; print(len(json.load(open('data/seller-charts.json'))['rows']))"

# schedule control
launchctl list | grep chartpull
launchctl unload ~/Library/LaunchAgents/com.kyle.chartpull.plist
```

## Round 1 results (2026-08-05)

12 items checked, 10 charts, 45 rows. Misses: one watch listing in the
T-shirt category (aggregator data quality), one item with no chart.
Cost: ~1M Grok plan tokens per full run. No dollars.

## Open items

1. **Reddit appeal** — Kyle sends the drafted reply to ticket YJX4KE-L6G7P.
   On approval: create the script app, put creds in
   `~/.config/credenza/reddit.json`, then test `scripts/reddit-chart-pull.py`.
   Reddit top-posts are the true "what is popular" signal; the aggregator
   only shows what sellers upload.
2. **Popularity gap** — until Reddit approves, the job has no demand-side
   ranking. Mitigation in place: 8 categories × 4 items daily.
3. **Spendboard tile** — Kyle was offered a daily chart-count tile on
   :8484. Not built yet.
4. **Other agents/sites** — Kakobuy pages return 451 from Kyle's region.
   CNFans is Cloudflare-walled. If a second aggregator is added, copy the
   feed → render → filter → Grok pattern; do not reuse gallery-only logic.
5. **Shoe charts** — SNEAKERS category is in the schedule. Shoe charts use
   EU/US size labels; the schema's `size` field accepts any string, so rows
   land fine, but downstream consumers should expect non-S/M/L sizes.

## Style rule for any agent continuing this work

All user-visible output follows ASD-STE100 plain English
(`~/.claude/WRITING-STYLE.md`). Short sentences. Active voice. Name the
effect Kyle sees, not the mechanism.
