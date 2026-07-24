// ═══════════════════════════════════════════════════════════════════════════════
// fashion-gate.js — the shelf is fashion-only (Kyle 2026-07-23).
//
// A clipboard accident should not become a card. The gate sorts every stash
// into three buckets:
//   "raw"     — no URLs at all. Notes and Reddit chatter; always welcome.
//   "fashion" — a marketplace, Yupoo, buy-agent, or Reddit link is present.
//   "gated"   — URLs, but none of them fashion (news, video, music, random
//               shops). The app asks "Stash anyway?" before carding these.
//
// The gate never deletes text: raw pastes flow through untouched, and gated
// pastes keep their input so nothing is lost on a dismiss.
// ═══════════════════════════════════════════════════════════════════════════════

import { marketplaceOf } from "./agents.js";
import { deobfuscateUrls } from "./reddit-haul.js";

// Buy-agent fronts. Wider than the agents.js registry on purpose — a link
// through ANY agent is fashion intent, even one we have no URL templates for.
// (Mirrors KNOWN_AGENTS in reddit-haul.js.)
const AGENT_HOST_RE =
  /(^|\.)(superbuy|sugargoo|cssbuy|kakobuy|hoobuy|cnfans|mulebuy|acbuy|oopbuy|basetao|wegobuy|pandabuy|allchinabuy|joyabuy)\.[a-z.]{2,}$/i;

export function isFashionUrl(url) {
  if (marketplaceOf(url)) return true; // weidian / taobao / tmall / 1688 / yupoo
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return false;
  }
  // Reddit is where finds and hauls come from.
  if (/(^|\.)(reddit\.com|redd\.it)$/.test(host)) return true;
  return AGENT_HOST_RE.test(host);
}

// "fashion" | "raw" | "gated" — see the header comment.
export function fashionGateStatus(text) {
  const urls = deobfuscateUrls(text || "").match(/https?:\/\/[^\s<>"')\]]+/g) || [];
  if (urls.length === 0) return "raw";
  return urls.some(isFashionUrl) ? "fashion" : "gated";
}
