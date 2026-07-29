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
// count describes the ALBUM, not our copy of it — the link opens the album,
// so counting what we stored made the label lie (Kyle 2026-07-26: "it'll say
// 8 photos, but this album has 30 different photos"). albumPhotoCount comes
// from the album page itself; the stored gallery is the fallback for items
// enriched before that field existed. Shown only above one photo, so the
// label never overstates a lazy gallery. tight=true is the short wording for
// narrow slots (thumb-strip tile).
export function albumLinkTarget(item, { tight = false } = {}) {
  if (!item) return null;
  const stored = Array.isArray(item.gallery) ? item.gallery.length : 0;
  const known = Math.max(
    typeof item.albumPhotoCount === "number" && isFinite(item.albumPhotoCount) ? item.albumPhotoCount : 0,
    stored
  );
  const count = known > 1 ? " · " + known + " photos" : "";
  // `name` is the count-free destination and `photos` the raw count, for
  // slots too narrow for the full label (the thumb-strip tile truncated to
  // "4 ph..." — Oom review 2026-07-29). `label` is unchanged.
  const photos = known > 1 ? known : 0;
  const yupoo = yupooAlbumUrl(item);
  if (yupoo) {
    return { href: yupoo, label: (tight ? "Album" : "View album") + count, name: tight ? "Album" : "View album", photos };
  }
  const name = item.url ? albumHostName(item.url) : null;
  if (!name) return null;
  return { href: item.url, label: name + " gallery" + count, name: name + " gallery", photos };
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

// Round 5 point 5.5 (2026-07-29): the seller tile left this row. The seller
// name showed three times — header, photo tail, timeline — and the header
// keeps it. The one store link left is the rail's Seller row. What stays
// here is the destination the rail cannot offer: every photo of THIS item.
export function AlbumLinksRow({ item, className = "cz-album-links" }) {
  if (!item) return null;
  const album = albumLinkTarget(item, { tight: true });
  if (!album) return null;
  return (
    <div className={className}>
      <a
        href={album.href}
        target="_blank"
        rel="noopener noreferrer"
        className="cz-album-link-tile"
        onClick={(e) => e.stopPropagation()}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="14" height="14" rx="2" />
          <path d="M21 7v11a2 2 0 0 1-2 2H8" />
        </svg>
        <span className="cz-album-tile-text">
          {/* The count lives in the kicker, not the name — the name
              truncated to "4 ph..." in the narrow tile (Oom 2026-07-29). */}
          <span className="cz-album-tile-name">{album.name}</span>
          <span className="cz-album-tile-kicker">
            {album.photos ? "All " + album.photos + " photos" : "All photos"}
          </span>
        </span>
      </a>
    </div>
  );
}
