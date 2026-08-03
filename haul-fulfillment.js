/**
 * haul-fulfillment.js — pure logic for the haul fulfillment flow.
 * No DOM. No React. No network. Spec: design/handoffs/haul/README.md.
 *
 * Credenza never touches the agent. It does not take money, submit orders,
 * request returns, or poll tracking. Every stage transition is something the
 * person marks by hand. Where an action must happen on the agent's site, this
 * module writes the message and the person hands it over.
 *
 * Stage lives here, not on the shelf card's findStatus. findStatus lost its
 * seven-stage pipeline on 2026-07-28 because it asked every saved card to carry
 * shipping state and nobody kept it current. These five stages live inside an
 * open haul, on items the person already committed to buying, and each tap pays
 * off at once in QC review or in the parcel maths. Different surface, different
 * population. See credenza-find-status.js for the shelf ruling.
 */

/** The five stages one item moves through, in order. */
export const HAUL_STAGES = ["toOrder", "ordered", "warehouse", "qcd", "parcel"];

/** Unknown values fall back to the start of the line. */
export function normalizeStage(value) {
  return HAUL_STAGES.includes(value) ? value : "toOrder";
}

/** A QC verdict. Anything else means the person has not looked yet. */
export function normalizeVerdict(value) {
  return value === "green" || value === "red" ? value : null;
}

/**
 * Red-light reasons. Each carries an English and a Chinese clause. Agent
 * support staff read Chinese faster; the English half lets the person check
 * what they are about to send.
 */
export const RED_REASONS = [
  { key: "stitching", en: "the stitching is coming apart", zh: "走线开裂" },
  { key: "print off", en: "the print is off-centre", zh: "印花偏位" },
  { key: "wrong size", en: "the size sent is not the size ordered", zh: "尺码发错" },
  { key: "stain", en: "there is a stain on the fabric", zh: "有污渍" },
  { key: "wrong colour", en: "the colour does not match the listing", zh: "颜色不符" },
  { key: "damaged", en: "the item arrived damaged", zh: "有破损" },
];

/** Free warehouse storage window in days. Superbuy's number. */
export const STORAGE_DAYS = 90;

/** Void space between items in a packed box. The agent's box is never full. */
export const VOID_FACTOR = 1.18;

/** Default packaging mass added once the box holds anything. */
export const DEFAULT_PACKAGING_GRAMS = 140;

/** Volumetric divisors. The agent and the line decide which one applies. */
export const DIVISORS = [5000, 6000];

/**
 * Shipping lines. Rates are starting points the person edits. Agents change
 * them weekly, so never present one as if Credenza knows today's price.
 */
export const SHIPPING_LINES = [
  { key: "EMS", label: "EMS", rate: 13.1, transit: "7–14 d" },
  { key: "GD-EUB", label: "GD-EUB", rate: 15.4, transit: "10–20 d" },
  { key: "DHL", label: "DHL", rate: 22.3, transit: "3–6 d" },
];

/** The starting rate table, one entry per line. */
export function defaultRates() {
  const out = {};
  for (const line of SHIPPING_LINES) out[line.key] = line.rate;
  return out;
}

/** The floor the agent charges however light the box is. */
export const COST_FLOOR_USD = 8;

/** What the agent charges to move the goods inside China. The person edits it. */
export const DEFAULT_DOMESTIC_USD = 18.4;

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** The weight that counts: the agent's scale wins over the person's guess. */
export function itemShipGrams(item) {
  if (!item) return 0;
  return item.actual == null ? num(item.est) : num(item.actual);
}

/**
 * Read a saved card as a haul item. The card carries the person's own field
 * names; this module speaks the handoff's names. Keep the translation here, in
 * one tested place, rather than in every screen that needs it.
 *
 * `estGrams` and `priceUsd` come from the app's own estimator and currency
 * conversion, which this module cannot reach without pulling in the world.
 */
