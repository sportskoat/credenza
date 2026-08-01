/**
 * Standalone item share-card generation.
 *
 * Public interfaces:
 *   buildItemShareModel(item, options?)
 *   renderItemSharePng(modelOrItem, options?, dependencies?)
 *   shareItemCard(modelOrItem, options?, dependencies?)
 *
 * `savedPrice` is deliberately preformatted by the caller. It may be supplied
 * on the item/model or in options; this small module does not import the app's
 * currency preferences. Browser services can be passed directly in options,
 * under `dependencies`/`deps`, or as the third argument.
 */

const CARD_WIDTH = 1200;
const CARD_HEIGHT = 1500;
const PNG_TYPE = "image/png";

const STATUS_LABELS = {
  want: "Want",
  bought: "Bought",
  shipped: "Shipped",
  qc: "Quality check",
  gl: "Approved · green light",
  rl: "Red light",
  returned: "Returned",
};

function cleanText(value, fallback = "") {
  if (value == null) return fallback;
  const text = String(value).replace(/\s+/g, " ").trim();
  return text || fallback;
}

function firstText(...values) {
  for (const value of values) {
    const text = cleanText(value);
    if (text) return text;
  }
  return "";
}

function firstGalleryImage(gallery) {
  if (!Array.isArray(gallery)) return "";
  return firstText(...gallery);
}

function formatWeight(value) {
  if (typeof value === "string" && value.trim() && !Number.isFinite(Number(value))) {
    return cleanText(value);
  }
  const grams = Number(value);
  if (!Number.isFinite(grams) || grams <= 0) return "";
  if (grams < 1000) return Math.round(grams) + " g";
  const kilos = Math.round(grams / 100) / 10;
  return String(kilos).replace(/\.0$/, "") + " kg";
}

function formatStatus(value, labels) {
  const status = cleanText(value);
  if (!status) return "";
  const map = labels && typeof labels === "object" ? labels : STATUS_LABELS;
  return cleanText(map[status], status);
}

/**
 * Reduce a shelf item to the fields that are allowed on a public share card.
 * Unknown fields are intentionally ignored, so notes, batch, QC photos and
 * internal IDs cannot leak into either the model or the image.
 */
export function buildItemShareModel(item = {}, options = {}) {
  const source = item && typeof item === "object" ? item : {};
  const opts = options && typeof options === "object" ? options : {};
  const factCandidates = [
    { label: "Size", value: firstText(source.size, source.recommendedSize) },
    { label: "Colourway", value: firstText(source.colorway, source.colourway, source.color) },
    { label: "Haul", value: firstText(source.project, source.haul, source.haulName) },
    {
      label: "Weight",
      value: firstText(source.weightLabel, formatWeight(source.weightGrams ?? source.weight)),
    },
    {
      label: "Status",
      value: formatStatus(
        source.findStatus ?? source.orderStatus ?? source.shareStatus,
        opts.statusLabels
      ),
    },
  ];

  return {
    masthead: cleanText(opts.masthead, "CREDENZA"),
    image: firstText(source.image, firstGalleryImage(source.gallery)),
    title: cleanText(source.title, "Untitled"),
    seller: cleanText(source.seller, "Saved item"),
    savedPrice: firstText(opts.savedPrice, source.savedPrice, source.priceLabel, "Price not saved"),
    facts: factCandidates.filter((fact) => fact.value).slice(0, 4),
    footer: cleanText(opts.footer, "Saved with Credenza · credenzafashion.com"),
  };
}

function mergedDependencies(options, dependencies) {
  const opts = options && typeof options === "object" ? options : {};
  const nested =
    (opts.dependencies && typeof opts.dependencies === "object" && opts.dependencies) ||
    (opts.deps && typeof opts.deps === "object" && opts.deps) ||
    {};
  return {
    ...opts,
    ...nested,
    ...(dependencies && typeof dependencies === "object" ? dependencies : {}),
  };
}

