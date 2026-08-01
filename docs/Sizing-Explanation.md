# Sizing Explanation

Written for Kyle. Plain English. Verified against the code at commit `2d3c70e` on 2026-08-01.

## Correction to an earlier answer

On 2026-08-01, O told Kyle that shoulder, sleeve, body length, and trouser
length were saved but not used by the size picker. That was wrong. The size
picker (`recommendSize` in `credenza-fashion.jsx:1221-1498`) already reads
all four. This file replaces that earlier answer.

## What each measurement does to a size pick

### Chest, waist, hip — the main pick
The engine picks the size row whose chest (or waist, for pants) is closest
to your number plus a "room" allowance. This is the main decision.
Source: `credenza-fashion.jsx:1265-1293`.

### Shoulder — a penalty, not a veto
Once a size is in the running on chest, the engine checks the chart's
shoulder number against yours. Too far off adds a penalty to that size's
score, so a closer-shouldered size can win even with an equal chest.
On a shirt with a set-in sleeve (the seam sits at the edge of your
shoulder) and a gap bigger than 3cm, the engine adds a heavy extra
penalty — that shoulder is treated as close to a reject.
Drop-shoulder and raglan cuts skip this check entirely, because those
styles hang past the shoulder on purpose; a mismatch there is not a
fit problem.
Source: `credenza-fashion.jsx:1327-1332`, `1301-1303`.

*Why this matters (web research):* a shoulder seam that lands past your
actual shoulder bone drags the sleeve down and adds bunched fabric at the
armhole. A seam that lands short pulls tight across the top of the arm and
restricts movement. Shoulder is the fit point apparel guides call hardest
to alter after purchase — unlike a waist or hem, it cannot be taken in or
let out without a full re-cut. That is why the engine treats it as
expensive to get wrong.

### Sleeve — a one-directional penalty
The engine only penalizes a sleeve that is shorter than your arm. A long
sleeve costs nothing, because a long sleeve can be rolled or cuffed; a
short sleeve cannot be fixed.
Source: `credenza-fashion.jsx:1334`.

*Why this matters:* the standard rule (menswear fit guides) is a sleeve
should reach the wrist break, with roughly half an inch showing past a
jacket cuff. Short sleeves read as "outgrown"; long sleeves read as an
intentional, correctable style choice.

### Body/shirt length — a tie-breaker, not a weight
Length never overrides the chest. It only steps in when two or more sizes
already fit the chest equally well — then the one closer to your saved
length wins. Kyle set this rule on 2026-07-30: length breaks ties, it does
not trade away a good chest fit for a good hem.
Source: `credenza-fashion.jsx:1355-1414`.

### Trouser / shorts length — informational only
For pants and shorts, the engine compares the chart's leg length to your
saved trouser or shorts length, but this comparison never changes the
picked size — waist decides that. It only powers the informational note
shown with the pick (e.g., "this size's leg length is 3cm longer than what
you saved").
Source: `credenza-fashion.jsx:1444-1448`.

*Why this matters:* leg length is mostly a function of leg-to-torso ratio,
which varies by person independent of waist size — two people with the same
waist can need different inseams. Showing the gap, rather than acting on
it, avoids the engine silently overriding a waist-driven pick over a
proportion difference it cannot fully judge (hem, cuff, tailoring habits
all vary by buyer).

## Where these fields are saved

`sheets/BodyProfileSheet.jsx:19-28` — the Sizes and Measurements page saves
exactly: `chest`, `shoulder`, `sleeve`, `length`, `waist`, `hip`,
`pantsLength`, `shortsLength`. Every one of these keys is read by
`recommendSize`. Nothing collected on that page is currently dead.

## Sources

- [Shoulder-to-Shoulder Fit: Essential Clothing Measurement](https://blog.waveplm.com/how-to-measure-shoulders-decoding-an-essential-clothing-measurement/)
- [How to Measure Shoulder Width for a Shirt](https://taperedmenswear.com/blogs/tapered-blog/how-to-measure-shoulder-width-for-a-shirt)
- [How to Properly Measure Sleeve Length](https://www.masterclass.com/articles/how-to-properly-measure-sleeve-length)
- [3 Ways Dropped Shoulders Reshape Fit, Drape and Silhouette Versus Inset Sleeves](https://lociwear.com/blogs/news/3-ways-dropped-shoulders-reshape-fit-drape-and-silhouette-versus-inset-sleeves)
- [How to Spec a Garment with Points of Measure](https://www.delogue.com/en/blog/how-to-spec-a-garment-with-point-of-measures)
- [Free Torso Length Calculator — Body Proportion Guide](https://www.ultimatefinancecalculator.com/calculators/torso-length-calculator)
- [How to Measure Your Inseam: The Complete Guide](https://www.nathantailors.com/guides/how-to-measure-inseam)