export function toHaulItem(card, { estGrams = null, priceUsd = null } = {}) {
  if (!card) return null;
  return {
    id: card.id,
    title: card.title || "",
    size: card.size || "",
    price: priceUsd == null ? 0 : num(priceUsd),
    platform: card.platform || "",
    est: estGrams == null ? num(card.weightGrams) : num(estGrams),
    actual: card.haulActualGrams == null ? null : num(card.haulActualGrams),
    vol: num(card.haulVolumeCm3),
    stage: normalizeStage(card.haulStage),
    qc: normalizeVerdict(card.haulVerdict),
    reason: card.haulReason || null,
    photos: Array.isArray(card.qcPhotos) ? card.qcPhotos.length : 0,
    storage: card.haulStorageDays == null ? null : num(card.haulStorageDays),
    order: card.haulOrderNo || "",
    when: card.haulStageAt || null,
    url: card.url || "",
  };
}

/**
 * The parcel calculator. The one piece of real domain logic in the feature.
 *
 * A red-lit item can never enter a parcel, so it never reaches these sums.
 */
export function parcelMaths({
  items = [],
  packagingGrams = DEFAULT_PACKAGING_GRAMS,
  divisor = 6000,
  rates = defaultRates(),
} = {}) {
  const inParcel = items.filter(
    (item) => item && normalizeStage(item.stage) === "parcel" && item.qc !== "red"
  );
  const goodsG = inParcel.reduce((total, item) => total + itemShipGrams(item), 0);
  const actualG = goodsG + (inParcel.length ? num(packagingGrams) : 0);
  const volCm3 = Math.round(inParcel.reduce((total, item) => total + num(item.vol), 0) * VOID_FACTOR);
  const safeDivisor = DIVISORS.includes(divisor) ? divisor : 6000;
  const volG = (volCm3 / safeDivisor) * 1000;
  const chargeableG = Math.max(actualG, volG);
  const billedKg = Math.max(0.5, Math.ceil(((chargeableG / 1000) * 2)) / 2);
  const headroomG = billedKg * 1000 - chargeableG;
  const costs = {};
  for (const key of Object.keys(rates || {})) {
    costs[key] = Math.max(COST_FLOOR_USD, num(rates[key]) * billedKg);
  }
  return {
    inParcel,
    count: inParcel.length,
    goodsG,
    actualG,
    volCm3,
    volG,
    divisor: safeDivisor,
    chargeableG,
    billedKg,
    headroomG,
    costs,
    goodsUsd: inParcel.reduce((total, item) => total + num(item.price), 0),
  };
}

/**
 * What the haul really costs, once the box is on its way: the goods in the
 * box, what the agent charged to move them inside China, and the international
 * line. This is the number to quote when someone asks what the haul cost.
 */
export function landedTotal({ maths, line = "EMS", domesticUsd = DEFAULT_DOMESTIC_USD } = {}) {
  if (!maths) return 0;
  const international = maths.costs && maths.costs[line] != null ? maths.costs[line] : 0;
  return num(maths.goodsUsd) + num(domesticUsd) + num(international);
}

/** One shipping cost, with the agent's floor applied. */
export function costOfLine(rate, billedKg) {
  return Math.max(COST_FLOOR_USD, num(rate) * num(billedKg));
}

function kg2(grams) {
  return (num(grams) / 1000).toFixed(2) + " kg";
}

function grams(value) {
  return Math.round(num(value)) + " g";
}

/**
 * Advice, not arithmetic. The numbers alone are homework; these sentences are
 * answers. Returns the tips that apply, in the order the panel shows them.
 */
