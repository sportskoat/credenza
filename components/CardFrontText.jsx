import { priceLabelShort, resolveDisplaySize } from "../credenza-fashion.jsx";
import { albumLinkTarget, SellerLink } from "./CardMetaLinks.jsx";

// ═══ SHARED CARD FRONT TEXT (Kyle 2026-07-29: "standardize the text layout")
// ═══ One block, used by the grid card (PhotoShelfList) and the carousel front
// (CoverFlowCarousel), so the two cards cannot drift apart. It renders exactly
// what the grid card always rendered: ref + photo count, title, then
// seller · size · price on ONE baseline row. A field the item does not have
// renders NOTHING — no &nbsp;, no reserved height — so the present lines pack
// at the bottom and row ends go ragged by design.
//
// The root takes cz-card-front-text plus is-grid or is-carousel; the variant
// class owns the sizing in credenza-fashion.css (the carousel card is ~1.25x
// the grid card, so its type steps up). Children keep the grid's original
// class names, so the existing white-on-photo colour and shadow rules apply
// unchanged on both cards.
export default function CardFrontText({
  item,
  bodyProfile = null,
  fitPrefs = null,
  linkSeller = true,
  variant = "grid",
  textRef = null,
  // Stage 6 (debate 2026-08-08): the grid passes the shelf's outcome maps so
  // the chip matches the shifted pick the detail panel shows. The frozen
  // carousel front omits it and keeps the unshifted read.
  outcomeMaps = null,
}) {
  const price = priceLabelShort(item);
  const size = resolveDisplaySize(item, bodyProfile, fitPrefs, outcomeMaps);
  const album = albumLinkTarget(item, { tight: true });
  const ref = itemRefCode(item);
  const photoCount = albumPhotoCount(item);
  const title = item.title || "Untitled item";

  return (
    <div
      className={"cz-card-front-text is-" + (variant === "carousel" ? "carousel" : "grid")}
      ref={textRef}
    >
      {(ref || (album && photoCount > 1)) && (
        <div className="cz-photo-list-refline">
          {ref ? (
            album ? (
              <a
                href={album.href}
                target="_blank"
                rel="noopener noreferrer"
                className="cz-photo-list-ref"
                onClick={(e) => e.stopPropagation()}
              >
                {ref}
              </a>
            ) : (
              <span className="cz-photo-list-ref is-text">{ref}</span>
            )
          ) : (
            <span />
          )}
          {album && photoCount > 1 && (
            <a
              href={album.href}
              target="_blank"
              rel="noopener noreferrer"
              className="cz-photo-list-count"
              aria-label={"View all " + photoCount + " photos"}
              onClick={(e) => e.stopPropagation()}
            >
              <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
                <rect x="3.5" y="0.8" width="7.7" height="7.7" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.3" />
                <rect x="0.8" y="3.5" width="7.7" height="7.7" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.3" />
              </svg>
              {photoCount}
            </a>
          )}
        </div>
      )}
      <div className="cz-photo-list-title">{title}</div>
      <div className="cz-photo-list-bottomline">
        {item.seller ? (
          linkSeller ? (
            <SellerLink item={item} className="cz-photo-list-seller" />
          ) : (
            <span className="cz-photo-list-seller is-text">{item.seller}</span>
          )
        ) : null}
        {size.value ? <span className="cz-photo-list-size">{size.value}</span> : null}
        {price ? <span className="cz-photo-list-price">{price}</span> : null}
      </div>
    </div>
  );
}

// The short code that names this listing on the seller's site. It is what a
// reseller quotes in a haul comment, so it is the first thing on the card.
// Marketplace item id where one exists, else the Yupoo album id. No code at
// all beats a made-up one.
function itemRefCode(item) {
  if (!item) return "";
  if (item.albumId) return item.albumId;
  const url = item.url || "";
  if (!url) return "";
  let u;
  try {
    u = new URL(url);
  } catch {
    return "";
  }
  const id =
    u.searchParams.get("itemID") ||
    u.searchParams.get("itemId") ||
    u.searchParams.get("item_id") ||
    u.searchParams.get("id") ||
    u.searchParams.get("offerId");
  if (id && /^\d{5,}$/.test(id)) return id;
  const path = u.pathname.match(/\/(?:item|offer)\/(\d{5,})/);
  return path ? path[1] : "";
}

// How many photos the ALBUM holds, not how many we copied. Same rule as the
// album link: the count describes what the link opens.
function albumPhotoCount(item) {
  if (!item) return 0;
  const stored = Array.isArray(item.gallery) ? item.gallery.length : 0;
  const known =
    typeof item.albumPhotoCount === "number" && isFinite(item.albumPhotoCount)
      ? item.albumPhotoCount
      : 0;
  return Math.max(stored, known);
}
