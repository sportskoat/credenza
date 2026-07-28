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
    { label: "Colorway", value: firstText(source.colorway, source.colourway, source.color) },
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
    footer: cleanText(opts.footer, "Saved with Credenza · credenza.app"),
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
    footer: cleanText(value.footer, "Saved with Credenza · credenza.app"),
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

function setFont(ctx, weight, size, family = "Arial, sans-serif") {
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
  ctx.fillStyle = "#dedbd3";
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = "#c6c1b7";
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, width, height);
  ctx.fillStyle = "#77736b";
  ctx.textAlign = "center";
  setFont(ctx, "600", 24);
  ctx.fillText("NO COVER IMAGE", x + width / 2, y + height / 2 + 8);
  ctx.textAlign = "left";
}

function drawModel(ctx, model, image) {
  ctx.fillStyle = "#f5f2ea";
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.fillStyle = "#171714";
  setFont(ctx, "800", 34);
  ctx.fillText(model.masthead, 80, 91);
  ctx.fillStyle = "#6f6a61";
  setFont(ctx, "600", 18);
  ctx.fillText("ITEM CARD", 940, 89);

  const cover = { x: 80, y: 145, width: 1040, height: 720 };
  if (image) drawCover(ctx, image, cover.x, cover.y, cover.width, cover.height);
  else drawPlaceholder(ctx, cover.x, cover.y, cover.width, cover.height);

  ctx.fillStyle = "#171714";
  setFont(ctx, "700", 58);
  const titleLines = wrapText(ctx, model.title, 760, 2);
  titleLines.forEach((line, index) => ctx.fillText(line, 80, 952 + index * 64));

  ctx.fillStyle = "#6f6a61";
  setFont(ctx, "500", 25);
  ctx.fillText(ellipsize(ctx, model.seller, 740), 80, titleLines.length > 1 ? 1083 : 1019);

  ctx.fillStyle = "#171714";
  ctx.textAlign = "right";
  setFont(ctx, "800", 42);
  ctx.fillText(ellipsize(ctx, model.savedPrice, 300), 1120, 957);
  ctx.fillStyle = "#6f6a61";
  setFont(ctx, "600", 17);
  ctx.fillText("SAVED PRICE", 1120, 991);
  ctx.textAlign = "left";

  const factsTop = 1160;
  const cellWidth = 500;
  const cellHeight = 112;
  model.facts.forEach((fact, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = 80 + column * 540;
    const y = factsTop + row * cellHeight;
    ctx.fillStyle = "#8a857c";
    setFont(ctx, "700", 16);
    ctx.fillText(fact.label.toUpperCase(), x, y);
    ctx.fillStyle = "#171714";
    setFont(ctx, "600", 29);
    ctx.fillText(ellipsize(ctx, fact.value, cellWidth), x, y + 39);
  });

  ctx.strokeStyle = "#cbc6bc";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(80, 1404);
  ctx.lineTo(1120, 1404);
  ctx.stroke();
  ctx.fillStyle = "#6f6a61";
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
