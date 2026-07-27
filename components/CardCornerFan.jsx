import { useEffect, useRef, useState } from "react";
import { m as motion } from "framer-motion";

// Photo fan on the card back (Kyle 2026-07-22): keep the little-card fan
// language — flat grid looked like a dump (size-chart cells etc.).
// variant "roomy" = taller peels for the product sheet so the back isn't empty.
// variant "compact" = original 80×60 stack (legacy / tight spots).
// Tap opens the full-screen gallery. Carousel physics untouched.
export default function CardCornerFan({
  item,
  images,
  onOpenPhotos,
  reduced,
  interactive = true,
  variant = "compact",
}) {
  const roomy = variant === "roomy";
  const maxShow = roomy ? 6 : 4;
  const cardW = roomy ? 88 : 60;
  const [isHovered, setIsHovered] = useState(false);
  const fanRef = useRef(null);
  const [fanWidth, setFanWidth] = useState(roomy ? 320 : 284);
  useEffect(() => {
    const fan = fanRef.current;
    if (!fan) return;
    const update = () => setFanWidth(fan.clientWidth || (roomy ? 320 : 284));
    update();
    if (!window.ResizeObserver) return;
    const observer = new window.ResizeObserver(update);
    observer.observe(fan);
    return () => observer.disconnect();
  }, [roomy]);
  const list = Array.isArray(images) ? images.filter(Boolean) : [];
  const displayed = list.slice(0, maxShow);
  const total = displayed.length;
  const maxStep = roomy ? 78 : 66;
  const spreadStep =
    total > 1 ? Math.min(maxStep, Math.max(0, (fanWidth - cardW) / (total - 1))) : 0;
  if (total === 0) return null;

  const openGallery = (e) => {
    if (!interactive) return;
    e?.stopPropagation?.();
    if (onOpenPhotos) onOpenPhotos(item, e?.currentTarget);
  };

  return (
    <div
      ref={fanRef}
      className={"cz-corner-fan" + (roomy ? " is-roomy" : "")}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      onClick={openGallery}
      role="button"
      tabIndex={interactive ? 0 : -1}
      aria-label="Open photo gallery"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          if (!interactive) return;
          e.preventDefault();
          openGallery(e);
        }
      }}
    >
      {displayed.map((src, i) => {
        // Cover left; rest peel flat on hover. Roomy starts half-open so the
        // tall product sheet already shows a fan, not a stacked stamp pile.
        const hover = isHovered;
        const restStep = roomy ? Math.min(spreadStep * 0.55, maxStep * 0.55) : 2;
        const step = hover ? spreadStep : restStep;
        const x = total <= 1 ? 0 : i * step;
        const angle = hover ? 0 : roomy ? i * 1.1 : i * 1.5;
        return (
          <motion.div
            key={src + i}
            className="cz-corner-fan-card"
            animate={{
              rotate: angle,
              x,
              y: 0,
              scale: hover && i === 0 ? 1.04 : 1,
              zIndex: maxShow + 1 - i,
            }}
            transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 240, damping: 22 }}
            style={{ originX: 0.5, originY: 1 }}
          >
            <img src={src} alt={"Gallery image " + (i + 1)} draggable={false} loading="lazy" decoding="async" />
          </motion.div>
        );
      })}
      {list.length > maxShow && (
        <span className="cz-corner-fan-more">+{list.length - maxShow}</span>
      )}
      {roomy && list.length > 1 ? (
        <span className="cz-corner-fan-caption">
          {list.length} photos · hover to fan · tap to browse
        </span>
      ) : null}
    </div>
  );
}