function isShareModel(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      Array.isArray(value.facts) &&
      Object.prototype.hasOwnProperty.call(value, "savedPrice") &&
      Object.prototype.hasOwnProperty.call(value, "masthead")
  );
}

function normalizedModel(value, options) {
  if (!isShareModel(value)) return buildItemShareModel(value, options);
  const allowedFacts = (Array.isArray(value.facts) ? value.facts : [])
    .map((fact) => ({
      label: cleanText(fact && fact.label),
      value: cleanText(fact && fact.value),
    }))
    .filter((fact) => fact.label && fact.value)
    .slice(0, 4);
  return {
    masthead: cleanText(value.masthead, "CREDENZA"),
    image: cleanText(value.image),
    title: cleanText(value.title, "Untitled"),
    seller: cleanText(value.seller, "Saved item"),
    savedPrice: cleanText(value.savedPrice, "Price not saved"),
    facts: allowedFacts,
    footer: cleanText(value.footer, "Saved with Credenza · credenzafashion.com"),
  };
}

function browserDocument(deps) {
  if (deps.documentImpl) return deps.documentImpl;
  if (deps.document) return deps.document;
  return typeof document !== "undefined" ? document : null;
}

function browserUrlApi(deps) {
  if (deps.urlApi) return deps.urlApi;
  if (deps.URLImpl) return deps.URLImpl;
  if (deps.URL) return deps.URL;
  return typeof URL !== "undefined" ? URL : null;
}

function createCanvasElement(deps) {
  const doc = browserDocument(deps);
  const factory = deps.createCanvas || deps.canvasFactory;
  const canvas = factory ? factory(CARD_WIDTH, CARD_HEIGHT, doc) : doc?.createElement("canvas");
  if (!canvas) throw new Error("Canvas is unavailable");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  return canvas;
}

function sameOriginSource(source, doc) {
  if (!doc?.location?.href) return false;
  try {
    const resolved = new URL(source, doc.location.href);
    return resolved.origin === doc.location.origin;
  } catch {
    return false;
  }
}

function isDirectSafeSource(source, doc) {
  if (typeof source !== "string") return false;
  if (/^(?:data:image\/|blob:)/i.test(source)) return true;
  if (/^(?:javascript|data:(?!image\/))/i.test(source)) return false;
  if (!/^[a-z][a-z\d+.-]*:/i.test(source)) return sameOriginSource(source, doc);
  return sameOriginSource(source, doc);
}

function blobConstructor(doc) {
  if (typeof Blob !== "undefined") return Blob;
  return doc?.defaultView?.Blob || null;
}

