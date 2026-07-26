import {
  priceLabelShort,
  resolveDisplaySize,
} from "../credenza-fashion.jsx";
import { SellerLink } from "./CardMetaLinks.jsx";

// ═══ UNIFIED CARD FRONT INFO (Kyle 2026-07-23, handoff turn 3 §1–2, §4) ═══
// Grid card and carousel front read the same, title down: size line, seller,
// then the price as green USD text — no ¥ when USD is known. The size line is
// a LABEL + VALUE pair that says who decided (turn 3 §4): AI SIZE (chart,
// shimmer), AI SIZE ? (estimated profile, amber), YOUR USUAL (no chart,
// plain, no shimmer), SIZE (user override, always wins). linkSeller=false
// renders the seller as plain text: the grid card's whole face is one button,
// and nested anchors are invalid.
// layout="row" — size and price share one baseline row, seller below. Every
// grid card uses this, phone and desktop (handoff turn 3 §2: one layout).
// Missing fields render NOTHING — no &nbsp;, no reserved height — so the
// present lines pack via the text block's grid gap and row bottoms go ragged
// by design.
// layout="stack" — size, seller, price on three lines with reserved blanks.
// The carousel front only; the carousel is frozen, so it never changes.
export default function CardFrontInfo({ item, bodyProfile, fitPrefs = null, linkSeller = true, layout = "stack" }) {
  const size = resolveDisplaySize(item, bodyProfile, fitPrefs);
  const price = priceLabelShort(item);
  const sizeText = size.value ? (
    <span className="cz-front-size-text">
      <span className={"cz-front-size-label kind-" + size.kind}>
        {size.label}
      </span>
      <span
        className={
          "cz-front-size-value kind-" +
          size.kind +
          (size.kind === "rec" ? " is-rec t-shimmer" : "")
        }
        data-text={size.kind === "rec" ? size.value : undefined}
      >
        {size.value}
      </span>
    </span>
  ) : null;
  if (layout === "row") {
    return (
      <>
        {sizeText || price ? (
          <div className="cz-front-meta-row">
            {sizeText ? <div className="cz-front-size">{sizeText}</div> : null}
            {price ? <div className="cz-front-price">{price}</div> : null}
          </div>
        ) : null}
        {item.seller ? (
          <div className="cz-front-seller">
            {linkSeller ? (
              <SellerLink item={item} />
            ) : (
              <span className="cz-seller-link is-text">{item.seller}</span>
            )}
          </div>
        ) : null}
      </>
    );
  }
  const sizeLine = (
    <div className="cz-front-size">
      {sizeText || <span aria-hidden="true">&nbsp;</span>}
    </div>
  );
  const sellerLine = (
    <div className="cz-front-seller">
      {item.seller ? (
        linkSeller ? (
          <SellerLink item={item} />
        ) : (
          <span className="cz-seller-link is-text">{item.seller}</span>
        )
      ) : (
        <span aria-hidden="true">&nbsp;</span>
      )}
    </div>
  );
  const priceLine = (
    <div className="cz-front-price">
      {price ? price : <span aria-hidden="true">&nbsp;</span>}
    </div>
  );
  return (
    <>
      {sizeLine}
      {sellerLine}
      {priceLine}
    </>
  );
}
