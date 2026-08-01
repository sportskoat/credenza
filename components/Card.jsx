import { useRef } from "react";
import {
  BLUE,
  BLUE_BG,
  CARD,
  HAIR,
  StatusPill,
  linkButtons,
  usePrefersReducedMotion,
} from "../credenza-fashion.jsx";
import { CoverImage } from "./CardCover.jsx";
import CardFrontInfo from "./CardFrontInfo.jsx";
import { AlbumLink } from "./CardMetaLinks.jsx";
import FavoriteButton from "./FavoriteButton.jsx";

// ═══ GRID CARD (editorial front — design handoff 2a/2b) ═══
// At rest: photo hero, status flag top-left, quiet outline heart top-right,
// serif title, green price as text. No Buy button at rest.
// Focused/hover: lift + soft ring; heart fills; Buy fades over the photo.
// Tap opens the carousel overlay (no in-grid flip).
export default function Card({
  item,
  selected,
  onToggle,
  onToggleFavorite,
  onOpen,
  buyLabel,
  mode,
  phone = false,
  bodyProfile = null,
  fitPrefs = null,
}) {
  const reduced = usePrefersReducedMotion();
  const buy = linkButtons(item, { buyLabel }).find((b) => b.role === "buy") || null;
  // The photo morph's source nodes (§11). The shelf passes them straight to the
  // browser's view transition — nothing measures or clones them. The photo is
  // the shared element; the text block fades out on its own short timing.
  const photoRef = useRef(null);
  const textRef = useRef(null);
  const morphNodes = () => ({ photo: photoRef.current, text: textRef.current });

  return (
    <article
      id={"card-" + item.id}
      className="cz-editorial-card"
      aria-current={selected ? "true" : undefined}
    >
      <div
        className={
          "cz-card cz-card-editorial cz-card-twoline" +
          (selected ? " is-selected" : "")
        }
        style={{
          background: CARD,
          borderRadius: 16,
          border: "1px solid " + (selected ? BLUE : HAIR),
          boxShadow: selected
            ? "0 0 0 3px " + BLUE_BG + ", 0 14px 32px rgba(23, 24, 26, 0.12)"
            : "0 6px 16px rgba(23, 24, 26, 0.06)",
          overflow: "hidden",
          display: "grid",
          position: "relative",
          transition: reduced ? "none" : "border-color .2s, box-shadow .2s, transform .2s",
        }}
      >
        <div className="cz-card-body">
          <div className="cz-card-photo">
            {/* One full-size open button per card (CO-01/KM-04): the card is
                not a button, and Star + Buy are siblings of this button,
                never children — no nested interactive controls. */}
            <button
              ref={photoRef}
              type="button"
              className="cz-card-toggle"
              aria-label={
                "Open " + (item.title || "saved item") + (phone ? "" : " in carousel")
              }
              // The photo box IS the morph source, so the tap hands its node to
              // the opener. A caller that ignores the argument still works.
              onClick={() => onToggle(morphNodes())}
              style={{
                display: "block",
                width: "100%",
                padding: 0,
                margin: 0,
                background: "transparent",
                border: 0,
                cursor: "pointer",
              }}
            >
              <CoverImage
                item={item}
                aspectRatio="4/5"
                maxHeight={phone ? 460 : 320}
                className="cz-card-image"
                // Mobile shelf redesign 2026-07-30 (task 3, spec 5.5): a wide
                // listing photo letterboxes inside the 4:5 box on the phone.
                letterbox={phone}
                imgStyle={{
                  borderRadius: 0,
                  outline: "1px solid " + (mode !== "light" ? "oklch(1 0 0 / 0.08)" : "oklch(0 0 0 / 0.08)"),
                  animation: reduced ? undefined : "credenza-fade 400ms ease-out both",
                }}
              />
              <StatusPill status={item.findStatus} className="cz-card-status" />
            </button>
            <FavoriteButton item={item} onToggle={onToggleFavorite} className="cz-card-favorite cz-card-favorite-onphoto" />
            {/* Buy-on-hover is fine-pointer only. On phone it can never show,
                so the node is dropped instead of hidden (handoff step 2). */}
            {buy && onOpen && !phone && (
              <span className="cz-card-buy-hover">
                <button
                  type="button"
                  className="cz-buy-btn"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onOpen(item, buy.url);
                  }}
                >
                  <span className="cz-buy-btn-label">{buy.label}</span>
                </button>
              </span>
            )}
          </div>

          {/* Mouse-only duplicate of the open action (click the title/meta to
              open). Keyboard + AT use the photo button above — one tab stop.
              The AlbumLink is a SIBLING of this button, never a child: a
              nested <a> inside the card's one <button> is invalid HTML
              (handoff turn 3 §3). */}
          <div className="cz-card-text" ref={textRef}>
            <button
              type="button"
              className="cz-card-toggle"
              tabIndex={-1}
              aria-hidden="true"
              onClick={() => onToggle(morphNodes())}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: 0,
                margin: 0,
                background: "transparent",
                border: 0,
                cursor: "pointer",
              }}
            >
              <div className="cz-card-title cz-card-title-serif">{item.title}</div>
              <CardFrontInfo
                item={item}
                bodyProfile={bodyProfile}
                fitPrefs={fitPrefs}
                linkSeller={false}
                layout="row"
              />
            </button>
            <AlbumLink item={item} />
          </div>
        </div>
      </div>
    </article>
  );
}
