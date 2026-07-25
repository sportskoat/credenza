// Corpus report (Kyle, 2026-07-24): "go on FashionReps, look at 20 posts,
// see what comes out if you put them into Credenza." Runs every harvested
// post body (scripts/corpus-fashionreps.json, from harvest-fashionreps.mjs)
// through parseRedditHaul — the same parser the app runs — and prints what
// each post would become.
// Usage: node scripts/corpus-fashionreps.mjs
import { parseRedditHaul } from "../../reddit-haul.js";
import { marketplaceOf, agentOf } from "../../agents.js";
import { readFileSync } from "node:fs";

const corpus = JSON.parse(
  readFileSync(new URL("./corpus-fashionreps.json", import.meta.url), "utf8")
);

let totItems = 0,
  totLabeled = 0,
  totCategorized = 0,
  totAgent = 0,
  totMarketplace = 0,
  fellThrough = 0;

for (const p of corpus) {
  // Mirror the app: a fetched post arrives with its title and certain
  // provenance (credenza-fashion.jsx stashRedditHaul).
  const haul = parseRedditHaul(p.selftext, { title: p.title, fromPost: true });
  if (!haul) {
    fellThrough++;
    console.log(`FELL THROUGH | ${p.title.slice(0, 70)}`);
    continue;
  }
  const labeled = haul.items.filter((i) => i.label).length;
  const categorized = haul.items.filter((i) => i.category).length;
  const agents = haul.items.filter((i) => agentOf(i.url)).length;
  const market = haul.items.filter((i) => marketplaceOf(i.url)).length;
  totItems += haul.items.length;
  totLabeled += labeled;
  totCategorized += categorized;
  totAgent += agents;
  totMarketplace += market;
  console.log(
    `${String(haul.items.length).padStart(2)} items, ${labeled} labeled, ${categorized} categorized | ${p.title.slice(0, 56)}`
  );
  for (const i of haul.items.slice(0, 4)) {
    const kind = marketplaceOf(i.url) ? "mkt" : agentOf(i.url) ? "agent" : "other";
    console.log(
      `    [${(i.category || "-").padEnd(8)}] [${kind}] ${(i.label || "(no label)").slice(0, 44)} -> ${i.url.slice(0, 52)}`
    );
  }
  if (haul.items.length > 4) console.log(`    … +${haul.items.length - 4} more`);
}

console.log("—".repeat(60));
console.log(
  `posts: ${corpus.length}, parsed as hauls: ${corpus.length - fellThrough}, fell through to generic: ${fellThrough}`
);
console.log(
  `items: ${totItems}, labeled: ${totLabeled}, categorized: ${totCategorized}`
);
console.log(
  `primary urls: marketplace ${totMarketplace}, agent ${totAgent}, other ${totItems - totMarketplace - totAgent}`
);
