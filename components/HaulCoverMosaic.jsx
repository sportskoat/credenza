/* ═══════════════════════════════════════════════════════════════════════════
   HaulCoverMosaic — the Hauls index tile.

   Kyle 2026-08-02: "I kind of liked it better when the Hauls page didn't have
   the fanning-out feature... the different colours on this are different
   articles of clothing." This is the wireframe's collage
   (design/handoffs/haul/wireframes/Hauls index.dc.html line 59, README line
   222): four squares of clothing split by a hairline cross.

   It replaced components/HaulCoverFan.jsx, which spread the same covers as a
   rotating stack on hover. Nothing here moves. There is no hover state, no
   spring and no front card, so the label sits on the block itself.

   The block never has a hole. Fewer than four covers repeat to fill the four
   slots; one cover or none fills the whole block as a single tile.
   ═══════════════════════════════════════════════════════════════════════════ */

// The collage takes the same props the fan took, so the call site only swaps
// the name. `label` and `badge` still ride inside the block's own overflow,
// which is what clips the scrim. The block is aria-hidden, so the caller must
// name the button itself.
export default function HaulCoverMosaic({
  covers = [],
  name = "",
  count = 0,
  label = null,
  badge = null,
}) {
  const real = covers.filter(Boolean).slice(0, 4);
  // One photo reads better filling the frame than printed four times. Two or
  // three repeat, because a blank quarter reads as a loading failure.
  const single = real.length <= 1;
  const tiles = single ? real : [0, 1, 2, 3].map((i) => real[i % real.length]);

  return (
    <div
      className={
        "cz-haul-mosaic" +
        (single ? " is-single" : "") +
        // A haul with no photo keeps the dashed edge the old stack had, so it
        // reads as "nothing to show yet" rather than as a broken picture.
        (tiles.length ? "" : " is-empty")
      }
      aria-hidden="true"
      data-count={count}
    >
      {tiles.length ? (
        tiles.map((src, i) => (
          <div className="cz-haul-mosaic-tile" key={src + "-" + i}>
            <img src={src} alt="" draggable={false} loading="lazy" decoding="async" />
          </div>
        ))
      ) : (
        <div className="cz-haul-mosaic-tile is-empty">
          <div className="cz-haul-mosaic-placeholder">
            {(name || "?").slice(0, 1).toUpperCase()}
          </div>
        </div>
      )}
      {badge}
      {label}
    </div>
  );
}
