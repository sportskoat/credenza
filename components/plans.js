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
// server. anon-allowance.js gives a signed-out device 3 resolves a day and
// entitlements.js gives a free account 20. So Free says 20, and the word
// "unlimited" describes no tier on any surface.
//
// Every number below is read from PLAN_CAPS or ANON_FREE_CARDS. Never type a
// cap here as a literal: plan-limits.test.js binds those two to the server
// tables, and a literal would escape that binding.
import { PLAN_CAPS } from "../preview/src/usage.js";
import { ANON_FREE_CARDS } from "../preview/src/limits.js";

const perDay = (n) => n + " a day";

// The three tiers, in the order a person meets them.
export const TIERS = {
  anon: {
    flag: "SIGNED OUT",
    cards: ANON_FREE_CARDS,
    cardsLine: ANON_FREE_CARDS + " cards a day on this device",
  },
  free: {
    flag: "FREE",
    cards: PLAN_CAPS.free.resolvePerDay,
    cardsLine: perDay(PLAN_CAPS.free.resolvePerDay) + " and your shelf back on a new phone",
  },
  pro: {
    flag: "PRO",
    cards: PLAN_CAPS.pro.resolvePerDay,
    cardsLine: perDay(PLAN_CAPS.pro.resolvePerDay) + " and the daily AI counters raised",
  },
};

// Body copy. Each string is the README's sentence with the card promise
// corrected to the shipped number. Sentence case, full stop, middle dot only.
export const PLAN_COPY = {
  // 1 · Cap modal body.
  capBody:
    "Signed out, Credenza holds " +
    ANON_FREE_CARDS +
    " cards a day on this device. A free account raises that to " +
    PLAN_CAPS.free.resolvePerDay +
    " a day and keeps your shelf if the phone goes. Pro is a separate thing: it raises the daily AI counters.",
  // 2 · Sign-in modal body.
  signInBody:
    "An account is free. It raises the shelf to " +
    PLAN_CAPS.free.resolvePerDay +
    " cards a day and brings it back on a new phone. Your cards still live on this device.",
  // 3 · Free plan card body, on the upgrade route.
  freeCardBody:
    "No card. No trial clock. " +
    PLAN_CAPS.free.resolvePerDay +
    " cards a day, the Reddit paste and the parcel planner in full.",
  // 4 · Settings, signed out.
  settingsSignedOutBody:
    "Credenza holds " +
    ANON_FREE_CARDS +
    " cards a day on this device. An account is free, raises that to " +
    PLAN_CAPS.free.resolvePerDay +
    " a day, and brings the shelf back if the phone goes.",
  // 5 · Account menu, the free row's sub-line.
  menuFreeSub: "Free · " + perDay(PLAN_CAPS.free.resolvePerDay) + " cards",
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
    note: "Signed out you get " + ANON_FREE_CARDS + " a day.",
    free: perDay(PLAN_CAPS.free.resolvePerDay),
    pro: perDay(PLAN_CAPS.pro.resolvePerDay),
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
    free: perDay(PLAN_CAPS.free.chartVisionPerDay),
    pro: perDay(PLAN_CAPS.pro.chartVisionPerDay),
  },
  // Kyle 2026-08-02: "take out the ask questions on chart pricing claims
  // everywhere across the site". The Ask feature and its caps stay live. No
  // page sells it and no page prints a daily number, so no row appears here.
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
