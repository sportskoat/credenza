#!/usr/bin/env python3
"""
chartlib.py — the one shared chart-harvest pipeline.

Every driver (w2clinks, reddit, any future feed) calls process_item().
This module owns:
  - link classification (ported from preview/netlify/functions/resolve.js);
  - candidate ranking (ported from components/chart-pipeline.js);
  - the headless-Chrome page render (plain HTTP gets gallery photos only,
    and charts are almost never in the gallery);
  - the Grok vision reads (one image per call, retry the top suspect);
  - the checked-items ledger and the seller-charts cache.

Run the no-network self test: python3 scripts/chartlib.py --selftest
Python 3 standard library only.
"""

import json
import os
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from datetime import date

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_FILE = os.path.join(REPO, "data", "seller-charts.json")
LOG_DIR = os.path.join(REPO, "logs")
CHECKED_FILE = os.path.join(LOG_DIR, "checked-items.json")
GROK = os.path.expanduser("~/.grok/bin/grok")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TMP_DIR = "/tmp/chartpull"

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36")

# Seller content images on the Weidian CDN. Both filename prefixes must match:
# some pages serve open<digits>-..., others serve pcitem<digits>-... .
# Missing one makes whole items go dark (the no_images failure mode).
SELLER_IMG_RE = re.compile(
    r"https://si\.geilicdn\.com/(?:open|pcitem)\d+-[^\s\"'<>\\]+?_(\d+)_(\d+)\.(?:jpg|jpeg|png|webp)")

# The Weidian legal notice photo every shop attaches. It is a 2250x4929 tall
# strip, so the shape scorer reads it as chart-like. It holds no measurements.
# It never enters the pool.
WEIDIAN_POLICY_IMG = "img-791300000199cc14effd0a2102c5"

# Filename hints, same patterns as chart-pipeline.js.
STRONG_CHART_NAME = re.compile(
    r"size[\s_-]*chart|sizing[\s_-]*chart|size[\s_-]*table|尺码|尺碼|尺寸表|规格表"
    r"|sizeguide|size_guide|kf尺|尺码表|半胸|measurement", re.I)
WEAK_CHART_NAME = re.compile(
    r"chart|measure|sizing|size|screenshot|screen[\s_-]*shot|截图|规格", re.I)
REJECT_NAME = re.compile(
    r"superbuy|wegobuy|cssbuy|pandabuy|sugargoo|payment|pay\b|wechat|whatsapp"
    r"|telegram|agent|tutorial|guide|how[\s_-]*to|logo|contact|qr[\s_-]*code"
    r"|客服|支付|代购指南", re.I)

# Agent hosts recognized for inbound unwrap. Alternation from resolve.js,
# plus two Reddit-watched hosts resolve.js does not know yet (lovegobuy,
# hubbuycn — added 2026-08-06; only the generic unwrap shapes apply).
AGENT_HOST_RE = re.compile(
    r"(^|\.)(superbuy|youshop10|sugargoo|cssbuy|kakobuy|fansbuy|hoobuy|cnfans"
    r"|mulebuy|acbuy|oopbuy|basetao|wegobuy|pandabuy|allchinabuy|joyabuy"
    r"|joyagoo|mycnbox|gtbuy|hipobuy|usfans|lovegobuy|hubbuycn)\.[a-z.]{2,}$", re.I)

GROK_SCHEMA = json.dumps({
    "type": "object",
    "properties": {
        "is_chart": {"type": "boolean"},
        "chart_image_number": {"type": ["integer", "null"]},
        "garment_type": {"type": "string"},
        "rows": {"type": "array", "items": {
            "type": "object",
            "properties": {
                "size": {"type": "string"},
                "chest_cm": {"type": ["number", "string", "null"]},
                "waist_cm": {"type": ["number", "string", "null"]},
                "length_cm": {"type": ["number", "string", "null"]},
                "shoulder_cm": {"type": ["number", "string", "null"]},
                "sleeve_cm": {"type": ["number", "string", "null"]},
            },
            "required": ["size"],
        }},
        "notes": {"type": "string"},
    },
    "required": ["is_chart", "rows"],
})


