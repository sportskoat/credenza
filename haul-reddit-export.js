// haul-reddit-export.js: pure Reddit markdown for a frozen haul share doc.
// Spec: haul sharing handoff README §5 + AGENT-NOTES (raw store URLs only).

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return "";
  const pretty = Number.isInteger(n) ? String(n) : n.toFixed(2);
  return "$" + pretty;
}

function shortDate(iso) {
  if (typeof iso !== "string" || !iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.getUTCDate() + " " + monthsName(d.getUTCMonth());
}

function monthsName(index) {
  return MONTHS[index] || "";
}

function daySpan(orderedAt, receivedAt) {
  const a = new Date(orderedAt);
  const b = new Date(receivedAt);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  const ms = b.getTime() - a.getTime();
  if (ms < 0) return null;
  return Math.round(ms / 86400000);
}

function includesOn(doc, key) {
  return !!(doc && doc.includes && doc.includes[key]);
}

function headerLine(doc) {
  const title = (doc && doc.title) || "A Credenza haul";
  const count = Number(doc && doc.count);
  const countBit =
    Number.isFinite(count) && count > 0
      ? count + (count === 1 ? " item" : " items")
      : "";
  const landed = includesOn(doc, "prices") ? money(doc.landedUsd) : "";
  let bold = title;
  if (countBit && landed) bold = title + " — " + countBit + ", " + landed + " landed";
  else if (countBit) bold = title + " — " + countBit;
  else if (landed) bold = title + " — " + landed + " landed";

  const parts = ["**" + bold + "**"];
  if (doc && doc.agent) parts.push(doc.agent);

  const shipBits = [];
  if (doc && doc.shipLine) shipBits.push(doc.shipLine);
  if (includesOn(doc, "weights") && Number(doc.chargeableG) > 0) {
    shipBits.push(Math.round(doc.chargeableG) + " g chargeable");
  }
  if (shipBits.length) parts.push(shipBits.join(", "));

  const ordered = shortDate(doc && doc.orderedAt);
  const received = shortDate(doc && doc.receivedAt);
  const days = ordered && received ? daySpan(doc.orderedAt, doc.receivedAt) : null;
  const dateBits = [];
  if (ordered) dateBits.push("ordered " + ordered);
  if (received) {
    dateBits.push(
      "received " + received + (days != null ? " (" + days + " days)" : "")
    );
  }
  if (dateBits.length) parts.push(dateBits.join(", "));

  return parts.join(" · ");
}

function w2cCell(item) {
  const store = typeof item.storeUrl === "string" ? item.storeUrl : "";
  const album = typeof item.albumUrl === "string" ? item.albumUrl : "";
  if (store && album) return store + " · [album](" + album + ")";
  if (store) return store;
  if (album) return "[album](" + album + ")";
  return "";
}

function fitCell(item) {
  const short = item && item.fit && typeof item.fit.short === "string" ? item.fit.short.trim() : "";
  return short || "–";
}

function measureLine(doc) {
  const intro = typeof (doc && doc.intro) === "string" ? doc.intro : "";
  // Prefer the frozen profile measurements when the snapshot put them in intro.
  // Fall back to a profile object if a caller passes one on the doc.
  const profile = doc && doc.profile && typeof doc.profile === "object" ? doc.profile : null;
  const parts = [];
  if (profile) {
    const chest = Number(profile.chest);
    const waist = Number(profile.waist);
    const height = Number(profile.height);
    if (Number.isFinite(chest) && chest > 0) parts.push(Math.round(chest) + "cm chest");
    if (Number.isFinite(waist) && waist > 0) parts.push(Math.round(waist) + "cm waist");
    if (Number.isFinite(height) && height > 0) parts.push(Math.round(height) + "cm");
  } else {
    // Parse "…measurements: 98cm chest, 79cm waist, 178cm." from the intro.
    const match = intro.match(/measurements:\s*([^.]+)\./i);
    if (match) {
      const raw = match[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      for (const bit of raw) parts.push(bit);
    }
  }
  if (!parts.length) return "";
  return (
    "My measurements: " +
    parts.join(", ") +
    ". Every fit call is read off the seller's own chart."
  );
}

/**
 * Build the Reddit markdown for one frozen haul share document.
 * @param {object} doc buildHaulShareSnapshot output
 * @param {string} shareUrl hosted share URL (always the last line)
 * @returns {string}
 */
export function buildRedditHaulMarkdown(doc, shareUrl) {
  const url = typeof shareUrl === "string" ? shareUrl.trim() : "";
  const items = Array.isArray(doc && doc.items) ? doc.items : [];
  const showPrice = includesOn(doc, "prices");
  const showSeller = includesOn(doc, "sellers");
  const showW2c = includesOn(doc, "w2c");

  const cols = ["Item"];
  if (showPrice) cols.push("Price");
  cols.push("Size");
  cols.push("Fit");
  if (showSeller) cols.push("Seller");
  if (showW2c) cols.push("W2C");

  const lines = [];
  lines.push(headerLine(doc || {}));
  lines.push("");
  lines.push("| " + cols.join(" | ") + " |");
  lines.push("|" + cols.map(() => "---").join("|") + "|");

  for (const item of items) {
    const cells = [];
    cells.push((item && item.title) || "");
    if (showPrice) {
      const p = Number(item && item.priceUsd);
      cells.push(Number.isFinite(p) && p > 0 ? money(p) : "");
    }
    cells.push((item && item.size) || "");
    cells.push(fitCell(item));
    if (showSeller) cells.push((item && item.seller) || "");
    if (showW2c) cells.push(w2cCell(item || {}));
    lines.push("| " + cells.join(" | ") + " |");
  }

  lines.push("");
  const measures = measureLine(doc || {});
  if (measures) {
    lines.push(measures);
    lines.push("");
  }
  lines.push("Photos, notes and the full breakdown: " + url);
  return lines.join("\n");
}
