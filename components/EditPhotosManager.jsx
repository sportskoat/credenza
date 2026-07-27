import { useRef, useState } from "react";
import { m as motion } from "framer-motion";
import { Plus, Trash2 } from "lucide-react";
import { itemPhotoList, usePrefersReducedMotion } from "../credenza-fashion.jsx";

// Edit-mode photo strip: every indexed photo with a shake-trash delete, plus
// a + tile to add ones the resolver missed.
export function EditPhotosManager({ item, onAttachPhoto, onRemovePhoto, max = 12 }) {
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
        <span className="cz-edit-photos-count">{photos.length}/{max}</span>
      </div>
      <div className="cz-edit-photos-grid">
        {photos.map((src, idx) => (
          <EditPhotoTile
            key={src + "-" + idx}
            src={src}
            index={idx}
            isCover={idx === 0 && item.image === src}
            onRemove={() => onRemovePhoto?.(item.id, src)}
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

export function EditPhotoTile({ src, index, isCover, onRemove }) {
  const [hovered, setHovered] = useState(false);
  const reduced = usePrefersReducedMotion();
  return (
    <div
      className={"cz-edit-photo-tile" + (isCover ? " is-cover" : "")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <img src={src} alt={"Photo " + (index + 1)} draggable={false} loading="lazy" decoding="async" />
      {isCover ? <span className="cz-edit-photo-cover-badge">Cover</span> : null}
      {/* No trash ON the cover photo (Kyle 2026-07-22: "what is this over the
          cover photo"). Delete the cover by deleting it after another photo
          takes over — non-cover tiles keep the quiet delete. */}
      {isCover ? null : (
        <motion.button
          type="button"
          className="cz-edit-photo-delete"
          aria-label={"Delete photo " + (index + 1)}
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
          onMouseEnter={() => setHovered(true)}
          whileHover={reduced ? undefined : { scale: 1.06 }}
          whileTap={reduced ? undefined : { scale: 0.94 }}
        >
          <motion.span
            className="cz-edit-photo-delete-icon"
            animate={
              reduced || !hovered
                ? { y: 0, rotate: 0 }
                : { y: [0, -2, 0, -2, 0], rotate: [0, -10, 10, -10, 0] }
            }
            transition={{ duration: 0.4 }}
          >
            <Trash2 size={14} strokeWidth={2.2} aria-hidden="true" />
          </motion.span>
        </motion.button>
      )}
    </div>
  );
}
