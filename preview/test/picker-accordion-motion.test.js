/**
 * Kyle 2026-08-02 item 9 — Status/Haul/Colorway/Weight/Category list pickers
 * and Settings buying-agent use transitions.dev t-acc. Pins durations, ease,
 * grid-rows 0fr↔1fr, chevron flip, and reduced-motion.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const FASHION_CSS = readFileSync(join(root, "credenza-fashion.css"), "utf8");
const CMD_BAR = readFileSync(join(root, "components/CommandBar.jsx"), "utf8");
const DETAIL_BODY = readFileSync(join(root, "components/DetailBody.jsx"), "utf8");

function accBlock() {
  const start = FASHION_CSS.indexOf("/* ─── Accordion (transitions.dev t-acc)");
  expect(start).toBeGreaterThan(-1);
  return FASHION_CSS.slice(start, start + 1800);
}

describe("picker accordion motion (t-acc)", () => {
  it("pins expand/collapse/chevron duration and ease on :root", () => {
    const block = accBlock();
    expect(block).toMatch(/--acc-expand:\s*250ms/);
    expect(block).toMatch(/--acc-collapse:\s*250ms/);
    expect(block).toMatch(/--acc-chevron:\s*250ms/);
    expect(block).toMatch(
      /--acc-ease:\s*cubic-bezier\(\s*0\.22\s*,\s*1\s*,\s*0\.36\s*,\s*1\s*\)/
    );
  });

  it("animates the panel via grid-template-rows 0fr ↔ 1fr", () => {
    const block = accBlock();
    expect(block).toMatch(
      /\.t-acc-panel\s*\{[^}]*grid-template-rows:\s*0fr/s
    );
    expect(block).toMatch(
      /\.t-acc\[data-open="true"\]\s+\.t-acc-panel\s*\{[^}]*grid-template-rows:\s*1fr/s
    );
    expect(block).toMatch(
      /grid-template-rows\s+var\(--acc-collapse\)\s+var\(--acc-ease\)/
    );
    expect(block).toMatch(
      /grid-template-rows\s+var\(--acc-expand\)\s+var\(--acc-ease\)/
    );
  });

  it("fades + unblurs the panel inner on the same clock", () => {
    const block = accBlock();
    expect(block).toMatch(
      /\.t-acc-panel-inner\s*\{[^}]*opacity:\s*0[^}]*filter:\s*blur\(2px\)/s
    );
    expect(block).toMatch(
      /\.t-acc\[data-open="true"\]\s+\.t-acc-panel-inner\s*\{[^}]*opacity:\s*1[^}]*filter:\s*blur\(0\)/s
    );
  });

  it("flips the chevron with scaleY and non-scaling stroke", () => {
    const block = accBlock();
    expect(block).toMatch(
      /\.t-acc-chevron\s*\{[^}]*transform:\s*scaleY\(1\)[^}]*transform-origin:\s*center/s
    );
    expect(block).toMatch(
      /\.t-acc\[data-open="true"\]\s+\.t-acc-chevron\s*\{[^}]*scaleY\(-1\)/s
    );
    expect(block).toMatch(
      /\.t-acc-chevron path\s*\{\s*vector-effect:\s*non-scaling-stroke/
    );
    expect(block).toMatch(
      /transform\s+var\(--acc-chevron\)\s+var\(--acc-ease\)/
    );
  });

  it("zeros transitions under prefers-reduced-motion on panel, inner, chevron", () => {
    const block = accBlock();
    expect(block).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\.t-acc-panel,\s*\.t-acc-panel-inner,\s*\.t-acc-chevron\s*\{[^}]*transition:\s*none\s*!important/s
    );
  });

  it("list pickers expand in place (no floating Popover on list layout)", () => {
    expect(CMD_BAR).toMatch(/layout === "list"/);
    expect(CMD_BAR).toMatch(/inlinePanels/);
    expect(CMD_BAR).toMatch(/className="cz-cmdbar-list-slot t-acc"/);
    expect(CMD_BAR).toMatch(/t-acc-panel/);
    // List path must not mount Popover for the five rows.
    const listStart = CMD_BAR.indexOf('if (layout === "list")');
    expect(listStart).toBeGreaterThan(-1);
    const listEnd = CMD_BAR.indexOf("return (", listStart + 20);
    // Find the list branch return ... closing before chip layout return.
    const listReturn = CMD_BAR.indexOf("return (", listStart);
    const nextTopReturn = CMD_BAR.indexOf("\n  return (", listReturn + 1);
    const listBranch = CMD_BAR.slice(listStart, nextTopReturn > 0 ? nextTopReturn : listStart + 4000);
    expect(listBranch).not.toMatch(/<Popover/);
    expect(listBranch).toMatch(/t-acc-chevron/);
  });

  it("Settings buying-agent uses SettingsAgentAccordion (collapsed = current only)", () => {
    expect(DETAIL_BODY).toMatch(/function SettingsAgentAccordion/);
    expect(DETAIL_BODY).toMatch(/className="t-acc cz-agent-acc"/);
    expect(DETAIL_BODY).toMatch(/cz-agent-acc-head-value/);
    expect(DETAIL_BODY).toMatch(/<SettingsAgentAccordion/);
    // Full always-open list is gone from the Settings block.
    expect(DETAIL_BODY).not.toMatch(/className="cz-desk-agent-list"/);
  });

  // Kyle 2026-08-02 NO on #71 frames: one rounded card per picker, not a
  // hairline list with a second bordered body box under the open row.
  it("list pickers are one card per slot (no outer shell, no second body box)", () => {
    const listShell = FASHION_CSS.match(
      /\.cz-cmdbar\.cz-cmdbar-list\s*\{[^}]+\}/
    );
    expect(listShell, "list shell rule").not.toBeNull();
    expect(listShell[0]).toMatch(/border:\s*0/);
    expect(listShell[0]).toMatch(/gap:\s*8px/);
    // Room under Category so the bottom edge is not flush against HISTORY.
    expect(listShell[0]).toMatch(/margin-bottom:\s*12px/);

    const slotCard = FASHION_CSS.match(
      /\.cz-cmdbar-list-slot\.t-acc\s*\{[^}]+\}/
    );
    expect(slotCard, "slot card rule").not.toBeNull();
    expect(slotCard[0]).toMatch(/border:\s*1px solid/);
    expect(slotCard[0]).toMatch(/border-radius:\s*12px/);
    expect(slotCard[0]).toMatch(/overflow:\s*hidden/);

    const body = FASHION_CSS.match(/\.cz-cmdbar-list-acc-body\s*\{[^}]+\}/);
    expect(body, "acc body rule").not.toBeNull();
    expect(body[0]).toMatch(/border:\s*0/);
    expect(body[0]).not.toMatch(/border:\s*1px/);
    expect(body[0]).toMatch(/background:\s*transparent/);
    expect(body[0]).toMatch(/margin:\s*0/);

    // Legacy hairline-list killer must stay gone — it zeroed Category's
    // bottom edge (same specificity as the t-acc card, later in the file).
    expect(FASHION_CSS).not.toMatch(
      /\.cz-cmdbar-list-slot:last-child\s*\{\s*border-bottom:\s*0/
    );
  });

  it("Settings agent accordion is one container (rows inside, no per-row boxes)", () => {
    const agent = FASHION_CSS.match(/\.cz-agent-acc\s*\{[^}]+\}/);
    expect(agent, "agent acc rule").not.toBeNull();
    expect(agent[0]).toMatch(/border:\s*1px solid/);
    expect(agent[0]).toMatch(/border-radius:\s*12px/);
    expect(agent[0]).toMatch(/overflow:\s*hidden/);

    const head = FASHION_CSS.match(/\.cz-agent-acc-head\s*\{[^}]+\}/);
    expect(head, "agent head rule").not.toBeNull();
    expect(head[0]).toMatch(/border:\s*0/);

    const row = FASHION_CSS.match(/\.cz-agent-acc-row\s*\{[^}]+\}/);
    expect(row, "agent row rule").not.toBeNull();
    expect(row[0]).toMatch(/border:\s*0/);
  });
});
