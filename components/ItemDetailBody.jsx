import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import {
  formatSizeToken,
  formatWeightGrams,
  itemWeightGrams,
  linkButtons,
  PriceChip,
  StatusChips,
} from "../credenza-fashion.jsx";
import { AlbumLink, SellerLink } from "./CardMetaLinks.jsx";
import CardBackHaulField from "./CardBackHaulField.jsx";
import SizeRecommendation from "./SizeRecommendation.jsx";
import WarehouseQcSection from "./WarehouseQcSection.jsx";
import CardCornerFan from "./CardCornerFan.jsx";

// The one detail layout for an item — the carousel card back is the app's
// single detail surface, and this is its body. Element order is the standard:
// title → price hero (¥+$) → seller link → meta chips → haul → note → size
// pick → photos → actions. Edit lives in the shell header (MorphButton).
export default function ItemDetailBody({
  item,
  knownHauls,
  galleryImages,
  buyLabel,
  onSaveEdit,
  onOpen,
  onOpenPhotos,
  bodyProfile,
  measureUnits,
  reduced,
  isCenter,
  expanded,
  onSaveBodyProfile,
  fitPromptSkipped,
  onSkipFitPrompt,
  fitPref = null,
  onSaveFitPref,
}) {
  // Note clamp: 2 lines at rest, a small + opens the full text (Kyle
  // 2026-07-23). The + renders only when the text actually overflows.
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteClamped, setNoteClamped] = useState(false);
  const noteRef = useRef(null);
  useEffect(() => {
    setNoteOpen(false);
  }, [item.id]);
  useEffect(() => {
    if (noteOpen) return;
    const el = noteRef.current;
    setNoteClamped(!!el && el.scrollHeight > el.clientHeight + 1);
  }, [item.note, noteOpen]);
  // Size/color chips only — status + category are full pickers in the pipeline.
  const itemWeight = itemWeightGrams(item);
  const hasFactChips =
    item.size ||
    item.posterSize ||
    item.recommendedSize ||
    item.colorway ||
    itemWeight != null;
  const buyButtons = linkButtons(item, { buyLabel }).filter((b) => b.role === "buy");
  // Product-sheet order (Kyle 2026-07-22):
  // head → identity → facts → context → size → PHOTOS (fills space) →
  // pipeline (Want… / Shirts…) → Buy (pinned).
  return (
    <div className="cz-product-sheet">
      <header className="cz-sheet-head">
        <h2 className="cz-carousel-back-title">{item.title}</h2>
      </header>

      <section className="cz-sheet-section cz-sheet-identity" aria-label="Price and seller">
        <PriceChip item={item} variant="hero" />
        <div className="cz-seller-block">
          <SellerLink item={item} className="cz-seller-quiet" />
          <AlbumLink item={item} />
        </div>
      </section>

      {hasFactChips && (
        <section className="cz-sheet-section cz-sheet-facts" aria-label="Item facts">
          <div className="cz-carousel-meta-chips">
            {item.size && (
              <span className="cz-meta-chip">
                SIZE: {formatSizeToken(item.size)}
              </span>
            )}
            {item.posterSize && (
              <span className="cz-meta-chip">Poster {item.posterSize}</span>
            )}
            {item.recommendedSize &&
              String(item.recommendedSize).toLowerCase() !== String(item.size || "").toLowerCase() && (
              <span className="cz-meta-chip">Rec {String(item.recommendedSize).toUpperCase()}</span>
            )}
            {item.colorway && (
              <span className="cz-meta-chip">{item.colorway}</span>
            )}
            {/* A6: "~" flags the estimate; an override reads as exact. */}
            {itemWeight != null && (
              <span className="cz-meta-chip">
                {item.weightGrams ? Math.round(Number(item.weightGrams)) + " g" : formatWeightGrams(itemWeight)}
              </span>
            )}
          </div>
        </section>
      )}

      <section className="cz-sheet-section cz-sheet-context" aria-label="Haul and notes">
        {/* CO-29: no stopPropagation wrapper — the back-face root treats
            .cz-carousel-haul-block as inert (see the closest() list). */}
        <div className="cz-carousel-haul-block">
          <CardBackHaulField
            item={item}
            knownHauls={knownHauls}
            onSaveEdit={onSaveEdit}
            compact
          />
        </div>
        {item.note ? (
          <div className={"cz-carousel-note" + (noteOpen ? " is-open" : "")}>
            <div className="cz-carousel-note-head">
              <span>Note</span>
              {noteClamped || noteOpen ? (
                <button
                  type="button"
                  className="cz-note-toggle"
                  aria-expanded={noteOpen}
                  aria-label={noteOpen ? "Collapse note" : "Read full note"}
                  onClick={(e) => {
                    e.stopPropagation();
                    setNoteOpen((v) => !v);
                  }}
                >
                  <Plus size={12} strokeWidth={2.4} aria-hidden="true" />
                </button>
              ) : null}
            </div>
            <p ref={noteRef}>{item.note}</p>
          </div>
        ) : null}
      </section>

      {/* Design 4a–4g: fit states + status stage/track in one card. */}
      <section className="cz-sheet-section cz-sheet-size" aria-label="Size and status">
        <div className="cz-fit3b-card">
          <SizeRecommendation
            item={item}
            bodyProfile={bodyProfile}
            units={measureUnits}
            sizeActive={!!(expanded && isCenter)}
            onSaveEdit={onSaveEdit}
            onSaveBodyProfile={onSaveBodyProfile}
            fitPromptSkipped={fitPromptSkipped}
            onSkipFitPrompt={onSkipFitPrompt}
            fitPref={fitPref}
            onSaveFitPref={onSaveFitPref}
          />
          <div className="cz-fit3b-status">
            <StatusChips
              mode="display"
              value={item.findStatus || "want"}
              onChange={(s) => onSaveEdit?.(item.id, { findStatus: s })}
            />
          </div>
        </div>
      </section>

      {/* A5: Warehouse QC sits right after the pipeline — it is the next step
          once a card reaches the agent's warehouse. */}
      {["qc", "gl", "rl"].includes(item.findStatus || "") ||
      (Array.isArray(item.qcPhotos) && item.qcPhotos.length > 0) ? (
        <WarehouseQcSection
          item={item}
          onSaveEdit={onSaveEdit}
          onOpenPhotos={onOpenPhotos}
          isCenter={isCenter}
        />
      ) : null}

      {galleryImages.length > 0 && (
        <section className="cz-sheet-section cz-sheet-photos" aria-label="Photos">
          {/* Roomy fan — same language as the little cards, just taller so the
              tall product-sheet back isn't empty. Not a flat grid (Kyle). */}
          <CardCornerFan
            item={item}
            images={galleryImages}
            onOpenPhotos={onOpenPhotos}
            reduced={reduced}
            interactive={isCenter}
            variant="roomy"
          />
        </section>
      )}

      {/* Category picker removed from the card back (Kyle 2026-07-24): the row
          read as visual noise next to Buy. Category stays editable in the
          capture sheet. */}

      {buyButtons.length > 0 && (
        <div className="cz-carousel-actions cz-sheet-buy">
          {buyButtons.map((button, index) => (
            <button
              key={button.url + index}
              type="button"
              className="cz-buy-btn cz-border-beam cz-carousel-action-btn primary"
              onClick={() => onOpen(item, button.url)}
            >
              <span className="cz-buy-btn-label">{button.label}</span>
              <span className="cz-border-beam-glow" aria-hidden="true" />
            </button>
          ))}
          {/* FTC affiliate disclosure at the point of action (audit
              2026-07-24): quiet, one line, always with the Buy buttons. */}
          <p className="cz-buy-disclosure">
            Buy links may include a referral code. Credenza may earn a commission on agent
            shipping fees. It never changes your item price.
          </p>
        </div>
      )}
    </div>
  );
}
