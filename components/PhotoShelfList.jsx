import { useRef } from "react";
import { FIND_STATUS_LABELS } from "../credenza-fashion.jsx";
import { CoverImage } from "./CardCover.jsx";
import CardFrontInfo from "./CardFrontInfo.jsx";
import FavoriteButton from "./FavoriteButton.jsx";

export default function PhotoShelfList({
  items,
  selectedId,
  onOpenDetail,
  onToggleFavorite,
  bodyProfile = null,
  fitPrefs = null,
}) {
  return (
    <div className="cz-photo-list" role="list">
      {items.map((item) => (
        <PhotoShelfRow
          key={item.id}
          item={item}
          selected={selectedId === item.id}
          onOpenDetail={onOpenDetail}
          onToggleFavorite={onToggleFavorite}
          bodyProfile={bodyProfile}
          fitPrefs={fitPrefs}
        />
      ))}
    </div>
  );
}

function PhotoShelfRow({
  item,
  selected,
  onOpenDetail,
  onToggleFavorite,
  bodyProfile,
  fitPrefs,
}) {
  const photoRef = useRef(null);
  const textRef = useRef(null);
  const status = FIND_STATUS_LABELS[item.findStatus || "want"] || "Saved";
  const detail = [item.category, status].filter(Boolean).join(" · ");

  return (
    <article
      id={"card-" + item.id}
      className={"cz-photo-list-row" + (selected ? " is-selected" : "")}
      aria-current={selected ? "true" : undefined}
      role="listitem"
    >
      <button
        ref={photoRef}
        type="button"
        className="cz-photo-list-open"
        aria-label={"Open " + (item.title || "saved item")}
        onClick={() =>
          onOpenDetail(item, { photo: photoRef.current, text: textRef.current })
        }
      >
        <span className="cz-photo-list-photo">
          <CoverImage
            item={item}
            aspectRatio="4/5"
            maxHeight={160}
            className="cz-photo-list-image"
          />
        </span>
        <span className="cz-photo-list-copy" ref={textRef}>
          <span className="cz-photo-list-title">{item.title || "Untitled item"}</span>
          <span className="cz-photo-list-meta">
            <CardFrontInfo
              item={item}
              bodyProfile={bodyProfile}
              fitPrefs={fitPrefs}
              linkSeller={false}
              layout="row"
            />
          </span>
          <span className="cz-photo-list-status">{detail}</span>
        </span>
      </button>
      <FavoriteButton
        item={item}
        onToggle={onToggleFavorite}
        className="cz-photo-list-favorite"
      />
    </article>
  );
}