export function parcelTips(maths, items = []) {
  const tips = [];
  if (!maths || !maths.count) {
    tips.push(
      "Two half-parcels almost always cost more than one full one. Fill the box before you ship it."
    );
    return tips;
  }
  if (maths.volG > maths.actualG * 1.12) {
    tips.push(
      "You're paying for air. Volumetric " +
        kg2(maths.volG) +
        " against " +
        kg2(maths.actualG) +
        " actual. Ask your agent to drop the shoe boxes and re-measure."
    );
  }
  if (maths.headroomG > 120) {
    tips.push("Billed at " + (maths.billedKg).toFixed(1) + " kg. " + grams(maths.headroomG) + " of headroom.");
    const waiting = items
      .filter(
        (item) =>
          item &&
          normalizeStage(item.stage) === "qcd" &&
          item.qc === "green" &&
          itemShipGrams(item) > 0
      )
      .sort((a, b) => itemShipGrams(a) - itemShipGrams(b));
    const lightest = waiting[0];
    if (lightest && itemShipGrams(lightest) <= maths.headroomG) {
      tips.push(
        "Your lightest green-lit item (" + grams(itemShipGrams(lightest)) + ") ships free."
      );
    }
  }
  return tips;
}

/** Counts per stage, plus the two numbers every screen asks for. */
export function stageCounts(items = []) {
  const counts = { toOrder: 0, ordered: 0, warehouse: 0, qcd: 0, parcel: 0 };
  for (const item of items) {
    if (!item) continue;
    counts[normalizeStage(item.stage)] += 1;
  }
  return counts;
}

/**
 * How many items are waiting on the person's green light. An item with no QC
 * photos cannot be reviewed yet, so it does not count. Marking an item arrived
 * brings its photos with it, so in practice every warehouse item counts.
 */
export function pendingQcCount(items = []) {
  return items.filter(
    (item) => item && normalizeStage(item.stage) === "warehouse" && num(item.photos) > 0
  ).length;
}

/**
 * The storage clock runs per item from its own arrival. The haul shows the
 * earliest expiry among items that are not yet in a parcel.
 */
export function earliestStorageDays(items = []) {
  const days = items
    .filter((item) => item && normalizeStage(item.stage) !== "parcel")
    .map((item) => item.storage)
    .filter((value) => Number.isFinite(value));
  return days.length ? Math.min(...days) : null;
}

/**
 * Which move the index card recommends. Derived from item and parcel state
 * only, never from which screen is showing. An early build gated the delivered
 * branch on the tracking screen, which the index can never be on, so the card
 * kept advertising a parcel that had already arrived.
 */
export function haulCta({ items = [], submitted = false, milestone = 0 } = {}) {
  const counts = stageCounts(items);
  const pendingQC = pendingQcCount(items);
  if (pendingQC > 0) {
    return {
      flag: pendingQC + " at QC",
      label: "Review QC · " + pendingQC,
      variant: "primary",
      to: "board",
      openQc: true,
    };
  }
  if (submitted && milestone >= 3) {
    return { flag: "Delivered", label: "Open", variant: "outline", to: "board", openQc: false };
  }
  if (submitted) {
    return {
      flag: "In transit",
      label: "Track parcel A",
      variant: "primary",
      to: "tracking",
      openQc: false,
    };
  }
  if (counts.parcel > 0) {
    return {
      flag: null,
      label: "Review & hand off",
      variant: "primary",
      to: "ship",
      openQc: false,
    };
  }
  if (counts.warehouse > 0) {
    return {
      flag: null,
      label: "Build the parcel",
      variant: "primary",
      to: "board",
      openQc: false,
    };
  }
  if (counts.toOrder > 0) {
    return { flag: null, label: "Start ordering", variant: "outline", to: "board", openQc: false };
  }
  return { flag: null, label: "Open", variant: "outline", to: "board", openQc: false };
}

/** The first item still waiting on a verdict. The QC shortcut opens on it. */
export function firstPendingQcItem(items = []) {
  return items.find((item) => item && normalizeStage(item.stage) === "warehouse") || null;
}

function money(value) {
  return "$" + num(value).toFixed(2);
}

/**
 * How few days of free storage make the haul urgent. The README shows an urgent
 * card at 6 days but never names the line. Two weeks is enough warning to order
 * the rest of the haul, and short enough that the red border still means
 * something. Change this number and the index changes with it.
 */
export const STORAGE_URGENT_DAYS = 14;

