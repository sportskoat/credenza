import { useEffect, useState } from "react";
import {
  ACTION_FILL,
  BLUE_DK,
  Caption,
  DISPLAY,
  EASE,
  FAINT,
  HAIR,
  INK,
  ModalShell,
  Pill,
  SEG,
  SUB,
} from "../credenza-fashion.jsx";

export default function DigestDeck({ slides, onClose, onOpen }) {
  const [i, setI] = useState(0);
  const slide = slides[i];
  const next = () => setI((value) => Math.min(value + 1, slides.length - 1));
  const prev = () => setI((value) => Math.max(value - 1, 0));

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setI((value) => Math.min(value + 1, slides.length - 1));
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setI((value) => Math.max(value - 1, 0));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slides.length]);

  return (
    <ModalShell title="Digest" onClose={onClose} maxWidth={440}>
      <div style={{ padding: "22px 22px 18px", minHeight: 250 }} aria-live="polite">
        <Caption style={{ color: BLUE_DK, marginBottom: 14 }}>{slide.eyebrow}</Caption>
        <div
          className="cz-title-balance"
          style={{
            fontFamily: DISPLAY,
            fontSize: 24,
            fontWeight: 500,
            letterSpacing: "-0.035em",
            lineHeight: 1.15,
            marginBottom: 10,
          }}
        >
          {slide.title}
        </div>
        <div className="cz-copy-pretty" style={{ fontSize: 14, lineHeight: 1.6, color: SUB }}>
          {slide.body}
        </div>
        {slide.url && (
          <div style={{ marginTop: 18 }}>
            <Pill primary onClick={() => onOpen(slide.itemId, slide.url)}>
              Open card
            </Pill>
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "12px 14px 14px",
          borderTop: "1px solid " + HAIR,
        }}
      >
        <button
          type="button"
          className="cz-icon-button"
          aria-label="Previous digest card"
          onClick={prev}
          disabled={i === 0}
          style={{ width: 40, height: 40, border: 0, borderRadius: 999, background: SEG, color: INK }}
        >
          ‹
        </button>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
          {slides.map((_, index) => (
            <button
              type="button"
              className="cz-icon-button"
              key={index}
              aria-label={"Go to digest card " + (index + 1) + " of " + slides.length}
              aria-current={index === i ? "step" : undefined}
              onClick={() => setI(index)}
              style={{ width: 32, height: 40, border: 0, background: "transparent", padding: 0 }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: "block",
                  width: index === i ? 16 : 6,
                  height: 6,
                  margin: "0 auto",
                  borderRadius: 999,
                  background: index === i ? ACTION_FILL : HAIR,
                  transition: "background-color 160ms " + EASE,
                }}
              />
            </button>
          ))}
        </div>
        <button
          type="button"
          className="cz-icon-button"
          aria-label="Next digest card"
          onClick={next}
          disabled={i === slides.length - 1}
          style={{ width: 40, height: 40, border: 0, borderRadius: 999, background: SEG, color: INK }}
        >
          ›
        </button>
      </div>
      <div className="cz-status-number" style={{ padding: "0 16px 14px", textAlign: "center", fontSize: 12, color: FAINT }}>
        Card {i + 1} of {slides.length}
      </div>
    </ModalShell>
  );
}
