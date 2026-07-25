import { sellerStoreUrl, yupooAlbumUrl } from "../credenza-fashion.jsx";

// Seller name, hyperlinked to the store when we know it (Weidian/Yupoo home,
// host fallback). The one place seller renders as a link-or-text.
export function SellerLink({ item, className = "cz-seller-link", style }) {
  if (!item || !item.seller) return null;
  const href = sellerStoreUrl(item);
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        style={style}
        onClick={(e) => e.stopPropagation()}
      >
        {item.seller}
      </a>
    );
  }
  return (
    <span className={className + " is-text"} style={style}>
      {item.seller}
    </span>
  );
}

// Yupoo full album — quiet hyperlink under the seller (card back). Not an
// action button: Kyle 2026-07-22 killed "More Photos" chrome in the Buy row.
export function AlbumLink({ item, className = "cz-album-quiet", style }) {
  const href = item ? yupooAlbumUrl(item) : null;
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      style={style}
      onClick={(e) => e.stopPropagation()}
    >
      Full Album
    </a>
  );
}