/** The cheapest and dearest line, for "~$33–56 to ship". */
export function shipRange(maths) {
  if (!maths || !maths.count) return null;
  const costs = Object.values(maths.costs || {});
  if (!costs.length) return null;
  const low = Math.round(Math.min(...costs));
  const high = Math.round(Math.max(...costs));
  return low === high ? "~$" + low : "~$" + low + "–" + high;
}

/**
 * Everything the index card shows: the flag, the note, the tone and the
 * recommended move. All of it is a projection of the items and the parcel.
 * Nothing here is stored. Cache any of it and the board and the index drift.
 */
export function haulIndexCard({
  items = [],
  submitted = false,
  milestone = 0,
  maths = null,
  line = "EMS",
  domesticUsd = DEFAULT_DOMESTIC_USD,
} = {}) {
  const counts = stageCounts(items);
  const cta = haulCta({ items, submitted, milestone });
  const pendingQC = pendingQcCount(items);
  const waiting = items.filter((item) => item && normalizeStage(item.stage) !== "parcel").length;
  const storageDays = earliestStorageDays(items);
  const urgentStorage =
    !submitted && storageDays != null && storageDays <= STORAGE_URGENT_DAYS && waiting > 0;

  let tone = "idle";
  let note = "Nothing ordered yet.";
  if (pendingQC > 0) {
    tone = "attention";
    note =
      pendingQC === 1
        ? "1 item is waiting on your green light."
        : pendingQC + " items are waiting on your green light.";
  } else if (urgentStorage) {
    tone = "urgent";
    note =
      "Free storage ends in " +
      storageDays +
      (storageDays === 1 ? " day on " : " days on ") +
      (waiting === 1 ? "1 item." : "all " + waiting + " items.");
  } else if (submitted && milestone >= 3) {
    tone = "done";
    note = "Delivered · " + money(landedTotal({ maths, line, domesticUsd })) + " landed.";
  } else if (submitted) {
    tone = "attention";
    note = "Parcel A is with " + line + " · " + kg2(maths ? maths.chargeableG : 0) + ".";
  } else if (counts.parcel > 0) {
    tone = "attention";
    const range = shipRange(maths);
    note = "Parcel A is ready" + (range ? " · " + range + " to ship." : ".");
  } else if (counts.qcd > 0) {
    // The README's CTA table has no branch for reviewed-but-unboxed, so the
    // move stays the table's fallback "Open". The note still says the truth.
    tone = "attention";
    note = "Everything is reviewed. Nothing in the box yet.";
  } else if (counts.warehouse > 0) {
    tone = "attention";
    note =
      counts.warehouse === 1
        ? "1 item is at the warehouse."
        : counts.warehouse + " items are at the warehouse.";
  } else if (counts.toOrder > 0) {
    note = counts.toOrder === 1 ? "1 item still to order." : counts.toOrder + " items still to order.";
  }

  // The flag is absent when there is nothing to say. An always-present badge is
  // noise. The storage clock only claims the badge when no branch above it did.
  let flag = cta.flag;
  if (!flag && counts.parcel > 0 && !submitted && maths) flag = kg2(maths.chargeableG);
  if (!flag && urgentStorage) flag = storageDays + " d left";

  return { ...cta, flag, tone, note, counts, pendingQC, storageDays };
}

/**
 * The stage bar: one segment per occupied stage, each as wide as its share of
 * the items. Progress reads as the bar filling with ink and finally going green.
 */
export function stageBar(items = []) {
  const counts = stageCounts(items);
  return HAUL_STAGES.filter((stage) => counts[stage] > 0).map((stage) => ({
    stage,
    count: counts[stage],
  }));
}

/** How many hauls are asking for something. The index header counts these. */
export function needsYouCount(cards = []) {
  return cards.filter((card) => card && (card.tone === "attention" || card.tone === "urgent"))
    .length;
}

/**
 * The red-light return request. Credenza writes it; the person sends it.
 *
 * The photo index is the one the person was looking at when they flagged the
 * item. That specificity is what makes the request actionable.
 */
