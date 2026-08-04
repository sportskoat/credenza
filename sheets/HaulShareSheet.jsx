import { useEffect, useMemo, useRef, useState } from "react";
import {
  ModalShell,
  Pill,
  SegmentedControl,
  formatMoney,
} from "../credenza-fashion.jsx";
import {
  DEFAULT_HAUL_INCLUDES,
  HAUL_SHARE_INCLUDES,
} from "../credenza-share.js";
import { buildRedditHaulMarkdown } from "../haul-reddit-export.js";

const INCLUDE_LABELS = {
  prices: "Prices",
  w2c: "W2C links",
  fit: "Fit notes",
  sellers: "Sellers",
  qc: "QC photos",
  weights: "Weights",
};

const LAYOUT_OPTIONS = [
  { value: "review", label: "Review" },
  { value: "receipt", label: "Receipt" },
  { value: "both", label: "Both" },
];

const LAYOUT_HINTS = {
  both: "Opens on the review. The reader can switch to the receipt without leaving the page.",
  review: "Opens on the review only. No receipt tab.",
  receipt: "Opens on the receipt only. No review tab.",
};

function moneyLabel(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  return formatMoney(n, "USD");
}

function daysBetween(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return null;
  const ms = db.getTime() - da.getTime();
  if (ms < 0) return null;
  return Math.round(ms / 86400000);
}

