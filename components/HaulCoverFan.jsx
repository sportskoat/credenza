import { useState } from "react";
import { m as motion } from "framer-motion";
import {
  useCoarsePointer,
  usePrefersReducedMotion,
} from "../credenza-fashion.jsx";

// Haul directory cover: multi-item corner fan (transitions.dev CardCornerFan).
// Name + price sit in a separate label box below — not attached to the stack.
// One item = one flat card (no ghost stack). Two+ items fan on hover; on touch
// they rest half-fanned so multi-item hauls still read as stacks.
export default function HaulCoverFan({ covers = [], name = "", count = 0 }) {
  const [hovered, setHovered] = useState(false);
  const reduced = usePrefersReducedMotion();
  const coarse = useCoarsePointer();
  // Real covers only — never invent empty ghost cards for a 1-item haul.
  const images = covers.length ? covers.slice(0, 5) : [null];
  const slots = images;
  const total = slots.length;
  const single = total <= 1 || count <= 1;
  const angle = coarse && !hovered ? 22 : 36; // resting fan is tighter than hover fan
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
        const startAngle = -10;
        const targetRotate = open ? startAngle + offsetRatio * angle : 0;
        const x = open ? (offsetRatio - 0.5) * 10 : 0;
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
          </motion.div>
        );
      })}
      {!single && count > slots.filter(Boolean).length ? (
        <span className="cz-haul-fan-more">+{count - slots.filter(Boolean).length}</span>
      ) : null}
    </div>
  );
}
