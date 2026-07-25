import {
  priceLabelShort,
  resolveDisplaySize,
} from "../credenza-fashion.jsx";
import { SellerLink } from "./CardMetaLinks.jsx";

// ═══ UNIFIED CARD FRONT INFO (Kyle 2026-07-23) ═══
// Grid card and carousel front read the same, title down: size line
// (manual size from Edit overrides the rec; EST = usual-size fallback when
// the item has no chart), seller, then the price as green USD text — no ¥
// when USD is known. linkSeller=false renders the seller as plain text: the
// grid card's whole face is one button, and nested anchors are invalid.
// layout="stack" — size, seller, price on three lines. The carousel front and
// the desktop grid card use this; the carousel is frozen, so it never changes.
// layout="row" — size and price share one baseline row, seller below. Phone
// grid card only (mobile handoff step 2): one line less per card.
export default function CardFrontInfo({ item, bodyProfile, fitPrefs = null, linkSeller = true, layout = "stack" }) {
  const size = resolveDisplaySize(item, bodyProfile, fitPrefs);
  const price = priceLabelShort(item);
  const sizeLine = (
    <div className="cz-front-size">
      {size.text ? (
        <span
          className={
            "cz-front-size-text" + (size.isRec ? " is-rec t-shimmer" : "")
          }
          data-text={size.isRec ? size.text : undefined}
        >
          {size.text}
        </span>
      ) : (
        <span aria-hidden="true">&nbsp;</span>
      )}
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
  if (layout === "row") {
    return (
      <>
        <div className="cz-front-meta-row">
          {sizeLine}
          {priceLine}
        </div>
        {sellerLine}
      </>
    );
  }
  return (
    <>
      {sizeLine}
      {sellerLine}
      {priceLine}
    </>
  );
}
