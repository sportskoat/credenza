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

// Hosts whose item page doubles as the photo gallery, named for the album
// link (handoff turn 3 §3: "Non-Yupoo hosts name themselves").
const ALBUM_HOST_NAMES = {
  "weidian.com": "Weidian",
  "taobao.com": "Taobao",
  "tmall.com": "Tmall",
  "1688.com": "1688",
};

function albumHostName(raw) {
  try {
    const host = new URL(raw).hostname.replace(/^www\./, "").toLowerCase();
    for (const key of Object.keys(ALBUM_HOST_NAMES)) {
      if (host === key || host.endsWith("." + key)) return ALBUM_HOST_NAMES[key];
    }
  } catch {
    /* not a URL */
  }
  return null;
}

// Where the card's album link points and what it says. Yupoo items open the
// full album; other known hosts open the listing's own gallery page. The
// count is the real fetched gallery size — shown only when more than one
// photo is known, so the label never lies about a lazy gallery. tight=true
// is the short wording for narrow slots (thumb-strip tile).
export function albumLinkTarget(item, { tight = false } = {}) {
  if (!item) return null;
  const known = Array.isArray(item.gallery) ? item.gallery.length : 0;
  const count = known > 1 ? " · " + known + " photos" : "";
  const yupoo = yupooAlbumUrl(item);
  if (yupoo) {
    return { href: yupoo, label: (tight ? "Album" : "View album") + count };
  }
  const name = item.url ? albumHostName(item.url) : null;
  if (!name) return null;
  return { href: item.url, label: name + " gallery" + count };
}

// Album link on the card front (handoff turn 3 §3): --cz-link blue, ~50%
// underline, stacked-photos glyph — the only blue on the card. MUST mount as
// a sibling of the card's open button, never inside it: the card face is one
// <button> and a nested <a> is invalid HTML.
export function AlbumLink({ item, tight = false, className = "cz-album-link", style }) {
  const target = albumLinkTarget(item, { tight });
  if (!target) return null;
  return (
    <a
      href={target.href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      style={style}
      onClick={(e) => e.stopPropagation()}
    >
      <svg
        className="cz-album-glyph"
        width="11"
        height="11"
        viewBox="0 0 12 12"
        aria-hidden="true"
        focusable="false"
      >
        <rect x="3.5" y="0.8" width="7.7" height="7.7" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <rect x="0.8" y="3.5" width="7.7" height="7.7" rx="1.6" fill="var(--cz-card-solid, #fff)" stroke="currentColor" strokeWidth="1.3" />
      </svg>
      <span className="cz-album-label">{target.label}</span>
    </a>
  );
}