# ---------------------------------------------------------------- logging

_log_fp = None


def open_log():
    """Open today's JSONL log (append). Safe to call more than once."""
    global _log_fp
    if _log_fp is None:
        os.makedirs(LOG_DIR, exist_ok=True)
        os.makedirs(TMP_DIR, exist_ok=True)
        _log_fp = open(os.path.join(LOG_DIR, f"chart-pull-{date.today()}.jsonl"), "a")


def log(event, **kw):
    open_log()
    rec = {"t": time.strftime("%H:%M:%S"), "event": event, **kw}
    line = json.dumps(rec, ensure_ascii=False)
    print(line, flush=True)
    _log_fp.write(line + "\n")
    _log_fp.flush()


def close_log():
    global _log_fp
    if _log_fp is not None:
        _log_fp.close()
        _log_fp = None


# ------------------------------------------------------- classification
# Ported from preview/netlify/functions/resolve.js (lines 69-229).
# Logic only; no JS is imported.

def _parse(raw):
    """urllib.parse analogue of `new URL(raw)`. None when not a web URL."""
    try:
        p = urllib.parse.urlparse(str(raw or "").strip())
    except Exception:
        return None
    if p.scheme not in ("http", "https") or not p.hostname:
        return None
    return p


def _host(p):
    return re.sub(r"^www\.", "", (p.hostname or "").lower())


def _q(p):
    return urllib.parse.parse_qs(p.query, keep_blank_values=True)


def _first(q, *keys):
    for k in keys:
        vals = q.get(k)
        if vals and vals[0]:
            return vals[0]
    return None


def weidian_item_id(url):
    """Weidian item id, or None. Port of weidianItemId in resolve.js."""
    p = _parse(url)
    if not p:
        return None
    if not re.search(r"(^|\.)weidian\.(com|cn)$", _host(p)):
        return None
    # Length sanity: every working Weidian item id in the corpus is 10+ digits.
    q = _q(p)
    id_ = _first(q, "itemID", "itemId", "item_id")
    if id_ and re.fullmatch(r"\d{10,}", id_):
        return id_
    m = re.search(r"/item/(\d{10,})", p.path)
    return m.group(1) if m else None


def taobao_family_item_id(url):
    """(marketplace, item_id) for Taobao/Tmall, or None. Port of
    taobaoFamilyItemId in resolve.js. marketplace is "tmall" when the
    host contains tmall."""
    p = _parse(url)
    if not p:
        return None
    host = _host(p)
    is_taobao = (re.search(r"(^|\.)(taobao|tmall)\.com$", host)
                 or host == "m.tb.cn" or re.search(r"(^|\.)tb\.cn$", host))
    if not is_taobao:
        return None
    q = _q(p)
    id_ = _first(q, "id", "itemId", "item_id")
    if id_ and re.fullmatch(r"\d{5,}", id_):
        return ("tmall" if "tmall" in host else "taobao", id_)
    m = re.search(r"/item/(\d{5,})", p.path)
    if m:
        return ("tmall" if "tmall" in host else "taobao", m.group(1))
    return None


def ali1688_item_id(url):
    """1688 offer id, or None. Port of ali1688ItemId in resolve.js."""
    p = _parse(url)
    if not p:
        return None
    if not re.search(r"(^|\.)1688\.com$", _host(p)):
        return None
    m = re.search(r"/offer/(\d{5,})(?:\.html)?", p.path, re.I)
    if m:
        return m.group(1)
    q = _q(p)
    id_ = _first(q, "offerId", "offer_id", "id")
    if id_ and re.fullmatch(r"\d{5,}", id_):
        return id_
    return None


def _classify_direct(url):
    """Direct marketplace classify — no agent unwrap (avoids recursion)."""
    w = weidian_item_id(url)
    if w:
        return {"marketplace": "weidian", "item_id": w}
    a = ali1688_item_id(url)
    if a:
        return {"marketplace": "1688", "item_id": a}
    t = taobao_family_item_id(url)
    if t:
        return {"marketplace": t[0], "item_id": t[1]}
    return None


