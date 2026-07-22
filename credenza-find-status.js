// findStatus pipeline enum — single source of truth. The app layers display
// labels/colors on top (credenza-fashion.jsx); the Ask serializer validates
// against it (credenza-search-fashion.js). Status meanings: docs/Monetization.md §A3.
export const FIND_STATUSES = ["want", "bought", "shipped", "qc", "gl", "rl", "returned"];
