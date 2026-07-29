// findStatus enum — single source of truth. The app layers display labels on
// top (credenza-fashion.jsx); the Ask serializer validates against it
// (credenza-search-fashion.js).
//
// Two values only (shelf handoff 2026-07-28, Kyle's call). The old seven-stage
// pipeline — want / bought / shipped / qc / gl / rl / returned — asked the
// customer to keep a shipping database up to date by hand, and nobody does.
// A card answers one question now: did you buy it, or not? Everything the
// pipeline used to carry lives where it is actually true — the QC photos on
// the card, the parcel weight on the haul.
export const FIND_STATUSES = ["want", "bought"];

// Old values → the two that remain. Anything past "bought" was bought.
export function normalizeFindStatus(value) {
  return value === "bought" ||
    value === "shipped" ||
    value === "qc" ||
    value === "gl" ||
    value === "rl" ||
    value === "returned"
    ? "bought"
    : "want";
}
