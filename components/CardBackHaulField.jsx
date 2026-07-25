import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { HaulAccordionField } from "../credenza-fashion.jsx";

// Card-back write-through wrapper around the haul accordion.
// compact (product sheet): assigned haul is a quiet chip until the user expands it.
export default function CardBackHaulField({ item, knownHauls, onSaveEdit, compact = false }) {
  const current = String(item.project || "").trim();
  const [expanded, setExpanded] = useState(!compact || !current);
  useEffect(() => {
    // Re-collapse when the assigned haul changes externally (e.g. after pick).
    if (compact && current) setExpanded(false);
    if (compact && !current) setExpanded(true);
  }, [compact, current, item.id]);

  const commit = (next) => {
    const cleaned = String(next || "").trim();
    if ((item.project || "") !== cleaned) onSaveEdit?.(item.id, { project: cleaned });
    if (compact && cleaned) setExpanded(false);
  };

  if (compact && current && !expanded) {
    // CO-29: the wrapper div carried a bare stopPropagation onClick (a11y
    // lint: static element with a click handler). The buttons own it now.
    return (
      <div className="cz-haul-chip-row">
        <button
          type="button"
          className="cz-haul-chip"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(true);
          }}
          aria-label={"Change haul, currently " + current}
        >
          <span className="cz-haul-chip-label">In</span>
          <span className="cz-haul-chip-name">{current}</span>
        </button>
        <button
          type="button"
          className="cz-haul-chip-clear"
          aria-label="Remove from haul"
          title="Remove from haul"
          onClick={(e) => {
            e.stopPropagation();
            commit("");
          }}
        >
          <X size={13} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <HaulAccordionField
      label="Haul"
      value={item.project || ""}
      knownHauls={knownHauls}
      onChange={() => {}}
      onCommit={commit}
      className="cz-carousel-haul-field"
    />
  );
}