async function resolveImageSource(source, deps) {
  if (!source) return { source: null, cleanup: null };
  const doc = browserDocument(deps);
  if (typeof source !== "string") return { source, cleanup: null };

  if (isDirectSafeSource(source, doc)) return { source, cleanup: null };
  if (!/^https?:\/\//i.test(source)) return { source: null, cleanup: null };

  const resolver = deps.resolveImage || deps.imageResolver;
  if (typeof resolver !== "function") return { source: null, cleanup: null };
  const resolved = await resolver(source);
  if (!resolved) return { source: null, cleanup: null };

  const BlobImpl = blobConstructor(doc);
  if (BlobImpl && resolved instanceof BlobImpl) {
    const urlApi = browserUrlApi(deps);
    if (!urlApi?.createObjectURL || !urlApi?.revokeObjectURL) {
      return { source: null, cleanup: null };
    }
    const objectUrl = urlApi.createObjectURL(resolved);
    return {
      source: objectUrl,
      cleanup: () => urlApi.revokeObjectURL(objectUrl),
    };
  }

  if (typeof resolved === "object" && resolved.image) {
    return { source: resolved.image, cleanup: null };
  }

  if (typeof resolved === "object" && typeof resolved.src === "string") {
    if (resolved.safe === true || isDirectSafeSource(resolved.src, doc)) {
      return { source: resolved.src, cleanup: null };
    }
    return { source: null, cleanup: null };
  }

  if (isDirectSafeSource(resolved, doc)) return { source: resolved, cleanup: null };
  return { source: null, cleanup: null };
}

function defaultLoadImage(source, deps) {
  if (source && typeof source === "object") return Promise.resolve(source);
  const doc = browserDocument(deps);
  const ImageImpl = deps.ImageImpl || doc?.defaultView?.Image || globalThis.Image;
  if (!ImageImpl) return Promise.reject(new Error("Image loading is unavailable"));
  return new Promise((resolve, reject) => {
    const image = new ImageImpl();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Cover image could not be loaded"));
    image.src = source;
  });
}

async function loadSafeImage(source, deps) {
  let prepared;
  try {
    prepared = await resolveImageSource(source, deps);
  } catch {
    return null;
  }
  if (!prepared.source) return null;
  try {
    const loader = deps.loadImage || deps.imageLoader;
    return await (loader
      ? loader(prepared.source, { document: browserDocument(deps) })
      : defaultLoadImage(prepared.source, deps));
  } catch {
    return null;
  } finally {
    if (prepared.cleanup) prepared.cleanup();
  }
}

// Type and colour come from the design system (credenza.css tokens), not from
// ad-hoc picks: the display serif carries titles and prices, the brand sans
// carries labels, and data the eye scans (sizes, weights) sets in mono. An
// exported card is the brand in someone else's chat — Arial here read as a
// different company (Kyle 2026-07-27).
// Kyle 2026-07-31: DROP Georgia — Clash Grotesk for titles and body.
const FONT_DISPLAY = '"Clash Grotesk", Arial, ui-sans-serif, sans-serif';
const FONT_SANS = '"Clash Grotesk", Arial, ui-sans-serif, sans-serif';
const FONT_MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

const INK = "#17181a";
const MUTED = "#5c5f66";
const FAINT = "#8a857c";
const PAPER = "#f4f4f0";
const LINE = "#dcd9d0";
const ACCENT = "#4da3ff";

function setFont(ctx, weight, size, family = FONT_SANS) {
  ctx.font = weight + " " + size + "px " + family;
}

function measureWidth(ctx, text) {
  const measured = typeof ctx.measureText === "function" ? ctx.measureText(text) : null;
  return measured && Number.isFinite(measured.width) ? measured.width : text.length * 24;
}

function ellipsize(ctx, text, maxWidth) {
  const clean = cleanText(text);
  if (measureWidth(ctx, clean) <= maxWidth) return clean;
  let low = 0;
  let high = clean.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    const candidate = clean.slice(0, middle).trimEnd() + "…";
    if (measureWidth(ctx, candidate) <= maxWidth) low = middle;
    else high = middle - 1;
  }
  return clean.slice(0, low).trimEnd() + "…";
}

function wrapText(ctx, text, maxWidth, maxLines) {
  const words = cleanText(text).split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? line + " " + word : word;
    if (!line || measureWidth(ctx, candidate) <= maxWidth) {
      line = candidate;
      continue;
    }
    lines.push(line);
    line = word;
    if (lines.length === maxLines - 1) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  const consumed = lines.join(" ").length;
  if (consumed < cleanText(text).length && lines.length) {
    lines[lines.length - 1] = ellipsize(ctx, lines[lines.length - 1] + "…", maxWidth);
  }
  return lines;
}

function drawCover(ctx, image, x, y, width, height) {
  const sourceWidth = Number(image.naturalWidth || image.videoWidth || image.width);
  const sourceHeight = Number(image.naturalHeight || image.videoHeight || image.height);
  if (!(sourceWidth > 0 && sourceHeight > 0)) {
    ctx.drawImage(image, x, y, width, height);
    return;
  }
  const scale = Math.max(width / sourceWidth, height / sourceHeight);
  const cropWidth = width / scale;
  const cropHeight = height / scale;
  const sourceX = (sourceWidth - cropWidth) / 2;
  const sourceY = (sourceHeight - cropHeight) / 2;
  ctx.drawImage(image, sourceX, sourceY, cropWidth, cropHeight, x, y, width, height);
}

