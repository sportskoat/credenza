import { useRef } from "react";
import { CoverImage } from "./CardCover.jsx";
import CardFrontText from "./CardFrontText.jsx";
import FavoriteButton from "./FavoriteButton.jsx";
import { StatusTag } from "./atoms.jsx";

export default function PhotoShelfList({
  items,
  selectedId,
  onOpenDetail,
  onToggleFavorite,
  bodyProfile = null,
  fitPrefs = null,
  phone = false,
}) {
  return (
    <div className="cz-photo-list" role="list">
      {items.map((item) => (
        <PhotoShelfCard
          key={item.id}
          item={item}
          selected={selectedId === item.id}
          onOpenDetail={onOpenDetail}
          onToggleFavorite={onToggleFavorite}
          bodyProfile={bodyProfile}
          fitPrefs={fitPrefs}
          phone={phone}
        />
      ))}
    </div>
  );
}

// ═══ CARD FRONT (shelf handoff 2026-07-28) ═══════════════════════════════
// Photo-first. The photo IS the card; every word sits on a scrim over it.
// Two scrims, both pointer-events:none. The bottom one carries the text; the
// TOP one is not decoration — without it the status word and the heart go
// white-on-white over a light photo.
//
// Structure, top to bottom:
//   status notation  dot + plain word, top-left. Only two states: nothing at
//                    all when the item is not ordered, "Bought" when it is.
//   heart            top-right, glass puck.
//   text             the shared CardFrontText block: ref + photo count, then
//                    the title, then seller · size · price on one line.
//
// The ref and the seller are links, so the text block is a SIBLING of the
// open button, never a child — the card face is one <button> and a nested
// <a> is invalid HTML. It sits in an overlay block above the button in the
// stacking order and re-enables pointer events on the links only.
function PhotoShelfCard({ item, selected, onOpenDetail, onToggleFavorite, bodyProfile, fitPrefs, phone }) {
  const photoRef = useRef(null);
  const textRef = useRef(null);
  const title = item.title || "Untitled item";

  return (
    <article
      id={"card-" + item.id}
      className={"cz-photo-list-card" + (selected ? " is-selected" : "")}
      aria-current={selected ? "true" : undefined}
      role="listitem"
    >
      <button
        ref={photoRef}
        type="button"
        className="cz-photo-list-open"
        aria-label={"Open " + title}
        onClick={() =>
          onOpenDetail(item, { photo: photoRef.current, text: textRef.current })
        }
      >
        {/* Mobile shelf redesign 2026-07-30 (task 3, spec 5.5): on the phone
            a photo wider than the 4:5 box letterboxes instead of cropping.
            Desktop keeps cover. */}
        <CoverImage item={item} fill className="cz-photo-list-image" letterbox={phone} />
        <span className="cz-photo-list-topshade" aria-hidden="true" />
        <span className="cz-photo-list-scrim" aria-hidden="true" />
      </button>

      {/* Round 4 point 6: the shared StatusTag — same mark as the carousel. */}
      <StatusTag status={item.findStatus} variant="grid" />

      <FavoriteButton
        item={item}
        onToggle={onToggleFavorite}
        className="cz-photo-list-favorite"
      />

      {/* Text overlay. pointer-events:none on the block, auto on each link, so
          a tap anywhere else still opens the card underneath. */}
      <CardFrontText
        variant="grid"
        item={item}
        bodyProfile={bodyProfile}
        fitPrefs={fitPrefs}
        textRef={textRef}
      />
    </article>
  );
}
