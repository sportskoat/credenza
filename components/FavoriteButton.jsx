import { useEffect, useRef } from "react";
import { cx } from "../credenza-fashion.jsx";

export default function FavoriteButton({ item, onToggle, className = "" }) {
  const favorite = item.favorite === true;
  const rootRef = useRef(null);
  const burstTimer = useRef(null);

  useEffect(() => () => clearTimeout(burstTimer.current), []);

  // transitions.dev-style burst: re-seed each dot's vector/velocity/delay/size
  // per like so the spray never repeats, then replay the animation.
  const burst = () => {
    const el = rootRef.current;
    if (!el) return;
    const dots = el.querySelectorAll(".t-like-particles i");
    dots.forEach((dot, i) => {
      const angle = (360 / dots.length) * i + (Math.random() * 2 - 1) * 16;
      const mag = 20 * (0.68 + Math.random() * 0.5);
      const rad = (angle * Math.PI) / 180;
      const s = dot.style;
      s.setProperty("--px", (Math.cos(rad) * mag).toFixed(2) + "px");
      s.setProperty("--py", (Math.sin(rad) * mag).toFixed(2) + "px");
      s.setProperty("--pdur", "calc(600ms * " + (0.78 + Math.random() * 0.44).toFixed(3) + ")");
      s.setProperty("--pdelay", Math.round(Math.random() * 70) + "ms");
      s.setProperty("--p-end-scale", (0.35 + Math.random() * 0.4).toFixed(2));
      s.setProperty("--psize", (0.6 + Math.random() * 0.8).toFixed(2));
    });
    el.classList.remove("is-bursting");
    void el.offsetWidth; // reflow so the burst replays
    el.classList.add("is-bursting");
    clearTimeout(burstTimer.current);
    burstTimer.current = setTimeout(() => el.classList.remove("is-bursting"), 750);
  };

  return (
    <button
      ref={rootRef}
      type="button"
      className={cx("cz-favorite-button t-like", className)}
      data-liked={favorite ? "true" : "false"}
      aria-pressed={favorite}
      aria-label={(favorite ? "Unstar " : "Star ") + (item.title || "item")}
      title={favorite ? "Unstar" : "Star"}
      onPointerDown={(event) => {
        // Keep carousel pan / flip from eating the heart hit.
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!favorite) burst();
        onToggle?.(item.id);
      }}
    >
      {/* Pop scale lives on the wrapper span, never the <svg> — transforming an
          inline SVG makes Chromium rasterise it at 1× (pixelated on hi-DPI). */}
      <span className="t-like-icon" aria-hidden="true">
        <svg className="t-like-heart" width="18" height="18" viewBox="0 0 16 16" fill="none">
          <path
            d="M7.99511 3.42388C6.66221 1.8656 4.4395 1.44643 2.76947 2.87334C1.09944 4.30026 0.86432 6.68598 2.17581 8.3736C3.26622 9.77674 6.56619 12.7361 7.64774 13.6939C7.76874 13.801 7.82925 13.8546 7.89982 13.8757C7.96141 13.8941 8.02881 13.8941 8.0904 13.8757C8.16097 13.8546 8.22147 13.801 8.34248 13.6939C9.42403 12.7361 12.724 9.77674 13.8144 8.3736C15.1259 6.68598 14.9195 4.28525 13.2207 2.87334C11.522 1.46144 9.32801 1.8656 7.99511 3.42388Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="t-like-particles" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => (
          <i key={i} />
        ))}
      </span>
    </button>
  );
}