export function returnMessage({ item, reason, photoIndex = 0 } = {}) {
  const clause = RED_REASONS.find((r) => r.key === reason) || RED_REASONS[0];
  const order = (item && item.order) || "";
  const title = (item && item.title) || "";
  const size = (item && item.size) || "";
  const n = Math.max(1, Math.round(num(photoIndex) + 1));
  const en =
    "Hi, please return order " +
    order +
    " (" +
    title +
    ", " +
    size +
    "). In QC photo " +
    n +
    ", " +
    clause.en +
    ".\nPlease request a replacement or a refund.";
  const zh =
    "你好，订单 " +
    order +
    " 需要退货：" +
    clause.zh +
    "（质检图第" +
    n +
    "张）。麻烦帮忙换货或退款，谢谢。";
  return en + "\n\n" + zh;
}

/** The parcel hand-off instruction. The person pastes it into the agent's form. */
export function handoffMessage({ items = [], line = "EMS", declared = 0 } = {}) {
  const packed = items.filter(
    (item) => item && normalizeStage(item.stage) === "parcel" && item.qc !== "red"
  );
  const n = packed.length;
  const head =
    n === 1
      ? "Please pack this item into one parcel:"
      : "Please pack these " + n + " items into one parcel:";
  const lines = packed.map(
    (item) => "· " + (item.order || "") + " · " + (item.title || "") + " (" + (item.size || "") + ")"
  );
  const en =
    head +
    "\n" +
    lines.join("\n") +
    "\n\nLine: " +
    line +
    ". Declared value: " +
    money(declared) +
    ". Remove shoe boxes and extra packaging.\nLeave everything else in storage.";
  const zh =
    "请将以上 " +
    n +
    " 件打包成一个包裹，走 " +
    line +
    "，申报价值 " +
    money(declared) +
    "。鞋盒和多余包装请去掉，其余商品继续存仓，谢谢。";
  return en + "\n\n" + zh;
}

/** Every unordered item's source link, ready for the agent's bulk-add box. */
export function unorderedLinks(items = []) {
  return items
    .filter((item) => item && normalizeStage(item.stage) === "toOrder")
    .map((item) => (item && item.url) || "")
    .filter(Boolean)
    .join("\n");
}

/**
 * The estimate delta, surfaced the moment the agent weighs the item. This
 * teaches better estimating and, added up, gives real per-category weight data.
 */
export function estimateDelta(item) {
  if (!item || item.actual == null || !Number.isFinite(num(item.est)) || num(item.est) <= 0) {
    return null;
  }
  const diff = Math.round(num(item.actual) - num(item.est));
  if (diff === 0) return null;
  const sign = diff > 0 ? "+" : "";
  return {
    diff,
    label:
      "Your estimate was " +
      (num(item.est) >= 1000 ? kg2(item.est) : grams(item.est)) +
      ". " +
      sign +
      diff +
      " g out.",
  };
}

/**
 * The QC queue for one haul: every item still waiting on a verdict, in shelf
 * order. The overlay walks this list, so "Next item →" and the counter agree
 * by construction.
 */
export function qcQueue(items = []) {
  return items.filter(
    (item) =>
      item &&
      normalizeStage(item.stage) === "warehouse" &&
      num(item.photos) > 0 &&
      // A ruled item is not waiting, whatever its stage says. Stage and verdict
      // are written together, but the queue must not double-count an item for
      // the frame between the two.
      normalizeVerdict(item.qc) == null
  );
}

/**
 * The running verdict tally for the overlay footer, over the whole haul.
 * `done` counts every item the person has already ruled on, so the counter
 * reads "QC review · 3 of 5 done" without a second pass.
 */
export function qcProgress(items = []) {
  let green = 0;
  let red = 0;
  for (const item of items) {
    if (!item) continue;
    if (item.qc === "green") green += 1;
    else if (item.qc === "red") red += 1;
  }
  const done = green + red;
  return { green, red, done, total: done + qcQueue(items).length };
}

