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

## Feature 2 · Sign-in and Pro upgrade — DONE

All five screens in the design brief are built. Every gate passes: test, lint,
typecheck, build.

Commits: `5e2658d`, `9b487e4`, `2460e2b`, `d342390`, `e779a1f`, `5f6af6b`,
`98abf1a`, `1e63e99`, `4a9c6f8`.

What the person sees now:

1. One sign-in door. It offers email, Google and Apple. There is no separate
   "create account" step. A new email makes the account.
2. A signed-out person who hits the daily card limit gets a small card that
   names the limit and offers the free way out first.
3. Pro has its own address, `/upgrade`. You can send someone straight to it.
4. The account menu is two doors: one for the account, one for Pro.
5. The Settings account section reports the plan. It no longer sells it.
6. After sign-in the person comes back to what they were doing. A blocked card
   gets made. The Pro page reopens with the billing period they picked.
7. Every "See Pro" button now opens the Pro page, not Settings.

### Six decisions I made for you. Please confirm each one.

**1. Free is 20 cards a day. Signed out is 3 cards a day.**
The brief's tier table says the free account is "unlimited". Your own override
says a free account is a modest upgrade, not unlimited. The live code agrees
with you: `entitlements.js` gives free 20 a day and Pro 250 a day. I used the
code's numbers and never wrote the word "unlimited" for Free.
Say "make Free unlimited" if the brief was right.

**2. The brief's tier table names a "Link resolves" row. I show "Cards on the
shelf".**
Nothing in the app counts link resolves for a person to read. Cards on the
shelf is the same limit under a name the person can check.

**3. The trial is weekly only.**
The brief offers "3 days free" on all three billing periods. The checkout code
only attaches a trial to the weekly price. I show the trial on weekly and not
on monthly or yearly, so nobody is promised a trial they will not get.
Say "add the trial to all three" and I will change the checkout code.

**4. I dropped Discord from the sign-in door.**
Your override says email, Google and Apple only.

**5. I kept two Settings rows the brief does not list.**
"Restore purchase" and "Delete your account" already existed. Removing them
would take away something a person may need. They stay.

**6. I rewrote the long dashes and one brief copy error.**
The brief prints a price line with a wrong number and one row title that does
not match its own table. I used the correct number from the price code.

### Three things the app cannot show yet. Not bugs. Missing data.

1. **The renewal date.** The Settings plan row wants "Renews 14 Aug". The
   server does not send a renewal date to the app yet. The row shows the plan
   without the date.
2. **The device count.** The brief shows "2 devices". Nothing counts devices.
   The row is not shown.
3. **Apple sign-in inside Settings.** The Settings screen has no Apple button
   because that screen is not given the Apple handler. The main sign-in door
   has Apple and works.

### One conflict I did not resolve. Your call.

`components/AvatarMenu.jsx` line 19 carries your note from 2026-08-01:
"Gallery colourway is parked. Blackout is the only look."

The overnight brief says both looks must work. Your note says only the dark
look matters now. I left your note alone and built to the brief, so both looks
work. Tell me which one wins and I will delete the other.

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
