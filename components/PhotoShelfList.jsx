import { useRef } from "react";
import { priceLabelShort } from "../credenza-fashion.jsx";
import { CoverImage } from "./CardCover.jsx";
import FavoriteButton from "./FavoriteButton.jsx";

export default function PhotoShelfList({
  items,
  selectedId,
  onOpenDetail,
  onToggleFavorite,
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
        />
      ))}
    </div>
  );
}

function PhotoShelfCard({ item, selected, onOpenDetail, onToggleFavorite }) {
  const photoRef = useRef(null);
  const textRef = useRef(null);
  const price = priceLabelShort(item);
  const source = item.seller || item.category || "Saved";

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
        aria-label={"Open " + (item.title || "saved item")}
        onClick={() =>
          onOpenDetail(item, { photo: photoRef.current, text: textRef.current })
        }
      >
        <CoverImage item={item} fill className="cz-photo-list-image" />
        <span className="cz-photo-list-topshade" aria-hidden="true" />
        <span className="cz-photo-list-source">{source}</span>
        <span className="cz-photo-list-scrim" ref={textRef}>
          <span className="cz-photo-list-title">{item.title || "Untitled item"}</span>
          <span className="cz-photo-list-bottomline">
            <span className="cz-photo-list-price">{price || "Price not saved"}</span>
            <span className="cz-photo-list-cta">View ›</span>
          </span>
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