def unwrap_agent_buy_link(url):
    """Unwrap an agent front URL to a marketplace buy target.
    Port of unwrapAgentBuyLink in resolve.js. Returns
    {"marketplace", "item_id"} or None."""
    p = _parse(url)
    if not p:
        return None
    host = _host(p)
    if not AGENT_HOST_RE.search(host):
        return None
    q = _q(p)

    # Shape 1: embedded ?url= / productLink / ... (Superbuy family). The
    # target is often URL-encoded twice; parse_qs undid one layer already.
    for key in ("url", "productLink", "product_url", "productUrl", "link"):
        vals = q.get(key)
        if not vals or not vals[0]:
            continue
        decoded = vals[0]
        if re.search(r"%[0-9A-Fa-f]{2}", decoded):
            decoded = urllib.parse.unquote(decoded)
        direct = _classify_direct(decoded)
        if direct:
            return direct

    # Shape 2: fansbuy /item-micro-{weidianId}.html
    if re.search(r"(^|\.)fansbuy\.com$", host, re.I):
        m = re.search(r"/item-micro-(\d{5,})(?:\.html)?", p.path, re.I)
        if m:
            return {"marketplace": "weidian", "item_id": m.group(1)}

    # Shape 3: ?id= plus shop_type / platform / shopType (mulebuy, joyagoo,
    # cnfans). Codes: weidian|2, taobao|1, tmall, 1688|3.
    id_q = _first(q, "id", "itemId", "item_id")
    platform_q = _first(q, "shop_type", "platform", "shopType")
    if id_q and re.fullmatch(r"\d{5,}", id_q) and platform_q:
        plat = platform_q.lower()
        if plat in ("weidian", "2"):
            return {"marketplace": "weidian", "item_id": id_q}
        if plat in ("taobao", "1"):
            return {"marketplace": "taobao", "item_id": id_q}
        if plat == "tmall":
            return {"marketplace": "tmall", "item_id": id_q}
        if plat in ("1688", "3"):
            return {"marketplace": "1688", "item_id": id_q}

    # Shape 4: /product/{code}/{id} (hoobuy, oopbuy, usfans). Numeric codes
    # are PER-AGENT (probed live 2026-07-28): hoobuy/oopbuy 2 weidian /
    # 3 1688 — usfans 3 weidian / 4 1688 / 5 taobao / 6 tmall.
    m = re.search(r"/product/([a-z0-9]+)/(\d{5,})/?$", p.path, re.I)
    if m:
        code = m.group(1).lower()
        id_ = m.group(2)
        if re.search(r"(^|\.)usfans\.com$", host, re.I):
            if code == "3":
                return {"marketplace": "weidian", "item_id": id_}
            if code == "4":
                return {"marketplace": "1688", "item_id": id_}
            if code == "5":
                return {"marketplace": "taobao", "item_id": id_}
            if code == "6":
                return {"marketplace": "tmall", "item_id": id_}
            return None
        if code in ("2", "weidian"):
            return {"marketplace": "weidian", "item_id": id_}
        if code in ("1", "taobao"):
            return {"marketplace": "taobao", "item_id": id_}
        if code == "tmall":
            return {"marketplace": "tmall", "item_id": id_}
        if code in ("3", "1688"):
            return {"marketplace": "1688", "item_id": id_}

    return None


def classify_buy_link(url):
    """Classify a buy URL. Direct marketplace first, then agent unwrap.
    Taobao-family short links carry no item id and are never followed here;
    they report as taobao-short. Returns {"marketplace", "item_id"} or None."""
    direct = _classify_direct(url)
    if direct:
        return direct
    unwrapped = unwrap_agent_buy_link(url)
    if unwrapped:
        return unwrapped
    p = _parse(url)
    if p:
        host = _host(p)
        if re.search(r"(^|\.)tb\.cn$", host) or re.search(r"(^|\.)click\.taobao\.com$", host):
            return {"marketplace": "taobao-short", "item_id": None}
    return None


