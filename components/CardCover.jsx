import { useEffect, useState } from "react";
import { marketplaceOf } from "../agents.js";
import {
  BrandIcon,
  DISPLAY,
  FONT,
  SUB,
  TYPES,
} from "../credenza-fashion.jsx";

function sourceLabel(item) {
  const h = (item.host || "").toLowerCase();
  if (h.includes("yupoo")) return "Yupoo";
  if (h.includes("weidian")) return "Weidian";
  if (h.includes("taobao") || h.includes("tmall")) return "Taobao";
  if (h.includes("1688")) return "1688";
  if (h.includes("reddit")) return "Reddit";
  return (TYPES[item.type] || TYPES.note).label;
}

export function TypeMark({ item }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
      <BrandIcon type={item.type} host={item.host} size={13} />
      {!(item.type === "note" && item.note) && (
        <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 600, color: SUB }}>
          {sourceLabel(item)}
        </span>
      )}
    </span>
  );
}

// Cover icon: category-first for fashion items, type fallback for generic links.
// Simple line-art SVGs so they stay crisp at any size and work in both themes.
function CoverIcon({ item, size = 64 }) {
  const category = item.category;
  const stroke = "currentColor";
  const strokeWidth = 1.5;
  const common = { fill: "none", stroke, strokeWidth, strokeLinecap: "round", strokeLinejoin: "round" };

  if (category === "shirt") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <path {...common} d="M7 4h3l2 3 2-3h3l3 4-2 2-1-1v11H8V9l-1 1-2-2 2-4z" />
      </svg>
    );
  }
  if (category === "pants") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <path {...common} d="M8 4h8l-1 9-2 7-2-7-3-9z" />
      </svg>
    );
  }
  if (category === "shoes") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <path {...common} d="M4 14c2-3 6-4 10-3l4 1c2 .5 3 2 2 4H6c-1 0-2-1-2-2z" />
        <path {...common} d="M14 12l3-4" />
      </svg>
    );
  }
  if (category === "outerwear") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <path {...common} d="M8 3h8l3 5v13H5V8l3-5z" />
        <path {...common} d="M12 3v18" />
        <path {...common} d="M8 8h8" />
      </svg>
    );
  }
  if (category === "accessory") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <circle {...common} cx="12" cy="12" r="7" />
        <path {...common} d="M12 8v4l3 3" />
      </svg>
    );
  }
  if (category === "bag") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <path {...common} d="M6 9h12v10H6z" />
        <path {...common} d="M9 9V6a3 3 0 0 1 6 0v3" />
      </svg>
    );
  }
  if (category === "hat") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <path {...common} d="M5 13h14v3H5z" />
        <path {...common} d="M7 13c0-4 2-7 5-7s5 3 5 7" />
      </svg>
    );
  }

  // Type fallback.
  const type = item.type || "note";
  if (type === "video") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <rect {...common} x="3" y="5" width="18" height="14" rx="2" />
        <path {...common} d="M10 9l5 3-5 3V9z" />
      </svg>
    );
  }
  if (type === "tweet") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <path {...common} d="M18.2 3H21l-7.6 8.7L22 21h-6.3l-4.9-6.4L4.5 21H2l8.1-9.3L2 3h6.5l4.5 5.9L18.2 3z" />
      </svg>
    );
  }
  if (type === "audio") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <path {...common} d="M4 10v4M8 7v10M12 4v16M16 8v8M20 10v4" />
      </svg>
    );
  }
  if (type === "reddit") {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
        <circle {...common} cx="12" cy="12" r="9" />
        <circle {...common} cx="15" cy="10" r="1.5" fill="currentColor" />
        <circle {...common} cx="9" cy="10" r="1.5" fill="currentColor" />
        <path {...common} d="M9 14c1.3 1.3 4.7 1.3 6 0" />
        <path {...common} d="M16 6l2-2M8 6L6 4" />
      </svg>
    );
  }

  // Default: article / note / link.
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path {...common} d="M4 4h16v16H4z" />
      <path {...common} d="M8 9h8M8 12h8M8 15h5" />
    </svg>
  );
}

