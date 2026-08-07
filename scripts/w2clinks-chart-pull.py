#!/usr/bin/env python3
"""
w2clinks-chart-pull.py — harvest size charts from the W2C Links aggregator.

Thin driver over scripts/chartlib.py. This file owns the feed fetch and the
category loop only. chartlib.process_item() owns classification, the page
render, candidate ranking, the Grok reads, the ledger, and the cache rows.

Run: python3 scripts/w2clinks-chart-pull.py [--categories T-SHIRT,HOODIE] [--per-cat 8]
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import chartlib

FEED = "https://w2clinks.com/public/typesense-search.php?q=&category={cat}&page=1&sort=newest"
BASE = "https://w2clinks.com"


def http_get(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": chartlib.UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def hit_buy_url(hit):
    """A non-Weidian feed entry can still carry a buy link (often an agent
    link). chartlib classifies it; nothing is silently dropped."""
    for field in ("buy_url", "buyUrl", "link", "product_url", "source_url", "item_url"):
        v = hit.get(field)
        if isinstance(v, str) and v.startswith("http"):
            return v
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--categories", default="T-SHIRT,HOODIE")
    ap.add_argument("--per-cat", type=int, default=8)
    ap.add_argument("--max-images", type=int, default=6)
    args = ap.parse_args()

    chartlib.open_log()
    stats = {"items": 0, "charts": 0, "skipped_dup": 0}

    for cat in [c.strip() for c in args.categories.split(",")]:
        try:
            feed = json.loads(http_get(FEED.format(cat=urllib.parse.quote(cat))))
        except Exception as e:  # noqa: BLE001
            chartlib.log("feed_failed", category=cat, reason=str(e)[:150])
            continue
        hits = feed.get("hits", [])[:args.per_cat]
        chartlib.log("feed_ok", category=cat, total=feed.get("found"), taking=len(hits))
        time.sleep(1)

        for hit in hits:
            stats["items"] += 1
            slug = hit.get("url", "")
            key = "w2clinks:" + slug.strip("/").split("/")[-1].replace(".html", "")
            title = hit.get("title", "")
            page_url = BASE + slug
            if chartlib.is_seen(key):
                stats["skipped_dup"] += 1

            wd_id = re.search(r"wd_(\d+)", key)
            if wd_id:
                url = f"https://weidian.com/item.html?itemID={wd_id.group(1)}"
            else:
                url = hit_buy_url(hit) or page_url

            added = chartlib.process_item(
                source="w2clinks", item_key=key, url=url, title=title,
                garment_type=cat.title(), max_images=args.max_images,
                brand=hit.get("brand") or None,
                source_url=page_url, source_post=None)
            if added:
                stats["charts"] += 1

    chartlib.log("done", **stats)
    chartlib.save_ledger()
    chartlib.close_log()


if __name__ == "__main__":
    main()
