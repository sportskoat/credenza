# Brief for Claude Design: the haul steps page, round two

**From:** the repo side, 2026-08-08. **For:** the `Credenza Fashion Design System`
project — same place as the first haul screens (`Board as steps.html`).

**Job:** redraw the open-haul page. Keep the five-step spine. Fix the three
problems below. Produce a new mock beside the old haul screens.

---

## Why we are asking

The owner never opens this page. He built it and he avoids it.

We asked three outside models (GPT-5.6, Grok 4.5, Kimi K3) to score the page
for a first-time visitor. All three scored it 30 to 34 out of 100. All three
named the same problems, independently. This brief carries their agreed points.

The product strategy (docs/Monetization.md) says the moat is sizing accuracy,
the paste-a-haul flow, and community memory. The page must sell those. Today it
sells bookkeeping.

## What is wrong with the current page

**1. The parcel rail shows about twelve numbers at once.**
Actual grams, packaging grams, volumetric weight, a 5000/6000 divisor toggle,
chargeable weight, "billed at", three carrier lines with per-kg rates, an $8
floor note, and a tip box. A new visitor cannot tell which number matters.
On a fresh haul, most of them read `0 g` or `not yet`, so the rail is a wall
of zeros.

**2. Steps 1 and 2 are required manual bookkeeping.**
The user marks "ordered" and "arrived" in Credenza, then does the real ordering
on the agent's site anyway. The page asks for the same facts twice. That is the
single biggest reason the owner stays away. The valuable steps are 3, 4, and 5:
QC review, packing, and the hand-off instruction.

**3. Share is hidden.**
Share sits inside the ⋯ menu on the title row. But the shared haul page — with
its fit lines, QC photos, and one-click Reddit text — is how the product plans
to grow. The strongest feature on the page has the smallest control.

## What should change

**1. Calm the rail to two numbers.**
Show the chargeable (billed) weight and the price on the chosen line. Put one
quiet "More detail" control under them. The tap reveals the rest: actual and
packaging grams, volumetric weight, the divisor toggle, the other lines, the
floor note, the tip. On an empty haul, show one sentence instead of zeros:
say what the rail will show once an item is packed.

**2. Make steps 1 and 2 quiet and optional.**
One compact line each, with an "all ordered" / "all arrived" single tap.
Never a per-item checklist for these two. The page must never look blocked
because the user skipped the bookkeeping. Steps 3 to 5 keep their weight —
QC review stays the loudest thing on the page.

**3. Promote Share to the title row.**
A visible Share button beside the haul name. Keep the has-cards gate. The ⋯
menu keeps Set a budget and Archive.

**4. Give the empty haul one story.**
A fresh haul currently shows five step shells, an empty box, and zero maths.
Replace that with one short paragraph: what a haul does, and the one next
action. The rail stays hidden or folded until something is packed.

## Why (one line each)

- Two numbers is what a person decides with; twelve is what an agent computes with.
- Optional bookkeeping removes the double-work with the agent's site.
- Share is the growth engine; a growth engine needs a visible handle.
- An empty page teaches; a page of zeros warns people off.

## What must not change

- The five-stage vocabulary and the item state machine (see README.md here).
- The posture: a planner, not a store. Credenza never touches the agent.
- Tokens only. No raw hex, no raw px, no 4/8 grid rounding.
- The copy rules: ASD-STE100 plain English, no em dashes in rendered copy.
- No marketplace surface of any kind.

## Deliverable

One revised mock of the open-haul page, desktop, same fidelity as
`Board as steps.html`. Put it in the same group as the earlier haul screens.
Show three states: empty haul, haul mid-flight (some ordered, one QC waiting),
haul ready to hand off.

---

*Writing rule for anything the owner reads: ASD-STE100 Simplified Technical
English. Short sentences. Active voice. Name the effect he sees, not the
mechanism. He is not a programmer.*