async function nodeToPngBlob(node) {
  if (!node || typeof document === "undefined") throw new Error("No card to save.");
  const width = 1200;
  const height = 630;
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable.");
  ctx.scale(scale, scale);

  // Paint from the live card's computed colours and photo tiles.
  const style = getComputedStyle(node);
  const bg = style.backgroundColor || "#ffffff";
  const ink = style.color || "#17181a";
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Left mosaic
  const tiles = node.querySelectorAll(".cz-haul-embed-tile");
  const tileW = width / 2 / 2;
  const tileH = height / 2;
  const inset = getComputedStyle(document.documentElement).getPropertyValue("--cz-inset-bg").trim() || "#fafaf6";

  const drawTile = (imgEl, x, y, w, h) =>
    new Promise((resolve) => {
      if (!imgEl || !imgEl.getAttribute("data-src")) {
        ctx.fillStyle = inset;
        ctx.fillRect(x, y, w, h);
        resolve(false);
        return;
      }
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const iw = img.naturalWidth || w;
          const ih = img.naturalHeight || h;
          const scaleCover = Math.max(w / iw, h / ih);
          const sw = w / scaleCover;
          const sh = h / scaleCover;
          const sx = (iw - sw) / 2;
          const sy = (ih - sh) / 2;
          ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
          resolve(true);
        } catch {
          ctx.fillStyle = inset;
          ctx.fillRect(x, y, w, h);
          resolve(false);
        }
      };
      img.onerror = () => {
        ctx.fillStyle = inset;
        ctx.fillRect(x, y, w, h);
        resolve(false);
      };
      img.src = imgEl.getAttribute("data-src");
    });

  const positions = [
    [0, 0],
    [tileW, 0],
    [0, tileH],
    [tileW, tileH],
  ];
  for (let i = 0; i < 4; i++) {
    const [x, y] = positions[i];
    await drawTile(tiles[i], x, y, tileW, tileH);
  }

  // Right text column
  const pad = 40;
  const textX = width / 2 + pad;
  const textW = width / 2 - pad * 2;
  let y = pad + 8;

  ctx.fillStyle = ink;
  ctx.font = '700 22px "Clash Grotesk", ui-sans-serif, system-ui, sans-serif';
  ctx.fillText("CREDENZA", textX, y + 22);
  y += 56;

  const title = node.getAttribute("data-title") || "";
  ctx.font = '600 28px "Clash Grotesk", ui-sans-serif, system-ui, sans-serif';
  // crude wrap
  const words = title.split(/\s+/);
  let line = "";
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > textW && line) {
      ctx.fillText(line, textX, y);
      y += 34;
      line = word;
    } else {
      line = test;
    }
  }
  if (line) {
    ctx.fillText(line, textX, y);
    y += 40;
  }

  const landed = node.getAttribute("data-landed") || "";
  if (landed) {
    ctx.fillStyle = style.getPropertyValue("--cz-money") || "#147a3a";
    ctx.font = '600 19px "Clash Grotesk", ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(landed, textX, y);
    y += 32;
  }

  const meta = node.getAttribute("data-meta") || "";
  if (meta) {
    ctx.fillStyle = style.getPropertyValue("--cz-faint") || "#6b7078";
    ctx.font = '700 12px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(meta.toUpperCase(), textX, y);
    y += 28;
  }

  const url = node.getAttribute("data-url") || "";
  if (url) {
    ctx.fillStyle = style.getPropertyValue("--cz-faint") || "#6b7078";
    ctx.font = '500 11px ui-monospace, SFMono-Regular, Menlo, monospace';
    // bottom
    ctx.fillText(url, textX, height - pad);
  }

  // Taint check: toDataURL throws if tainted
  try {
    canvas.toDataURL("image/png");
  } catch {
    // Retry with flat placeholders only
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(scale, scale);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    for (let i = 0; i < 4; i++) {
      const [x, y0] = positions[i];
      ctx.fillStyle = inset;
      ctx.fillRect(x, y0, tileW, tileH);
    }
    // re-draw text without photos
    let yy = pad + 8;
    ctx.fillStyle = ink;
    ctx.font = '700 22px "Clash Grotesk", ui-sans-serif, system-ui, sans-serif';
    ctx.fillText("CREDENZA", textX, yy + 22);
    yy += 56;
    ctx.font = '600 28px "Clash Grotesk", ui-sans-serif, system-ui, sans-serif';
    if (title) ctx.fillText(title.slice(0, 40), textX, yy);
    yy += 40;
    if (landed) {
      ctx.fillStyle = style.getPropertyValue("--cz-money") || "#147a3a";
      ctx.font = '600 19px "Clash Grotesk", ui-sans-serif, system-ui, sans-serif';
      ctx.fillText(landed, textX, yy);
    }
    if (url) {
      ctx.fillStyle = style.getPropertyValue("--cz-faint") || "#6b7078";
      ctx.font = '500 11px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(url, textX, height - pad);
    }
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) reject(new Error("Could not make the image."));
      else resolve(blob);
    }, "image/png");
  });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function HaulShareSheet({
  haulName,
  items = [],
  previewDoc = null,
  shareUrl = "",
  signedIn = false,
  onBuildDoc,
  onCreate,
  onCopy,
  onClose,
}) {
  const [includes, setIncludes] = useState(() => ({ ...DEFAULT_HAUL_INCLUDES }));
  const [layout, setLayout] = useState("both");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState(shareUrl || "");
  const [showReddit, setShowReddit] = useState(false);
  const [redditMd, setRedditMd] = useState("");
  const [copiedMd, setCopiedMd] = useState(false);
  const embedRef = useRef(null);

  // A layout or include change needs a new frozen link (AGENT-NOTES answer 4).
  useEffect(() => {
    setLink("");
    setShowReddit(false);
    setRedditMd("");
  }, [includes, layout]);

  const count = Array.isArray(items) ? items.length : previewDoc && previewDoc.count ? previewDoc.count : 0;
  const cover =
    (items[0] && (items[0].image || (items[0].photos && items[0].photos[0]))) ||
    (previewDoc && previewDoc.items && previewDoc.items[0] && previewDoc.items[0].image) ||
    "";
  const landed =
    (previewDoc && previewDoc.landedUsd) ||
    null;
  const previewLanded = moneyLabel(landed);

  const mosaic = useMemo(() => {
    const urls = [];
    for (const item of items || []) {
      if (item.image) urls.push(item.image);
      if (Array.isArray(item.photos)) {
        for (const p of item.photos) if (p && !urls.includes(p)) urls.push(p);
      }
      if (urls.length >= 4) break;
    }
    while (urls.length < 4) urls.push("");
    return urls.slice(0, 4);
  }, [items]);

  const metaLine = useMemo(() => {
    const bits = [];
    if (count) bits.push(count + (count === 1 ? " ITEM" : " ITEMS"));
    if (previewDoc && previewDoc.agent) bits.push(String(previewDoc.agent).toUpperCase());
    if (previewDoc && previewDoc.shipLine) bits.push(String(previewDoc.shipLine).toUpperCase());
    if (previewDoc && previewDoc.orderedAt && previewDoc.receivedAt) {
      const d = daysBetween(previewDoc.orderedAt, previewDoc.receivedAt);
      if (d != null) bits.push(d + " D");
    }
    return bits.join(" · ");
  }, [count, previewDoc]);

  const toggleInclude = (key) => {
    setIncludes((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const ensureLink = async () => {
    if (link) return link;
    if (!onCreate || !onBuildDoc) throw new Error("Sharing is not ready.");
    const doc = onBuildDoc({ includes, layout });
    const url = await onCreate({ includes, layout, doc });
    setLink(url);
    return url;
  };

  const createLink = async () => {
    setBusy(true);
    setError("");
    try {
      if (!signedIn) {
        setError("Sign in to share. A share link needs an account.");
        return;
      }
      const url = await ensureLink();
      if (onCopy) await onCopy(url);
    } catch (err) {
      setError((err && err.message) || "The link could not be made.");
    } finally {
      setBusy(false);
    }
  };

  const copyReddit = async () => {
    setBusy(true);
    setError("");
    try {
      if (!signedIn) {
        setError("Sign in to share. A share link needs an account.");
        return;
      }
      const doc = onBuildDoc ? onBuildDoc({ includes, layout }) : previewDoc;
      const url = await ensureLink();
      const md = buildRedditHaulMarkdown(doc, url);
      setRedditMd(md);
      setShowReddit(true);
    } catch (err) {
      setError((err && err.message) || "Could not build the Reddit copy.");
    } finally {
      setBusy(false);
    }
  };

  const copyMarkdown = async () => {
    if (!redditMd) return;
    const ok = onCopy ? await onCopy(redditMd) : false;
    if (ok) {
      setCopiedMd(true);
      setTimeout(() => setCopiedMd(false), 1600);
    }
  };

  const saveImage = async () => {
    setBusy(true);
    setError("");
    try {
      const node = embedRef.current;
      if (!node) throw new Error("No card to save.");
      const blob = await nodeToPngBlob(node);
      const safe = String(haulName || "haul")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40);
      downloadBlob(blob, (safe || "haul") + "-card.png");
    } catch (err) {
      setError((err && err.message) || "Could not save the image.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell
      title="Share this haul"
      onClose={onClose}
      maxWidth={560}
      surfaceClassName="cz-haul-share-sheet"
    >
      <div className="cz-haul-share">
        {!signedIn ? (
          <div className="cz-haul-share-note">
            <div className="cz-haul-share-note-title">Sign in to share</div>
            <p className="cz-haul-share-note-body">
              A share link lives on our servers, so it needs an account. Your shelf stays on this
              device either way.
            </p>
          </div>
        ) : null}

        <div className="cz-haul-share-preview-row">
          <div className="cz-haul-share-preview-card">
            <div
              className="cz-haul-share-preview-photo"
              role="img"
              aria-label={haulName || "Haul cover"}
              style={
                cover
                  ? { backgroundImage: "url(\"" + String(cover).replace(/"/g, "") + "\")" }
                  : undefined
              }
            />
            <div className="cz-haul-share-preview-body">
              <div className="cz-haul-share-preview-title">{haulName || "Haul"}</div>
              <div className="cz-haul-share-preview-meta">
                {count} {count === 1 ? "ITEM" : "ITEMS"}
                {previewLanded ? " · " + previewLanded : ""}
              </div>
            </div>
          </div>
        </div>

        <div className="cz-haul-share-block">
          <div className="cz-haul-share-label">Include</div>
          <div className="cz-haul-share-chips" role="group" aria-label="Include">
            {HAUL_SHARE_INCLUDES.map((key) => (
              <button
                key={key}
                type="button"
                className={"cz-haul-share-chip" + (includes[key] ? " is-on" : "")}
                aria-pressed={!!includes[key]}
                onClick={() => toggleInclude(key)}
              >
                {INCLUDE_LABELS[key] || key}
              </button>
            ))}
          </div>
          <p className="cz-haul-share-caption">
            Tap to include. QC photos are off until you turn them on for this haul.
          </p>
        </div>

        <div className="cz-haul-share-block">
          <div className="cz-haul-share-label">How it opens</div>
          <SegmentedControl
            label="How it opens"
            value={layout}
            options={LAYOUT_OPTIONS}
            onChange={setLayout}
          />
          <p className="cz-haul-share-caption">{LAYOUT_HINTS[layout] || LAYOUT_HINTS.both}</p>
        </div>

        <div className="cz-haul-share-actions">
          <Pill primary style={{ flex: 1 }} disabled={busy || !signedIn} onClick={createLink}>
            {link ? "Copy link" : "Create link"}
          </Pill>
          <Pill disabled={busy || !signedIn} onClick={copyReddit}>
            Copy for Reddit
          </Pill>
          <Pill disabled={busy} onClick={saveImage}>
            Save image
          </Pill>
        </div>

        {link ? (
          <div className="cz-haul-share-link-box">
            <code className="cz-haul-share-link">{link}</code>
          </div>
        ) : null}

        {error ? <p className="cz-haul-share-error">{error}</p> : null}

        <p className="cz-haul-share-disclosure">
          The link is a copy, frozen when you make it. Anyone holding it can read the page.
        </p>

        {showReddit ? (
          <div className="cz-haul-share-reddit">
            <pre className="cz-haul-share-reddit-md">{redditMd}</pre>
            <Pill primary onClick={copyMarkdown}>
              {copiedMd ? "Copied" : "Copy markdown"}
            </Pill>
          </div>
        ) : null}

        <div className="cz-haul-share-embed-wrap">
          <div className="cz-haul-share-label">Embed card</div>
          <div
            ref={embedRef}
            className="cz-haul-embed"
            data-title={haulName || "Haul"}
            data-landed={previewLanded ? previewLanded + " landed" : ""}
            data-meta={metaLine}
            data-url={link || "credenzafashion.com/s/…"}
          >
            <div className="cz-haul-embed-mosaic" aria-hidden="true">
              {mosaic.map((src, i) => (
                <div
                  key={i}
                  className="cz-haul-embed-tile"
                  data-src={src || ""}
                  style={
                    src
                      ? { backgroundImage: "url(\"" + String(src).replace(/"/g, "") + "\")" }
                      : undefined
                  }
                />
              ))}
            </div>
            <div className="cz-haul-embed-copy">
              <div className="cz-haul-embed-brand">CREDENZA</div>
              <div className="cz-haul-embed-main">
                <div className="cz-haul-embed-title">{haulName || "Haul"}</div>
                {previewLanded ? (
                  <div className="cz-haul-embed-landed">{previewLanded} landed</div>
                ) : null}
                {metaLine ? <div className="cz-haul-embed-meta">{metaLine}</div> : null}
              </div>
              <div className="cz-haul-embed-url">{link || "credenzafashion.com/s/…"}</div>
            </div>
          </div>
        </div>
      </div>
    </ModalShell>
  );
}
