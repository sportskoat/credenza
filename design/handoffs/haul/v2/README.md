# Haul board v2 — the corrected flow

> **SUPERSEDED 2026-08-03.** Kyle chose a stepped layout instead of this column board.
> Build from `../STEPS-HANDOFF.md`, not from this mock. This file stays as reference —
> its route, width, header-removal, and volumetric decisions match the steps handoff.

One file: `Haul board v2.html`. Open it in a browser. Click the cards and the
buttons. Everything moves. The `screens/` folder holds a capture of each state.

This mock answers the questions from the review. I decided each one. Say the
word and any decision changes.

## The decisions

1. **Real pages.** The board gets its own address: `/hauls/winter`. The parcel
   gets one too: `/parcels/A`. The app already does this for `/settings` and
   `/upgrade`. The haul page stops living inside the shelf.
2. **Wider board.** The board breaks out to 1400px. The shelf stays at 1080px.
   Your monitor stops showing black bars on both sides.
3. **Empty columns stay, but quiet.** A dashed box with one line of copy.
   The columns keep their places. The eye learns the flow left to right.
4. **The old haul header dies.** No "Not bought 3 · Bought 1". No progress bar.
   No second weight. The strip under the title is the only summary. It shows
   the parcel number only. One weight story per page.
5. **Volumetric weight gets real data.** Each category ships with a default
   volume: jacket 8000 cm³, tee 1500 cm³, pants 3000 cm³, boots 12000 cm³.
   The item drawer shows the default and an edit link. The calculator works
   from day one. The "you pay for air" tip fires when it should.
6. **Stripped chrome on the board.** A back link, the haul name, Share. No
   search bar. No Shelf/Hauls tabs. The board is a workspace, not a browse page.
7. **Parcel B stays a drawing.** The button is there. The column fits one
   parcel. Build multi-parcel when a user asks for it.
8. **QC photos stay manual.** The user drops the agent's screenshots in. The
   review screen is built for that. No agent integration, as ever.

## What changed from the page you screenshotted

- Parcel A is the fifth column, 280px, stuck to the top while you scroll. It
  is the destination. "Add to parcel" moves a card right, and the maths update
  next to your hand.
- Empty stages no longer eat 40% of the board as blank space.
- The page shows one weight: the parcel's chargeable weight. The full maths
  (actual, volumetric, billed) live in the parcel card only.
- Volumetric shows 2.48 kg, not 0 g. The tip explains the gap and the saving.
- The board is its own page. The shelf does not render under it.

## The three overlays

- **Item drawer.** 352px on the right. Stage list, weight, volume source,
  order number. Cheap to open, cheap to close.
- **QC review.** Full screen. Photos get the whole display. Arrow keys move,
  G green-lights, R red-lights, Esc leaves. Red asks for a reason and writes
  the return message in English and Chinese. You still send it yourself.
- **Hand-off sheet.** A card in the centre. Copy the summary. Paste it into
  your agent's parcel form. Mark it handed off. You land on `/parcels/A`.

## Not in this mock

- Mobile. Desktop only, same as v1.
- Real photos. The coloured tiles stand in for product shots.
- The hauls index. It stays as designed in v1.

## Next step

You look at the mock. You say what feels wrong. Then this becomes the build
target for the app — the page structure, the overlay set, and the copy are all
final unless you change them.