function drawPlaceholder(ctx, x, y, width, height) {
  ctx.fillStyle = "#eceae3";
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);
  ctx.fillStyle = FAINT;
  ctx.textAlign = "center";
  setFont(ctx, "600", 24);
  ctx.fillText("NO COVER IMAGE", x + width / 2, y + height / 2 + 8);
  ctx.textAlign = "left";
}

// The logo's mark, replayed from the same path data share-page.js prints in
// its header SVG: the dark rounded square, the serif C, the blue underline.
// Scaled from the 40×40 viewBox. Path2D keeps this one string, so the mark on
// the card can never drift from the mark on the site.
const MARK_C_PATH =
  "M21.30 27.80Q19.21 27.80 17.64 26.50Q16.07 25.20 15.21 22.84Q14.34 20.48 14.34 17.26Q14.34 14.15 15.29 11.81Q16.24 9.48 17.84 8.20Q19.43 6.91 21.39 6.91Q22.54 6.91 23.42 7.12Q24.30 7.33 24.98 7.67Q25.32 7.87 25.32 8.27L25.40 12.56Q25.40 13.04 25.06 13.04Q24.75 13.04 24.67 12.68L24.38 11.63Q23.79 9.43 23.01 8.58Q22.23 7.73 21.16 7.73Q19.18 7.73 17.87 10.17Q16.55 12.62 16.55 17.26Q16.55 20.42 17.21 22.60Q17.88 24.78 18.94 25.88Q20.00 26.98 21.19 26.98Q22.46 26.98 23.24 26.19Q24.02 25.40 24.55 23.14L24.89 21.75Q24.98 21.33 25.34 21.39Q25.66 21.44 25.66 21.87L25.54 26.45Q25.54 26.84 25.17 27.04Q24.50 27.38 23.58 27.59Q22.66 27.80 21.30 27.80Z";

function drawMark(ctx, x, y, size) {
  const scale = size / 40;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(0, 0, 40, 40, 12.4);
    ctx.fillStyle = "#0f1114";
    ctx.fill();
  } else {
    ctx.fillStyle = "#0f1114";
    ctx.fillRect(0, 0, 40, 40);
  }
  if (typeof Path2D === "function") {
    ctx.fillStyle = "#e9edf2";
    ctx.fill(new Path2D(MARK_C_PATH));
  }
  ctx.fillStyle = ACCENT;
  ctx.fillRect(11.03, 29.66, 17.93, 2.76);
  ctx.restore();
}

// Tracked type on canvas. letterSpacing lands in Chromium and Safari 17+;
// elsewhere the text sets untracked, which loses polish, not legibility.
function setTracking(ctx, px) {
  try {
    ctx.letterSpacing = px + "px";
  } catch {}
}

