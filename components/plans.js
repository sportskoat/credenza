// The one place that says what each tier gives you.
//
// Sign-in handoff README, "The plan spine this rests on". The README's own
// note calls the Free row an open product question and asks for the cap
// modal, the sign-in modal and the settings signed-out state to be revised
// together. This module IS that revision: every one of those surfaces reads
// its numbers from here, so they cannot drift apart again.
//
// Kyle 2026-08-02 ruling: a free account is a real step up, not a blank
// cheque. The README's "unlimited cards" is wrong against the shipped
// server, and the word "unlimited" describes no tier on any surface.
//
// The limits model, 2026-08-03: no daily resets anywhere. A signed-out
// device gets five free cards, then the sign-in wall. A free account adds
// eight cards and eight chart reads, and the allowance never resets. Pro
// refills each calendar month.
//
// Every number below is read from PLAN_CAPS or ANON_FREE_CARDS. Never type a
// cap here as a literal: plan-limits.test.js binds those two to the server
// tables, and a literal would escape that binding.
import { PLAN_CAPS } from "../preview/src/usage.js";
import { ANON_FREE_CARDS } from "../preview/src/limits.js";

// The three tiers, in the order a person meets them.
export const TIERS = {
  anon: {
    flag: "SIGNED OUT",
    cards: ANON_FREE_CARDS,
    cardsLine: ANON_FREE_CARDS + " free cards on this device",
  },
  free: {
    flag: "FREE",
    cards: PLAN_CAPS.free.resolveTotal,
    cardsLine:
      PLAN_CAPS.free.resolveTotal +
      " more cards and " +
      PLAN_CAPS.free.chartVisionTotal +
      " chart reads, and they never reset",
  },
  pro: {
    flag: "PRO",
    cards: PLAN_CAPS.pro.resolvePerMonth,
    cardsLine:
      PLAN_CAPS.pro.resolvePerMonth +
      " cards and " +
      PLAN_CAPS.pro.chartVisionPerMonth +
      " chart reads every month",
  },
};

// Body copy. Each string is the README's sentence with the card promise
// corrected to the shipped number. Sentence case, full stop, middle dot only.
export const PLAN_COPY = {
  // 1 · Cap modal body.
  capBody:
    "Signed out, Credenza holds " +
    ANON_FREE_CARDS +
    " free cards on this device. A free account adds " +
    PLAN_CAPS.free.resolveTotal +
    " more cards and " +
    PLAN_CAPS.free.chartVisionTotal +
    " chart reads, and the allowance never resets. Pro is a separate thing: it raises the monthly counters.",
  // 2 · Sign-in modal body.
  //
  // Kyle 2026-08-03: the old sentence fought itself. It promised the shelf
  // "back on a new phone" and then said the cards live on this device. Two
  // ideas, opposite feelings. One promise now: a spare copy, so a lost phone
  // costs nothing. "New phone" is gone from every plan surface.
  signInBody:
    "An account is free. It adds " +
    PLAN_CAPS.free.resolveTotal +
    " cards and " +
    PLAN_CAPS.free.chartVisionTotal +
    " chart reads, and the allowance never resets. Credenza keeps a spare copy of your shelf, so a lost phone costs you nothing.",
  // 3 · Free plan card body, on the upgrade route.
  // Kyle 2026-08-04: drop "No card. No trial clock." from every plan surface.
  freeCardBody:
    PLAN_CAPS.free.resolveTotal +
    " more cards and " +
    PLAN_CAPS.free.chartVisionTotal +
    " chart reads, the Reddit paste and the parcel planner in full.",
  // 4 · Settings, signed out.
  settingsSignedOutBody:
    "Credenza holds " +
    ANON_FREE_CARDS +
    " free cards on this device. An account is free, adds " +
    PLAN_CAPS.free.resolveTotal +
    " more cards and " +
    PLAN_CAPS.free.chartVisionTotal +
    " chart reads, and keeps a spare copy of your shelf.",
  // 5 · Account menu, the free row's sub-line.
  menuFreeSub: "Free · " + PLAN_CAPS.free.resolveTotal + " more cards",
};

/**
 * The nine "what changes" rows.
 *
 * README deviation, for the morning report: the README lists both "Cards from
 * a link" and "Link resolves". Those are one meter in this codebase, so the
 * second row would print the same number twice under two names. The duplicate
 * is replaced with "Cards on the shelf", which is the one thing that really
 * has no ceiling: the shelf is local, and Credenza never drops a card to make
 * room.
 */
export const PLAN_ROWS = [
  {
    label: "Cards from a link",
    note: "Signed out you get " + ANON_FREE_CARDS + " free cards.",
    free: PLAN_CAPS.free.resolveTotal + " total",
    pro: PLAN_CAPS.pro.resolvePerMonth + " a month",
  },
  {
    label: "Cards on the shelf",
    note: "Credenza never drops a card to make room.",
    free: "Every card",
    pro: "Every card",
  },
  {
    label: "AI size-chart reads",
    note: "One read of one size chart.",
    free: PLAN_CAPS.free.chartVisionTotal + " total",
    pro: PLAN_CAPS.pro.chartVisionPerMonth + " a month",
  },
  // Kyle 2026-08-02: "take out the ask questions on chart pricing claims
  // everywhere across the site". The Ask feature and its caps stay live. No
  // page sells it and no page prints a number, so no row appears here.
  {
    label: "Hauls at once",
    note: "Archiving a shipped haul frees a slot.",
    free: String(PLAN_CAPS.free.haulsMax),
    pro: String(PLAN_CAPS.pro.haulsMax),
  },
  {
    label: "QC photos an item",
    note: "Stored on the card.",
    free: String(PLAN_CAPS.free.qcPhotosPerItem),
    pro: String(PLAN_CAPS.pro.qcPhotosPerItem),
  },
  {
    label: "Shared haul links",
    note: "Unlisted, expiry and no footer on Pro.",
    free: String(PLAN_CAPS.free.sharedLinksMax),
    pro: String(PLAN_CAPS.pro.sharedLinksMax),
  },
  {
    label: "Your shelf on more than one device",
    note: "",
    free: "Restore only",
    pro: "Kept in step",
  },
  { label: "Spreadsheet export (.csv)", note: "", free: "No", pro: "Yes" },
];

export const PLAN_ROWS_NOTE =
  "Cards, Buy, the Reddit paste and the parcel planner are the same on both plans. This table lists what Credenza does today.";

// The two reassurance cards under the table.
export const PLAN_REASSURANCE = [
  {
    kicker: "YOUR SHELF",
    head: "Your cards stay yours.",
    body: "If Pro ends, nothing is deleted. Every card, haul and QC photo you already saved stays where it is. Only new additions go back to the free caps.",
  },
  {
    kicker: "BILLING",
    head: "Cancel whenever you want.",
    body: "Stripe handles the payment and the receipts. Change the plan or cancel from Settings · Account. Credenza never sees your card number.",
  },
];