/**
 * Seller reputation, free. QC verdicts are already per-item; grouping them by
 * seller costs nothing and is the most valuable byproduct in the feature.
 *
 * `items` here is the whole shelf, not one haul: a seller's record follows the
 * person across every haul they have ever run.
 */
export function sellerRecord(items = [], seller = "") {
  const key = String(seller || "").trim().toLowerCase();
  if (!key) return null;
  let green = 0;
  let red = 0;
  for (const item of items) {
    if (!item) continue;
    if (String(item.seller || "").trim().toLowerCase() !== key) continue;
    // Saved cards name the verdict `haulVerdict`; haul-shaped copies name it
    // `qc`. The seller only exists on the card, so the card shape is the one
    // that arrives here in practice. Read both, so neither caller is wrong.
    const verdict = normalizeVerdict(item.haulVerdict == null ? item.qc : item.haulVerdict);
    if (verdict === "green") green += 1;
    else if (verdict === "red") red += 1;
  }
  if (green + red === 0) return null;
  return {
    green,
    red,
    label:
      "This seller: " +
      green +
      " green, " +
      red +
      " red across your shelf.",
  };
}

/**
 * The four stage columns, in order, with the footer action each one offers.
 * The parcel is not here: it is the destination panel, not a stage column.
 */
export const BOARD_COLUMNS = [
  { key: "toOrder", label: "To order", footer: "Copy all links" },
  { key: "ordered", label: "Ordered", footer: null },
  { key: "warehouse", label: "At warehouse", footer: "Review all QC" },
  { key: "qcd", label: "QC done", footer: null },
];

/**
 * What one board card says under its title, and which action it offers.
 *
 * `tone` names the colour, it does not carry it: the screen owns the token.
 * The action is the single next move for that item at that stage. There is
 * never more than one, because a card with two buttons asks the person to
 * choose before they have looked at the photo.
 */
export function itemCardMeta(item, { storageClock = true } = {}) {
  if (!item) return null;
  const stage = normalizeStage(item.stage);
  const weight = grams(itemShipGrams(item));
  if (stage === "toOrder") {
    return { meta: "not ordered · est. " + weight, tone: "faint", action: "Copy link" };
  }
  if (stage === "ordered") {
    const when = item.when ? " · " + item.when : "";
    return { meta: (item.order || "ordered") + when, tone: "faint", action: "Mark arrived" };
  }
  if (stage === "warehouse") {
    const clock = storageClock && item.storage != null ? " · " + item.storage + " d left" : "";
    return {
      meta: weight + " actual" + clock,
      tone: "faint",
      action: "Review QC · " + num(item.photos),
    };
  }
  if (stage === "qcd") {
    const green = normalizeVerdict(item.qc) === "green";
    return {
      meta: green ? "green · " + weight : "red · " + (item.reason || "flagged"),
      tone: green ? "money" : "error",
      action: green ? "Add to parcel" : "Return message",
    };
  }
  return { meta: weight, tone: "faint", action: null };
}

/** The board's four columns, filled. A column with no items offers no footer. */
export function boardColumns(items = [], options = {}) {
  return BOARD_COLUMNS.map((column) => {
    const list = items.filter((item) => item && normalizeStage(item.stage) === column.key);
    return {
      key: column.key,
      label: column.label,
      count: list.length,
      items: list.map((item) => ({ item, ...itemCardMeta(item, options) })),
      footerLabel: list.length ? column.footer : null,
    };
  });
}

/**
 * The storage sentence on the board's summary strip. The agent holds items free
 * for ninety days from arrival, so the clock the person must watch is the
 * oldest item still outside a parcel.
 */
export function storageLine(items = []) {
  const days = earliestStorageDays(items);
  if (days == null) return "Nothing is sitting at the warehouse on a clock.";
  return (
    "Free storage ends in " +
    days +
    " days on your oldest item at the warehouse. Your agent holds 90 days. " +
    "The clock starts on arrival, not on ship."
  );
}