function drawModel(ctx, model, image) {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  // Header: mark + wordmark + kicker, the same lockup as the site header.
  drawMark(ctx, 80, 58, 46);
  ctx.fillStyle = INK;
  setFont(ctx, "800", 30);
  setTracking(ctx, 4);
  ctx.fillText(model.masthead, 146, 91);
  setTracking(ctx, 8);
  ctx.fillStyle = MUTED;
  setFont(ctx, "700", 13);
  ctx.fillText("FASHION", 147, 112);
  setTracking(ctx, 3);
  ctx.textAlign = "right";
  setFont(ctx, "600", 16);
  ctx.fillText("SAVED FIND", 1120, 91);
  ctx.textAlign = "left";
  setTracking(ctx, 0);

  const cover = { x: 80, y: 145, width: 1040, height: 720 };
  if (image) {
    if (typeof ctx.roundRect === "function") {
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(cover.x, cover.y, cover.width, cover.height, 20);
      ctx.clip();
      drawCover(ctx, image, cover.x, cover.y, cover.width, cover.height);
      ctx.restore();
    } else {
      drawCover(ctx, image, cover.x, cover.y, cover.width, cover.height);
    }
  } else {
    drawPlaceholder(ctx, cover.x, cover.y, cover.width, cover.height);
  }

  // Title in the display serif, full width. The price used to sit beside it
  // and squeeze it to 760px — two words and an ellipsis. It now shares the
  // seller row below, and the title gets the whole card.
  ctx.fillStyle = INK;
  setFont(ctx, "500", 56, FONT_DISPLAY);
  const titleLines = wrapText(ctx, model.title, 1040, 2);
  titleLines.forEach((line, index) => ctx.fillText(line, 80, 952 + index * 66));

  const rowY = titleLines.length > 1 ? 1083 : 1017;
  ctx.fillStyle = MUTED;
  setFont(ctx, "500", 26);
  ctx.fillText(ellipsize(ctx, model.seller, 640), 80, rowY);

  ctx.textAlign = "right";
  ctx.fillStyle = INK;
  setFont(ctx, "500", 44, FONT_DISPLAY);
  ctx.fillText(ellipsize(ctx, model.savedPrice, 340), 1120, rowY - 2);
  ctx.fillStyle = FAINT;
  setFont(ctx, "600", 15);
  setTracking(ctx, 3);
  ctx.fillText("SAVED PRICE", 1120, rowY + 30);
  setTracking(ctx, 0);
  ctx.textAlign = "left";

  const factsTop = 1176;
  const cellWidth = 500;
  const cellHeight = 112;
  model.facts.forEach((fact, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = 80 + column * 540;
    const y = factsTop + row * cellHeight;
    ctx.fillStyle = FAINT;
    setFont(ctx, "700", 15);
    setTracking(ctx, 2);
    ctx.fillText(fact.label.toUpperCase(), x, y);
    setTracking(ctx, 0);
    ctx.fillStyle = INK;
    // Mono is for data the eye scans (a size, a weight). A haul name or a
    // colorway is prose — it sets in the sans.
    const isData = fact.label === "Size" || fact.label === "Weight";
    setFont(ctx, isData ? "500" : "600", 27, isData ? FONT_MONO : FONT_SANS);
    ctx.fillText(ellipsize(ctx, fact.value, cellWidth), x, y + 40);
  });

  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(80, 1404);
  ctx.lineTo(1120, 1404);
  ctx.stroke();
  ctx.fillStyle = ACCENT;
  ctx.fillRect(80, 1402, 48, 6);
  ctx.fillStyle = MUTED;
  setFont(ctx, "500", 18);
  ctx.fillText(ellipsize(ctx, model.footer, 1040), 80, 1452);
}

function dataUrlToBlob(dataUrl, deps) {
  const doc = browserDocument(deps);
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/i.exec(dataUrl || "");
  if (!match) throw new Error("Canvas did not produce a PNG");
  const decoded = match[2]
    ? (doc?.defaultView?.atob || globalThis.atob)(match[3])
    : decodeURIComponent(match[3]);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index++) bytes[index] = decoded.charCodeAt(index);
  const BlobImpl = deps.BlobImpl || blobConstructor(doc);
  if (!BlobImpl) throw new Error("Blob is unavailable");
  return new BlobImpl([bytes], { type: match[1] || PNG_TYPE });
}

function canvasToPngBlob(canvas, deps) {
  if (typeof deps.canvasToBlob === "function") {
    return Promise.resolve(deps.canvasToBlob(canvas, PNG_TYPE));
  }
  if (typeof canvas.toBlob === "function") {
    return new Promise((resolve, reject) => {
      try {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas PNG generation failed"));
        }, PNG_TYPE);
      } catch (error) {
        reject(error);
      }
    });
  }
  if (typeof canvas.toDataURL === "function") {
    return Promise.resolve(dataUrlToBlob(canvas.toDataURL(PNG_TYPE), deps));
  }
  return Promise.reject(new Error("Canvas PNG export is unavailable"));
}

/**
 * Render a fixed 1200 × 1500 PNG Blob. Remote HTTP(S) covers are omitted
 * unless an injected resolver converts them to a safe source (for example a
 * data URL, Blob, or already-decoded image), preventing canvas taint.
 */