def is_agent_host(url):
    p = _parse(url)
    return bool(p) and bool(AGENT_HOST_RE.search(_host(p)))


# ---------------------------------------------------------- page render

def http_get(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def render_page(url):
    """Render a JS-heavy shop page in headless Chrome. Returns final HTML.
    Plain HTTP is forbidden for Weidian pages: the description block (where
    charts live) only exists after JavaScript runs."""
    out = subprocess.run(
        [CHROME, "--headless=new", "--disable-gpu",
         "--virtual-time-budget=25000", "--dump-dom", url],
        capture_output=True, text=True, timeout=60,
    )
    return out.stdout or ""


# ---------------------------------------------------- candidate ranking
# Ported from components/chart-pipeline.js (scoreChartCandidate /
# rankChartCandidates), for URL-only inputs. Shape only ranks; the
# min-dimension floor below is the only hard cut besides the policy image.

def _score_candidate(url, w, h):
    """Score one candidate. Higher is better. Negative means reject."""
    name = url
    if REJECT_NAME.search(name):
        return -50
    score = 0
    if STRONG_CHART_NAME.search(name):
        score += 100
    elif WEAK_CHART_NAME.search(name):
        score += 40

    wh = w / h
    # Padded-square band: mildly landscape padded tables (common seller
    # charts) rise; exact product squares stay unboosted.
    if 1.02 <= wh <= 1.35:
        score += 20
    # Classic landscape tables — wider than padded-square, not a banner.
    elif 1.35 < wh <= 2.2:
        score += 20
    # Wide banner / contact strip — demoted, never boosted ahead of tables.
    if wh > 2.2:
        score -= 25
    # Tall stacked strip: sellers fold the whole lower page, size tables
    # included, into one long image. Boost the strip into the paid set.
    if h / w >= 2 and h >= 1800:
        score += 30

    edge = max(w, h)
    # A small edge vs typical product shots is the main chart signal when
    # the filename is random CDN noise.
    if 0 < edge < 900:
        score += 30
    elif 0 < edge < 1200:
        score += 15
    if edge > 2000:
        score -= 5

    if re.search(r"\.png(?:$|\?)", url, re.I):
        score += 8
    return score


def pick_chart_candidates(html, limit=5):
    """Seller content images, chart-likely first. The Weidian policy image
    never enters the pool. The 390px min-dimension floor stays."""
    seen, cands = set(), []
    for m in SELLER_IMG_RE.finditer(html):
        url, w, h = m.group(0), int(m.group(1)), int(m.group(2))
        if url in seen or min(w, h) < 390:
            continue
        if WEIDIAN_POLICY_IMG in url:
            continue
        seen.add(url)
        score = _score_candidate(url, w, h)
        if score < 0:
            continue
        cands.append((score, url))
    cands.sort(key=lambda c: -c[0])
    return [u for _, u in cands[:limit]]


# ---------------------------------------------------------- Grok vision

def parse_grok_output(text):
    """--json-schema makes Grok print an envelope: {text, structuredOutput, ...}.
    Read structuredOutput first, then the JSON string inside text, then raw."""
    text = (text or "").strip()
    try:
        env = json.loads(text)
        if isinstance(env, dict):
            if isinstance(env.get("structuredOutput"), dict):
                return env["structuredOutput"], None
            t = env.get("text")
            if isinstance(t, str):
                m = re.search(r"\{.*\}", t, re.S)
                if m:
                    return json.loads(m.group(0)), None
    except json.JSONDecodeError:
        pass
    m = re.search(r"\{.*\}", text, re.S)
    if m:
        try:
            return json.loads(m.group(0)), None
        except json.JSONDecodeError:
            pass
    return None, f"no JSON in grok output: {text[:200]}"


def grok_read_one_chart(img_path, index, context):
    prompt = (
        f"Read the image file at {img_path} using your file-read tool. "
        f"It is photo #{index} from a shopping page for this item: {context}. "
        "If it is a clothing size chart (a table mapping sizes to "
        "measurements), set is_chart=true and extract every size row. "
        "Convert inches to cm. garment_type is one of: T-shirt, Hoodie, "
        "Jacket, Pants, Shorts, Shirt, Sweater, Shoes, Other. If it is not "
        "a size chart, set is_chart=false and rows=[]. Reply with JSON only."
    )
    try:
        out = subprocess.run(
            [GROK, "-p", prompt, "--json-schema", GROK_SCHEMA, "--always-approve"],
            capture_output=True, text=True, timeout=300, cwd=TMP_DIR,
        )
        text = (out.stdout or "").strip()
        return parse_grok_output(text)
    except subprocess.TimeoutExpired:
        return None, "grok timeout"
    except Exception as e:  # noqa: BLE001
        return None, f"grok error: {e}"


def grok_read_chart_set(paths, context):
    """One image per call, most-likely first. Stop at the first chart found.
    Multi-image sets proved unreliable: Grok missed a chart it reads solo.
    Grok is also inconsistent run to run, so the top suspect gets one retry.
    One failed call skips that image only; the rest of the set still runs.
    Error out only when every image fails."""
    last_err = None
    all_failed = True
    for i, p in enumerate(paths, 1):
        res, err = grok_read_one_chart(p, i, context)
        if err and i == 1:
            log("grok_call_failed", img=p, reason=err[:150], action="retry")
            res, err = grok_read_one_chart(p, i, context)
        if err:
            log("grok_call_failed", img=p, reason=err[:150], action="next_image")
            last_err = err
            continue
        all_failed = False
        if not res.get("is_chart") and i == 1:
            log("retry_top_candidate", img=p)
            res, err = grok_read_one_chart(p, i, context)
            if err:
                log("grok_call_failed", img=p, reason=err[:150], action="next_image")
                continue
        if res.get("is_chart") and res.get("rows"):
            res["chart_image_number"] = i
            return res, None
    if all_failed and last_err:
        return None, last_err
    return {"is_chart": False, "rows": []}, None


# ------------------------------------------------------- ledger and cache

_seen = None


def _ensure_seen():
    """An item is seen when it is in the ledger OR already has rows in the
    cache file. Every key that carries a Weidian id also registers the
    canonical alias weidian:{id}, so the same item found through a second
    source (a different driver key) still counts as seen."""
    global _seen
    if _seen is not None:
        return _seen
    seen = set()
    if os.path.exists(OUT_FILE):
        try:
            for r in json.load(open(OUT_FILE)).get("rows", []):
                if r.get("item_key"):
                    seen.add(r["item_key"])
        except Exception:
            pass
    if os.path.exists(CHECKED_FILE):
        try:
            seen |= set(json.load(open(CHECKED_FILE)))
        except Exception:
            pass
    for k in list(seen):
        m = re.search(r"wd_(\d{10,})", k)
        if m:
            seen.add(f"weidian:{m.group(1)}")
    _seen = seen
    return _seen


def is_seen(item_key):
    return item_key in _ensure_seen()


def mark_seen(item_key):
    _ensure_seen().add(item_key)


def save_ledger():
    os.makedirs(LOG_DIR, exist_ok=True)
    json.dump(sorted(_ensure_seen()), open(CHECKED_FILE, "w"))


def append_rows(new_rows):
    """Append rows to data/seller-charts.json. Row shape: see
    docs/Chart-Pull-Handoff.md."""
    if not new_rows:
        return
    store = {"note": "Seller garment size charts. source_kind=garment; these are "
                     "the garment's own flat measurements, not body measurements.",
             "rows": []}
    if os.path.exists(OUT_FILE):
        try:
            store = json.load(open(OUT_FILE))
        except Exception:
            pass
    store["rows"].extend(new_rows)
    os.makedirs(os.path.dirname(OUT_FILE), exist_ok=True)
    json.dump(store, open(OUT_FILE, "w"), ensure_ascii=False, indent=1)


# ---------------------------------------------------------- the pipeline

def process_item(source, item_key, url, title, garment_type, max_images,
                 weidian_id=None, brand=None, source_url=None, source_post=None):
    """The ONE pipeline every driver calls. Classifies the link, harvests
    Weidian items, and logs every other marketplace visibly. Returns the
    number of chart rows appended (0 or more; one chart per item)."""
    if is_seen(item_key):
        log("dup_skip", key=item_key)
        return 0

    if weidian_id:
        classified = {"marketplace": "weidian", "item_id": weidian_id}
    elif url:
        classified = classify_buy_link(url)
    else:
        classified = None

    if not classified:
        log("skip_unclassified", key=item_key, url=(url or "")[:160])
        return 0

    marketplace = classified["marketplace"]
    item_id = classified.get("item_id")

    # Skipped links never enter the ledger: the skip paths cost nothing to
    # re-log, and ledgering them would dup_skip the item forever once a
    # harvester for its marketplace exists.
    if marketplace in ("taobao", "tmall", "1688"):
        # Not harvested yet: their item pages are anti-bot walled and their
        # public mirrors carry gallery photos only (proven 0% chart rate).
        # Logged and counted so the volume is visible.
        if url and is_agent_host(url):
            log("agent_unwrapped", key=item_key, marketplace=marketplace, item_id=item_id)
        log("skip_marketplace", key=item_key, marketplace=marketplace, item_id=item_id)
        return 0

    if marketplace == "taobao-short":
        log("skip_short_link", key=item_key, url=(url or "")[:160])
        return 0

    if marketplace != "weidian" or not item_id:
        log("skip_unclassified", key=item_key, url=(url or "")[:160])
        return 0

    if url and is_agent_host(url):
        log("agent_unwrapped", key=item_key, marketplace="weidian", item_id=item_id)

    # Canonical dedupe: the same Weidian item can arrive under different
    # driver keys (w2clinks:wd_{id} vs weidian:{id}). One name catches both.
    canonical = f"weidian:{item_id}"
    if is_seen(canonical):
        log("dup_skip", key=item_key, canonical=canonical)
        return 0

    # Mark checked now; a mid-item crash skips it tomorrow, which is fine.
    # This sits after the skip branches so only real harvest attempts ledger.
    mark_seen(item_key)
    mark_seen(canonical)
    log("item", key=item_key, title=(title or "")[:90], source=source)
    page_url = source_url or url or f"https://weidian.com/item.html?itemID={item_id}"

    try:
        html = render_page(f"https://weidian.com/item.html?itemID={item_id}")
    except Exception as e:  # noqa: BLE001
        log("render_failed", key=item_key, reason=str(e)[:150])
        return 0
    imgs = pick_chart_candidates(html, limit=max_images)
    if not imgs:
        log("no_images", key=item_key)
        return 0
    time.sleep(1)

    # paths and path_urls stay index-aligned: a skipped photo drops out of
    # both, so chart_image below always names the photo Grok actually read.
    paths, path_urls = [], []
    for i, iu in enumerate(imgs):
        iu = re.sub(r"\?.*$", "", iu)  # strip resize params, get full image
        path = os.path.join(
            TMP_DIR, item_key.replace(":", "_")[:50] + f"_{i+1}.jpg")
        try:
            data = http_get(iu)
            if len(data) < 8000:
                log("img_skip_small", key=item_key, bytes=len(data))
                continue
            open(path, "wb").write(data)
            paths.append(path)
            path_urls.append(iu)
        except Exception as e:  # noqa: BLE001
            log("img_failed", key=item_key, url=iu[:100], reason=str(e)[:120])
    if not paths:
        log("no_images_downloaded", key=item_key)
        return 0
    log("images_ready", key=item_key, count=len(paths))

    res, err = grok_read_chart_set(paths, f"{title} ({source}, page {page_url})")
    if err:
        log("vision_failed", key=item_key, reason=err)
        return 0
    if not res.get("is_chart"):
        log("not_a_chart", key=item_key)
        return 0

    rows = res.get("rows") or []
    n = res.get("chart_image_number")
    chart_img = path_urls[n - 1] if isinstance(n, int) and 0 < n <= len(path_urls) else None
    log("chart_found", key=item_key, rows=len(rows),
        garment=res.get("garment_type"), image=chart_img)
    new_rows = []
    for r in rows:
        r.update({
            "brand": brand or None, "item_key": item_key,
            "item_title": (title or "")[:140],
            "garment_type": res.get("garment_type") or garment_type or "Other",
            "source_kind": "garment", "source_url": page_url,
            "source_post": source_post, "chart_image": chart_img,
            "date_checked": str(date.today()),
            "fit_note": res.get("notes") or None,
        })
        new_rows.append(r)
    append_rows(new_rows)
    return len(new_rows)


# -------------------------------------------------------------- selftest

def _selftest():
    """Classification assertions. No network access."""
    inner = "https://weidian.com/item.html?itemID=7788794288"
    once = urllib.parse.quote(inner, safe="")
    twice = urllib.parse.quote(once, safe="")
    cases = [
        ("direct weidian item", inner,
         {"marketplace": "weidian", "item_id": "7788794288"}),
        ("weidian shop front", "https://mystore.weidian.com/", None),
        ("item.taobao.com ?id=", "https://item.taobao.com/item.htm?id=123456789",
         {"marketplace": "taobao", "item_id": "123456789"}),
        ("detail.tmall.com", "https://detail.tmall.com/item.htm?id=123456789",
         {"marketplace": "tmall", "item_id": "123456789"}),
        ("detail.1688.com offer", "https://detail.1688.com/offer/123456789.html",
         {"marketplace": "1688", "item_id": "123456789"}),
        ("superbuy double-encoded ?url=",
         f"https://www.superbuy.com/en/page/buy?url={twice}",
         {"marketplace": "weidian", "item_id": "7788794288"}),
        ("fansbuy item-micro", "https://www.fansbuy.com/item-micro-7788794288.html",
         {"marketplace": "weidian", "item_id": "7788794288"}),
        ("mulebuy shop_type=weidian",
         "https://mulebuy.com/product/?id=7788794288&shop_type=weidian",
         {"marketplace": "weidian", "item_id": "7788794288"}),
        ("cnfans platform=weidian",
         "https://cnfans.com/product/?id=7788794288&platform=weidian",
         {"marketplace": "weidian", "item_id": "7788794288"}),
        ("hoobuy /product/2/", "https://hoobuy.com/product/2/7788794288",
         {"marketplace": "weidian", "item_id": "7788794288"}),
        ("oopbuy /product/3/", "https://oopbuy.com/product/3/123456789",
         {"marketplace": "1688", "item_id": "123456789"}),
        ("usfans /product/3/", "https://usfans.com/product/3/7788794288",
         {"marketplace": "weidian", "item_id": "7788794288"}),
        ("usfans /product/4/", "https://usfans.com/product/4/123456789",
         {"marketplace": "1688", "item_id": "123456789"}),
        ("usfans /product/5/", "https://usfans.com/product/5/123456789",
         {"marketplace": "taobao", "item_id": "123456789"}),
        ("lovegobuy shop_type=weidian",
         "https://www.lovegobuy.com/product?id=7788794288&shop_type=weidian",
         {"marketplace": "weidian", "item_id": "7788794288"}),
        ("hubbuycn embedded ?url=",
         f"https://hubbuycn.com/page/buy?url={once}",
         {"marketplace": "weidian", "item_id": "7788794288"}),
        ("taobao short link", "https://m.tb.cn/h.abcXYZ",
         {"marketplace": "taobao-short", "item_id": None}),
        ("unknown host", "https://example.com/item/123456789", None),
    ]
    failures = 0
    for name, url, want in cases:
        got = classify_buy_link(url)
        ok = got == want
        if not ok:
            failures += 1
        print(f"{'PASS' if ok else 'FAIL'}  {name}: {url[:70]} -> {got}")
    print(f"{len(cases) - failures}/{len(cases)} passed")
    return 1 if failures else 0


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        sys.exit(_selftest())
    print("chartlib is a library. Use --selftest to run the classification tests.")
