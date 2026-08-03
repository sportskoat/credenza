# Morning report

Branch: `overnight/credenza-three-features`
Run start: 2026-08-01 night. Report written: 2026-08-02.

Nothing is deployed. Netlify has no link to this repo. Only you ship.

---

## Feature 1 · Onboarding fit flow — DONE

A new person opens a card and gets a size in two taps. No account. No network
call. No form.

What the person sees now:

1. A one-line strip at the top of the shelf explains the app. It goes away for
   good when the person dismisses it.
2. A cold card asks "What size do you usually buy?" and shows the size chips
   from that listing.
3. The next screen asks how the person likes clothes to sit: close, regular,
   roomy.
4. The card then shows the pick, the chart anchor, the garment number and the
   ease.
5. "Skip" hides both questions for the rest of the visit.
6. A fit ladder shows what is saved and what comes next. It asks for one
   number at a time, over weeks, never as a form.

Every gate passes: test, lint, typecheck, build.

Commits: `ae1df05`, `fb8d6ef`, `4a456f1`, `fa1c552`.

### Five decisions I made for you. Please confirm each one.

**1. I removed the "How should we size you?" chooser screen.**
The design brief says the first pick must take exactly two taps. The chooser
added a third tap and appears nowhere else in the brief. The tape-measure path
is still one tap away, from a link on the first screen.
Say "put the chooser back" if you disagree.

**2. The ease chips say "+0–5 cm", not "+2 cm".**
The brief prints +2, +6 and +12. The same brief calls those numbers a
designer's estimate that nobody validated. The live sizing engine uses ranges.
I kept the engine's real ranges so the chip never promises a number the pick
does not use.
Say "use the brief numbers" if you want the designer's estimate instead.

**3. I rewrote the long dashes in the brief's copy.**
CONTEXT.md bans the long dash (—) in anything a visitor reads. The brief uses
it. I replaced each one with a period or a comma. The words are otherwise
unchanged.

**4. I wrote four short phrases the brief does not supply.**
The fit ladder shows four rows. The brief only shows one filled example, so I
wrote the missing labels in the same voice:
- "Usual size · where you sit on the chart"
- "How you like it · which way to move off it"
- "Nothing saved yet" / "Bottoms are covered" / "Tops and bottoms covered"
Read these five phrases. Change any you dislike.

**5. The cm/in chips look 32px tall but respond over a 44px band.**
The brief draws them at 32px. The same brief demands 44px for a finger. Both
rules sit in the same document, so neither wins. I kept the small look and
grew the invisible tap area.

### Still open, from the brief itself

The brief's open question 1 is unanswered: the ease numbers need a check
against real size charts before launch. I did not have real charts to check
against. See decision 2.

---

## Feature 2 · Sign-in and Pro upgrade — IN PROGRESS

Status filled in below as work lands.

---

## Feature 3 · Haul fulfillment flow — NOT STARTED

---

## Run the next three commands in the morning

```
cd ~/credenza && git log --oneline main..overnight/credenza-three-features
cd ~/credenza/preview && npm run dev
cd ~/credenza && bash scripts/verify.sh all
```

The first command lists every change made overnight.
The second opens the app so you can look at it.
The third re-checks that all four gates still pass.