export async function renderItemSharePng(value, options = {}, dependencies = {}) {
  const deps = mergedDependencies(options, dependencies);
  const model = normalizedModel(value, options);
  const canvas = createCanvasElement(deps);
  const context = canvas.getContext?.("2d");
  if (!context) throw new Error("2D canvas is unavailable");
  const image = await loadSafeImage(model.image, deps);
  drawModel(context, model, image);
  const blob = await canvasToPngBlob(canvas, deps);
  if (!blob) throw new Error("Canvas PNG generation failed");
  return blob;
}

function sanitizedFilename(title, requested) {
  const supplied = cleanText(requested).replace(/\.png$/i, "");
  const base = supplied || "credenza-" + cleanText(title, "item");
  const normalized = base
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72)
    .replace(/-+$/g, "");
  return (normalized || "credenza-item") + ".png";
}

function makeFile(blob, filename, deps) {
  if (typeof deps.createFile === "function") {
    return deps.createFile(blob, filename, PNG_TYPE);
  }
  const doc = browserDocument(deps);
  const FileImpl = deps.FileImpl || deps.FileCtor || doc?.defaultView?.File || globalThis.File;
  if (!FileImpl) throw new Error("File is unavailable");
  return new FileImpl([blob], filename, { type: PNG_TYPE });
}

function nativeShareApi(deps) {
  if (deps.shareApi) return deps.shareApi;
  if (deps.navigatorImpl) return deps.navigatorImpl;
  if (deps.navigator) return deps.navigator;
  return typeof navigator !== "undefined" ? navigator : null;
}

function isAbortError(error) {
  return Boolean(error && (error.name === "AbortError" || error.code === 20));
}

function downloadBlob(blob, filename, deps) {
  if (typeof deps.download === "function") {
    return Promise.resolve(deps.download(blob, filename));
  }
  const doc = browserDocument(deps);
  const urlApi = browserUrlApi(deps);
  if (!doc?.createElement || !urlApi?.createObjectURL || !urlApi?.revokeObjectURL) {
    throw new Error("Download APIs are unavailable");
  }

  const objectUrl = urlApi.createObjectURL(blob);
  let anchor = null;
  try {
    anchor = doc.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    doc.body?.appendChild(anchor);
    anchor.click();
  } finally {
    if (anchor) {
      if (typeof anchor.remove === "function") anchor.remove();
      else if (anchor.parentNode) anchor.parentNode.removeChild(anchor);
    }
    const scheduleCleanup =
      typeof deps.scheduleCleanup === "function"
        ? deps.scheduleCleanup
        : (cleanup) => setTimeout(cleanup, 0);
    scheduleCleanup(() => urlApi.revokeObjectURL(objectUrl));
  }
}

/**
 * Generate once, then use Web Share with a PNG File when supported. Unsupported
 * sharing and non-cancellation share failures download that exact same Blob.
 *
 * @returns {Promise<'shared'|'downloaded'|'cancelled'|'failed'>}
 */
export async function shareItemCard(value, options = {}, dependencies = {}) {
  const deps = mergedDependencies(options, dependencies);
  const model = normalizedModel(value, options);
  const filename = sanitizedFilename(model.title, options.filename);

  let blob;
  try {
    blob = await renderItemSharePng(model, options, dependencies);
  } catch {
    return "failed";
  }

  const shareApi = nativeShareApi(deps);
  if (typeof shareApi?.canShare === "function" && typeof shareApi?.share === "function") {
    try {
      const file = makeFile(blob, filename, deps);
      const shareData = {
        files: [file],
        title: model.title,
        text: model.seller + " · " + model.savedPrice,
      };
      if (await shareApi.canShare({ files: shareData.files })) {
        try {
          await shareApi.share(shareData);
          return "shared";
        } catch (error) {
          if (isAbortError(error)) return "cancelled";
        }
      }
    } catch {
      // File construction or capability detection failed. Download remains
      // available and uses the already-generated Blob.
    }
  }

  try {
    await downloadBlob(blob, filename, deps);
    return "downloaded";
  } catch {
    return "failed";
  }
}