// Marketplace brand tiles for photo-less cards (Kyle 2026-07-25: the gray
// gradient box read as a broken image, not a card). A flat tile with the
// marketplace monogram + wordmark looks deliberate until photos arrive.
const MARKETPLACE_TILES = {
  weidian: { name: "Weidian", rgb: "255, 90, 60" },
  taobao: { name: "Taobao", rgb: "255, 106, 0" },
  tmall: { name: "Tmall", rgb: "255, 0, 54" },
  "1688": { name: "1688", rgb: "255, 115, 0" },
  yupoo: { name: "Yupoo", rgb: "55, 178, 77" },
};

function CoverPlaceholder({ item, aspectRatio = "4/5", maxHeight, style }) {
  const loading = item.status === "enriching";
  const tileUrl =
    item.url ||
    (Array.isArray(item.links) ? (item.links.find((l) => l.role === "buy") || {}).url : "") ||
    "";
  const tile = tileUrl ? MARKETPLACE_TILES[marketplaceOf(tileUrl)] : null;
  if (tile) {
    return (
      <div
        className="cz-cover-placeholder cz-cover-tile"
        aria-hidden="true"
        style={{
          width: "100%",
          aspectRatio,
          maxHeight,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          background:
            "linear-gradient(180deg, rgba(" + tile.rgb + ", 0.15) 0%, rgba(" + tile.rgb + ", 0.05) 100%)",
          position: "relative",
          overflow: "hidden",
          ...style,
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 56,
            height: 56,
            borderRadius: 16,
            background: "rgba(" + tile.rgb + ", 0.16)",
            border: "1px solid rgba(" + tile.rgb + ", 0.38)",
            color: "rgb(" + tile.rgb + ")",
            fontFamily: DISPLAY,
            fontSize: 26,
            fontWeight: 700,
          }}
        >
          {tile.name[0]}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 650,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--cz-sub)",
          }}
        >
          {tile.name}
        </span>
        {loading && (
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.02em", color: "var(--cz-faint)" }}>
            Loading photos…
          </span>
        )}
      </div>
    );
  }
  return (
    <div
      className="cz-cover-placeholder"
      aria-hidden="true"
      style={{
        width: "100%",
        aspectRatio,
        maxHeight,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        background: "var(--cz-bg-elevated)",
        color: "var(--cz-faint)",
        position: "relative",
        overflow: "hidden",
        ...style,
      }}
    >
      <CoverIcon item={item} size={loading ? 36 : 48} />
      {loading && (
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.02em" }}>
          Loading photos…
        </span>
      )}
    </div>
  );
}

// Shared cover image: handles broken/missing images and renders a category-aware placeholder.
export function CoverImage({ item, aspectRatio = "4/5", maxHeight = 320, className, style, imgStyle, fill = false }) {
  const [imgOk, setImgOk] = useState(true);
  const imageSrc = item.image || (item.videoId ? "https://i.ytimg.com/vi/" + item.videoId + "/hqdefault.jpg" : null);

  useEffect(() => {
    setImgOk(true);
  }, [imageSrc]);

  // Carousel/card faces pass fill so the cover always paints the full image
  // slot — aspect-ratio + maxHeight made price chips land at different Ys when
  // titles/sellers reflowed the meta block under a variable-height image.
  const boxStyle = fill
    ? {
        width: "100%",
        height: "100%",
        objectFit: "cover",
        display: "block",
        userSelect: "none",
        WebkitUserDrag: "none",
        ...imgStyle,
      }
    : {
        width: "100%",
        aspectRatio,
        maxHeight,
        objectFit: "cover",
        display: "block",
        userSelect: "none",
        WebkitUserDrag: "none",
        ...imgStyle,
      };

  if (!imageSrc || !imgOk) {
    return (
      <CoverPlaceholder
        item={item}
        aspectRatio={fill ? undefined : aspectRatio}
        maxHeight={fill ? undefined : maxHeight}
        style={{
          ...(fill ? { width: "100%", height: "100%", aspectRatio: "auto", maxHeight: "none" } : null),
          ...style,
        }}
      />
    );
  }

  return (
    <img
      className={className}
      src={imageSrc}
      alt=""
      draggable={false}
      loading="lazy"
      decoding="async"
      onDragStart={(event) => event.preventDefault()}
      onError={() => setImgOk(false)}
      style={boxStyle}
    />
  );
}
