import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { itemPhotoList, DETAIL_PHOTO_CAP } from "../credenza-fashion.jsx";

// Edit-mode photo strip: every indexed photo, plus a + tile to add ones the
// resolver missed. A tap on a photo opens the big photo view, which carries
// Delete and Make cover photo — the thin per-tile trash is gone (Kyle
// 2026-07-29: "it's very thin and you always hit the delete box").
export function EditPhotosManager({ item, onAttachPhoto, onOpenPhoto, max = DETAIL_PHOTO_CAP }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const photos = itemPhotoList(item, max);
  const canAdd = photos.length < max;

  const pickFile = async (file) => {
    if (!file || !onAttachPhoto) return;
    setBusy(true);
    try {
      await onAttachPhoto(item.id, file);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="cz-edit-photos">
      <div className="cz-edit-photos-label">
        <span>Photos</span>
        {/* Oom review, OPEN 2 (2026-07-29): "{n}/{cap}" read as "1 of 24
            photos" on a one-photo item. The count names how many photos the
            item HAS; the cap is our storage budget, not the customer's
            number. A full strip already says so by hiding the Add tile. */}
        <span className="cz-edit-photos-count">{photos.length}</span>
      </div>
      <div className="cz-edit-photos-grid">
        {photos.map((src, idx) => (
          <EditPhotoTile
            key={src + "-" + idx}
            src={src}
            index={idx}
            isCover={idx === 0 && item.image === src}
            onOpen={() => onOpenPhoto?.(idx)}
          />
        ))}
        {canAdd ? (
          <button
            type="button"
            className="cz-edit-photo-add"
            aria-label="Add photo"
            disabled={busy}
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
          >
            <Plus size={20} strokeWidth={2.2} aria-hidden="true" />
            <span>{busy ? "Adding…" : "Add"}</span>
          </button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files && e.target.files[0];
          e.target.value = "";
          pickFile(file);
        }}
      />
    </div>
  );
}

export function EditPhotoTile({ src, index, isCover, onOpen }) {
  // Round 4 point 7 (2026-07-29): a failed photo draws a plain dark tile,
  // never the browser's broken-image mark. Per tile, so one bad photo does
  // not hide the good ones.
  const [bad, setBad] = useState(false);
  return (
    <button
      type="button"
      className={"cz-edit-photo-tile" + (isCover ? " is-cover" : "")}
      aria-label={"View photo " + (index + 1) + " full screen"}
      onClick={(e) => {
        e.stopPropagation();
        onOpen?.();
      }}
    >
      {bad ? (
        <span className="cz-photo-tile-missing" aria-hidden="true" />
      ) : (
        <img
          src={src}
          alt=""
          draggable={false}
          loading="lazy"
          decoding="async"
          onError={() => setBad(true)}
        />
      )}
      {isCover ? <span className="cz-edit-photo-cover-badge">Cover</span> : null}
    </button>
  );
}
