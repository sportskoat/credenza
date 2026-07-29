import { useState } from "react";
import { m as motion } from "framer-motion";
import {
  useCoarsePointer,
  usePrefersReducedMotion,
} from "../credenza-fashion.jsx";

// Haul directory cover: multi-item corner fan (transitions.dev CardCornerFan).
// One item = one flat card (no ghost stack). Two+ items fan on hover; on touch
// they rest half-fanned so multi-item hauls still read as stacks.
//
// Kyle 2026-07-29 ("match shelf"): the name used to sit in a box UNDER the
// stack. It now rides INSIDE the front card (`label`), so the card's own
// overflow clips the scrim — an absolutely-placed label outside the stack
// bled past the rotated front card's slanted edge. The fan stays aria-hidden,
// so the caller must name the button itself.
export default function HaulCoverFan({ covers = [], name = "", count = 0, label = null }) {
  const [hovered, setHovered] = useState(false);
  const reduced = usePrefersReducedMotion();
  const coarse = useCoarsePointer();
  // Real covers only — never invent empty ghost cards for a 1-item haul.
  const images = covers.length ? covers.slice(0, 5) : [null];
  const slots = images;
  const total = slots.length;
  const single = total <= 1 || count <= 1;
  // The spread used to straddle upright (-10deg to +12deg). The front card is
  // flat now, so the whole fan leans one way and the same numbers pushed the
  // stack 18px off a 402px screen (probe-haul-title.mjs). These keep the old
  // right-hand envelope. Resting fan stays tighter than the hover fan.
  const angle = coarse && !hovered ? 12 : 26;
  // Single-item hauls stay flat. Multi-item: hover (desktop) or rest-open (touch).
  const open = !single && (hovered || coarse) && !reduced;

  return (
    <div
      className={"cz-haul-fan" + (single ? " is-single" : "")}
      onMouseEnter={() => !single && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-hidden="true"
    >
      {slots.map((src, i) => {
        const offsetRatio = total <= 1 ? 0 : i / (total - 1);
        // The FRONT card (i === 0) stays flat and the rest fan out behind it.
        // It used to start at -10deg, which tilted the haul name once the
        // label moved onto the picture — and Kyle asked for the Shelf
        // treatment, where the name is level (2026-07-29).
        const targetRotate = open ? offsetRatio * angle : 0;
        const x = open ? offsetRatio * 10 : 0;
        return (
          <motion.div
            key={(src || "empty") + "-" + i}
            className={"cz-haul-fan-card" + (src ? "" : " is-empty")}
            animate={{
              rotate: targetRotate,
              x,
              scale: open && i === Math.floor(total / 2) ? 1.03 : 1,
            }}
            transition={
              reduced
                ? { duration: 0 }
                : { type: "spring", stiffness: 180, damping: 20, mass: 0.8 }
            }
            style={{
              zIndex: total - i,
              transformOrigin: "0% 100%",
            }}
          >
            {src ? (
              <img src={src} alt="" draggable={false} loading="lazy" decoding="async" />
            ) : (
              <div className="cz-haul-fan-placeholder">
                {(name || "?").slice(0, 1).toUpperCase()}
              </div>
            )}
            {/* i === 0 is the front card: zIndex is total - i. */}
            {i === 0 ? label : null}
          </motion.div>
        );
      })}
      {!single && count > slots.filter(Boolean).length ? (
        <span className="cz-haul-fan-more">+{count - slots.filter(Boolean).length}</span>
      ) : null}
    </div>
  );
}
