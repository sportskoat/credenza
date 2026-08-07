#!/usr/bin/env python3
"""
reddit-chart-pull.py — daily size-chart harvest (dormant until Kyle's
Reddit API appeal is approved).

Thin driver over scripts/chartlib.py. This file owns the Reddit OAuth and
the post/comment fetch only. chartlib.process_item() owns classification,
the page render, candidate ranking, the Grok reads, the ledger, and the
cache rows. Agent-host pages are never fetched directly: chartlib unwraps
the link to the marketplace instead (kakobuy returns HTTP 451 in Kyle's
region; cnfans sits behind Cloudflare).

Run: python3 scripts/reddit-chart-pull.py [--subs FashionReps,CNFans,QualityReps] [--limit 10]
Creds: ~/.config/credenza/reddit.json  {"client_id": "...", "client_secret": "..."}
"""

import argparse
import base64
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import chartlib

CREDS_FILE = os.path.expanduser("~/.config/credenza/reddit.json")

UA = "script:credenza-charts:v0.1 (by /u/credenza)"

SELLER_HOSTS = (
    "weidian.com", "taobao.com", "tmall.com", "1688.com", "tb.cn",
    "cnfans.com", "kakobuy.com", "mulebuy.com", "joyagoo.com",
    "oopbuy.com", "lovegobuy.com", "superbuy.com", "sugargoo.com",
    "cssbuy.com", "basetao.net", "hubbuycn.com", "acbuy.com",
)
URL_RE = re.compile(r"https?://[^\s)\]\"'<>,]+")

MAX_IMAGES = 6


def reddit_token(cid, secret):
    auth = base64.b64encode(f"{cid}:{secret}".encode()).decode()
    req = urllib.request.Request(
        "https://www.reddit.com/api/v1/access_token",
        data=b"grant_type=client_credentials",
        headers={"Authorization": f"Basic {auth}", "User-Agent": UA},
    )
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)["access_token"]


def reddit_get(url, tok):
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {tok}", "User-Agent": UA})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)


def extract_links(text):
    out = []
    for u in URL_RE.findall(text or ""):
        u = u.rstrip(".,;")
        host = urllib.parse.urlparse(u).hostname or ""
        host = host.lower().replace("www.", "")
        if any(h in host for h in SELLER_HOSTS):
            out.append(u)
    return out


def item_key(url):
    """Canonical key: marketplace + item id, after chartlib decodes the
    link. An agent link hides the item id inside the link; a key built
    from the raw link would collide across items on the same agent site.
    Unclassified links fall back to host+path. That fallback can collide,
    but chartlib never ledgers an unclassified link, so no item is lost."""
    c = chartlib.classify_buy_link(url)
    if c and c.get("item_id"):
        return f"{c['marketplace']}:{c['item_id']}"
    p = urllib.parse.urlparse(url)
    host = (p.hostname or "").lower().replace("www.", "")
    return f"{host}{p.path}"[:120]


def flatten_comments(node, acc):
    if not isinstance(node, dict):
        return
    if node.get("kind") == "t1":
        acc.append(node["data"].get("body", ""))
        repl = node["data"].get("replies")
        if isinstance(repl, dict):
            for ch in repl["data"]["children"]:
                flatten_comments(ch, acc)
    elif node.get("kind") == "more":
        return


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--subs", default="FashionReps,CNFans,QualityReps")
    ap.add_argument("--limit", type=int, default=10)
    args = ap.parse_args()

    chartlib.open_log()

    if not os.path.exists(CREDS_FILE):
        chartlib.log("fatal", reason=f"missing creds file {CREDS_FILE}")
        sys.exit(1)
    creds = json.load(open(CREDS_FILE))

    try:
        tok = reddit_token(creds["client_id"], creds["client_secret"])
    except Exception as e:  # noqa: BLE001
        chartlib.log("fatal", reason=f"oauth failed: {e}")
        sys.exit(1)
    chartlib.log("oauth_ok")

    stats = {"posts": 0, "links": 0, "charts": 0}

    for sub in args.subs.split(","):
        sub = sub.strip()
        try:
            top = reddit_get(
                f"https://oauth.reddit.com/r/{sub}/top.json?t=day&limit={args.limit}&raw_json=1", tok)
        except Exception as e:  # noqa: BLE001
            chartlib.log("sub_failed", sub=sub, reason=str(e))
            continue
        time.sleep(1)

        for child in top["data"]["children"]:
            p = child["data"]
            stats["posts"] += 1
            title, permalink = p.get("title", ""), p.get("permalink", "")
            chartlib.log("post", sub=sub, title=title[:100], score=p.get("score"))

            links = extract_links(p.get("selftext", ""))
            try:
                comments = reddit_get(
                    f"https://oauth.reddit.com{permalink}.json?limit=200&depth=2&raw_json=1", tok)
                bodies = []
                for c in comments[1]["data"]["children"]:
                    flatten_comments(c, bodies)
                for b in bodies:
                    links.extend(extract_links(b))
            except Exception as e:  # noqa: BLE001
                chartlib.log("comments_failed", post=permalink[:60], reason=str(e))
            time.sleep(1)

            links = list(dict.fromkeys(links))
            if not links:
                chartlib.log("no_links", post=permalink[:60])
            for url in links:
                stats["links"] += 1
                key = item_key(url)
                chartlib.log("link", post=permalink[:60], url=url[:120], key=key)
                added = chartlib.process_item(
                    source="reddit", item_key=key, url=url, title=title,
                    garment_type="Other", max_images=MAX_IMAGES,
                    brand=None, source_url=url,
                    source_post=f"https://www.reddit.com{permalink}")
                if added:
                    stats["charts"] += 1

    chartlib.log("done", **stats)
    chartlib.save_ledger()
    chartlib.close_log()


if __name__ == "__main__":
    main()
