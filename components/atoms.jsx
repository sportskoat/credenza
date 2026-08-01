import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { normalizeFindStatus } from "../credenza-find-status.js";
import {
  BG,
  CARD,
  CATEGORIES,
  SEG,
  SUB,
  FAINT,
  FIND_STATUS_COLORS,
  FIND_STATUS_LABELS,
  FONT,
  INK,
  cx,
  priceLabel,
  priceLabelShort,
  useCoarsePointer,
  usePrefersReducedMotion,
} from "../credenza-fashion.jsx";
import ComboboxField from "./ComboboxField.jsx";

// Gallery ambient — warm-white field with soft paper-light blooms that
// gently follow cursor/touch. Stays behind content; heavy blur keeps type clean.
export function HolographicBackground() {
  const [pos, setPos] = useState({ x: 50, y: 30 });
  const raf = useRef(null);
  const target = useRef({ x: 50, y: 30 });
  const calm = useCoarsePointer();

  useEffect(() => {
    if (calm) return; // static gradient on touch/phone — no loop, no listeners
    const update = () => {
      setPos((p) => ({
        x: p.x + (target.current.x - p.x) * 0.08,
        y: p.y + (target.current.y - p.y) * 0.08,
      }));
      raf.current = requestAnimationFrame(update);
    };
    raf.current = requestAnimationFrame(update);

    const onMove = (e) => {
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      target.current = { x, y };
    };
    const onTouch = (e) => {
      const t = e.touches[0];
      if (!t) return;
      target.current = {
        x: (t.clientX / window.innerWidth) * 100,
        y: (t.clientY / window.innerHeight) * 100,
      };
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("touchmove", onTouch, { passive: true });
    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchmove", onTouch);
    };
  }, [calm]);

  const { x, y } = calm ? { x: 50, y: 30 } : pos;
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        background: `
          radial-gradient(circle at ${x}% ${y}%, rgba(255, 255, 255, 0.85) 0%, transparent 42%),
          radial-gradient(circle at ${100 - x}% ${100 - y}%, rgba(226, 226, 220, 0.65) 0%, transparent 48%),
          radial-gradient(circle at ${y}% ${x}%, rgba(255, 255, 255, 0.55) 0%, transparent 46%),
          radial-gradient(circle at 50% 110%, rgba(214, 214, 207, 0.60) 0%, transparent 55%),
          radial-gradient(circle at 18% 18%, rgba(255, 255, 255, 0.45) 0%, transparent 38%),
          #F4F4F0
        `,
        filter: "blur(60px)",
        opacity: 0.95,
      }}
    />
  );
}

// Blackout dark ambient — pure black field with soft #1a1a1d neutral lifts.
// Quiet depth only; no loud color wash, zero blue cast.
export function RainbowBackground() {
  const [phase, setPhase] = useState(0);
  const raf = useRef(null);
  const reduced = usePrefersReducedMotion();
  const coarse = useCoarsePointer();
  const calm = reduced || coarse; // no cursor to chase on touch — freeze the drift

  useEffect(() => {
    if (calm) return;
    let t = 0;
    const update = () => {
      t += 0.0016;
      setPhase(t);
      raf.current = requestAnimationFrame(update);
    };
    raf.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf.current);
  }, [calm]);

  const driftX = Math.sin(phase) * 3;
  const driftY = Math.cos(phase * 0.7) * 2.5;

  return (
    <div
      aria-hidden="true"
      className="cz-gradient-bg"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
        background: "#000000",
      }}
    >
      {/* Soft neutral moons — barely-there depth from #1a1a1d */}
      <div
        style={{
          position: "absolute",
          inset: "-10%",
          background: `
            radial-gradient(ellipse 70% 55% at ${42 + driftX}% ${28 + driftY}%,
              rgba(26, 26, 29, 0.95) 0%,
              rgba(26, 26, 29, 0.45) 40%,
              transparent 72%
            ),
            radial-gradient(ellipse 55% 50% at ${72 - driftX}% ${62 + driftY}%,
              rgba(26, 26, 29, 0.72) 0%,
              rgba(15, 15, 18, 0.28) 45%,
              transparent 75%
            ),
            radial-gradient(ellipse 50% 40% at ${22 + driftY}% ${70 - driftX}%,
              rgba(40, 40, 46, 0.40) 0%,
              transparent 70%
            ),
            radial-gradient(ellipse 90% 60% at 50% 100%,
              rgba(0, 0, 0, 0.98) 0%,
              transparent 55%
            )
          `,
          filter: "blur(48px)",
          opacity: 0.9,
          transform: `scale(1.05) translate(${driftX * 0.1}%, ${driftY * 0.08}%)`,
        }}
      />
      {/* Thin neutral rim light at the top — blackout edge */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            linear-gradient(180deg, rgba(245, 245, 247, 0.05) 0%, transparent 22%),
            radial-gradient(ellipse 80% 50% at 50% 0%, rgba(26, 26, 29, 0.55) 0%, transparent 60%)
          `,
        }}
      />
    </div>
  );
}

export function Pill({ children, onClick, primary, subtle, style, title, disabled = false, loading = false, ...rest }) {
  const unavailable = disabled || loading;
  // Look lives in credenza-fashion.css (.cz-pill + data-variant); callers'
  // style prop is layout-only (flex, margins, minHeight overrides).
  return (
    <button
      type="button"
      onClick={unavailable ? undefined : onClick}
      title={title}
      disabled={unavailable}
      aria-busy={loading || undefined}
      className="cz-pill"
      data-variant={primary ? "primary" : subtle ? "subtle" : undefined}
      {...rest}
      style={style}
    >
      {children}
    </button>
  );
}


// ─── Spinning reel counter (transitions.dev-style odometer) ───
// One column per digit; a clipped strip of 0-9 cells translates up, and a
// vertical-only SVG feGaussianBlur gives the motion streak while travelling.
const REEL_CELL = 16; // px per digit row
const REEL_DUR = 900; // ms per column spin
const REEL_STAGGER = 70; // ms between column starts, left to right
const REEL_BLUR = 2.5; // px vertical streak at full speed
const REEL_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

export function ReelDigit({ digit, index, reduced }) {
  const [pos, setPos] = useState(reduced ? digit : 0);
  const stripRef = useRef(null);
  const blurRef = useRef(null);
  const spinningRef = useRef(false);
  // Fallback timer + a live handle on settle (Kyle 2026-07-26: the money
  // counter digits stay smeared). See the comment on the tween effect.
  const settleTimerRef = useRef(0);
  const settleRef = useRef(null);
  const fid = "reel-blur-" + useId().replace(/[^a-zA-Z0-9]/g, "");

  // Spin forward to the new digit, plus one full revolution for flavor.
  useEffect(() => {
    const delta = (digit - (pos % 10) + 10) % 10;
    if (delta === 0) return;
    spinningRef.current = true;
    setPos(pos + delta + 10);
  }, [digit, pos]);

  // Drive the tween imperatively so the transition carries a per-column stagger.
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    if (reduced) {
      strip.style.transition = "none";
      strip.style.transform = "translateY(" + -pos * REEL_CELL + "px)";
      return;
    }
    strip.style.transition =
      "transform " + REEL_DUR + "ms " + REEL_EASE + " " + index * REEL_STAGGER + "ms";
    strip.style.transform = "translateY(" + -pos * REEL_CELL + "px)";
    // Only streak while actually travelling — the settle snap re-runs this
    // effect and must not re-arm the blur.
    if (spinningRef.current && blurRef.current) {
      blurRef.current.setAttribute("stdDeviation", "0 " + REEL_BLUR);
      // Attach the filter only while travelling. An SVG filter that stays on
      // the element forces the text through the filter rasteriser on every
      // frame, so the glyphs read soft even at stdDeviation 0. At rest the
      // digits must be plain crisp text.
      strip.style.filter = "url(#" + fid + ")";
      // Belt and braces: settle on a timer as well as on transitionend.
      // transitionend is NOT guaranteed. It does not fire when the tab is
      // hidden, when the element is display:none or detached mid-tween, when
      // a new total interrupts the tween, or when the compositor drops the
      // transition. The blur was armed here and cleared ONLY in settle(), so
      // one missed event left the digits permanently smeared — which is what
      // Kyle saw. The timer clears the streak no matter what.
      clearTimeout(settleTimerRef.current);
      settleTimerRef.current = setTimeout(
        () => settleRef.current && settleRef.current(),
        REEL_DUR + index * REEL_STAGGER + 120
      );
    }
  }, [pos, index, reduced]);

  useEffect(() => () => clearTimeout(settleTimerRef.current), []);

  // Settle: kill the streak and snap the strip back into the 0-9 window (same
  // digit, since cells repeat) so the strip never grows without bound.
  const settle = () => {
    clearTimeout(settleTimerRef.current);
    if (!spinningRef.current) return;
    spinningRef.current = false;
    clearTimeout(settleTimerRef.current);
    if (blurRef.current) blurRef.current.setAttribute("stdDeviation", "0 0");
    const strip = stripRef.current;
    if (strip) {
      strip.style.transition = "none";
      strip.style.transform = "translateY(" + -(pos % 10) * REEL_CELL + "px)";
      // Drop the filter entirely so the resting digits rasterise as plain text.
      strip.style.filter = "none";
    }
    setPos((p) => p % 10);
  };
  // The timer fires from a stale closure otherwise. The ref itself is
  // declared above, next to settleTimerRef; only the handle is refreshed here.
  settleRef.current = settle;

  const cells = [];
  for (let i = 0; i <= pos; i++) cells.push(i % 10);

  return (
    <span className="t-reel-col" style={{ height: REEL_CELL }} aria-hidden="true">
      <svg className="t-reel-filter-def" focusable="false">
        <filter id={fid} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur ref={blurRef} in="SourceGraphic" stdDeviation="0 0" />
        </filter>
      </svg>
      <span
        ref={stripRef}
        className="t-reel-strip"
        /* No filter at rest — the tween effect attaches it while travelling. */
        style={{ transform: "translateY(" + -pos * REEL_CELL + "px)", filter: "none" }}
        onTransitionEnd={(e) => {
          if (e.propertyName === "transform") settle();
        }}
      >
        {cells.map((d, i) => (
          <span key={i} className="t-reel-digit" style={{ height: REEL_CELL }}>
            {d}
          </span>
        ))}
      </span>
    </span>
  );
}

export function ReelCounter({ value, currency = "USD" }) {
  const reduced = usePrefersReducedMotion();
  // CNY totals are whole yuan (itemCnyAmount rounds) — no decimal reels.
  // EUR totals keep the USD 2-decimal shape; only the symbol changes (2026-08-01).
  const text =
    currency === "CNY"
      ? "¥" + Math.max(0, Math.round(value)).toLocaleString("en-US")
      : (currency === "EUR" ? "€" : "$") +
        Math.max(0, value).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
  const len = text.length;
  return (
    <span className="t-reel">
      {/* Real value for AT; the reels are decorative. */}
      <span className="t-reel-sr">{text}</span>
      {text.split("").map((ch, i) => {
        // Key from the right so columns keep their identity as the total
        // grows a new leading digit on the left.
        const keyFromRight = len - 1 - i;
        return /\d/.test(ch) ? (
          <ReelDigit key={keyFromRight} digit={Number(ch)} index={i} reduced={reduced} />
        ) : (
          <span key={keyFromRight} className="t-reel-static" aria-hidden="true">
            {ch}
          </span>
        );
      })}
    </span>
  );
}

export function Caption({ children, style }) {
  return (
    <div
      style={{
        fontFamily: FONT,
        fontSize: 12,
        fontWeight: 650,
        letterSpacing: "0.01em",
        color: FAINT,
        textTransform: "none",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// Brand marks: inline SVGs for the recognizable services (render offline, always),
// site favicons for other links, and the plain type dot for notes or failed loads.
export function Favicon({ host, size, fallbackDot }) {
  const [ok, setOk] = useState(true);
  if (!ok)
    return (
      <span
        style={{ width: 6, height: 6, borderRadius: 3, background: fallbackDot, flexShrink: 0 }}
      />
    );
  return (
    <img
      src={"https://www.google.com/s2/favicons?domain=" + encodeURIComponent(host) + "&sz=64"}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setOk(false)}
      style={{ borderRadius: 3, flexShrink: 0, display: "block" }}
    />
  );
}

// ═══ ORDER STATUS (shelf handoff 2026-07-28) ═════════════════════════════
// One question, two answers: did you buy it, or not?
//
// This replaced a seven-stop pipeline — want / bought / shipped / QC / green
// light / red light / returned. That track asked the customer to hand-maintain
// a shipping database, and a stale track is worse than no track: it reports a
// state that is not true. Kyle cut it to the one fact the shelf actually uses.
//
// Round 4 point 4 (2026-07-29): the two large Want/Bought buttons were the
// loudest block in the rail. Kyle: keep both answers, "implement so it's not
// in an obnoxious way". So the control is now one small switch at the right
// end of the row — off writes "want", on writes "bought". The stored values
// and the value/onChange contract do not change.
export function StatusToggle({ value, onChange, label = "Status" }) {
  const bought = normalizeFindStatus(value) === "bought";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={bought}
      aria-label={label}
      data-status={bought ? "bought" : "want"}
      className={"cz-status-toggle" + (bought ? " is-on" : "")}
      onClick={() => onChange && onChange(bought ? "want" : "bought")}
    >
      <span className="cz-status-toggle-thumb" aria-hidden="true" />
    </button>
  );
}

// findStatus pill. "pill" = standalone overlay chip with per-status colors;
// "chip" = colored text riding a shared cz-meta-chip (card-back meta row).
// "want" renders nothing anywhere — it's the default, not a fact worth space.
export function StatusPill({ status, variant = "pill", className, style }) {
  if (!status || status === "want") return null;
  const colors = FIND_STATUS_COLORS[status] || {};
  // CH-06: the pill spells the status out ("Quality check", never "QC") —
  // the raw enum leaked bare initials through the uppercase transform.
  const label = FIND_STATUS_LABELS[status] || status;
  if (variant === "chip") {
    return (
      <span className={cx("cz-meta-chip", className)} style={{ color: colors.text || INK, ...style }}>
        {label}
      </span>
    );
  }
  return (
    <span
      className={cx("cz-status-pill", className)}
      style={{ background: colors.bg || "transparent", color: colors.text || INK, ...style }}
    >
      {label}
    </span>
  );
}

// Round 4 point 6 (2026-07-29): one "Bought" mark on both cards. Kyle's
// picture showed the grid card — a small green dot and the plain word at the
// top-left of the photo, no pill, no background — and asked for the same mark
// on the carousel. `variant` is position/type-scale only ("grid" | "carousel");
// the mark itself never changes. Renders nothing unless the item is bought —
// "want" is the default, not a fact worth space.
export function StatusTag({ status, variant = "grid", className }) {
  if (status !== "bought") return null;
  return (
    <span className={cx("cz-card-status-tag", "is-" + variant, className)}>
      <span className="cz-card-status-tag-dot" aria-hidden="true" />
      Bought
    </span>
  );
}

// Price display. "overlay" = short pill pinned over a photo; "hero" = full
// card-back hero; "meta" = inline full label in a text row.
export function PriceChip({ item, variant = "overlay", className, style }) {
  // One currency per chip (Kyle 2026-07-22), following the primary pref —
  // both directions convert (Kyle 2026-07-28).
  const label = variant === "meta" ? priceLabel(item) : priceLabelShort(item);
  if (!label) return null;
  if (variant === "hero") {
    return (
      <div className={cx("cz-carousel-price-hero", className)} style={style}>
        {label}
      </div>
    );
  }
  if (variant === "meta") {
    return (
      <span className={cx("cz-price-meta", className)} style={style}>
        {label}
      </span>
    );
  }
  return (
    <span className={cx("cz-price-chip", className)} style={style}>
      {label}
    </span>
  );
}

export function Field({ label, value, onChange, placeholder, rows, suggestions, onCommit, emptyHint, listLabel, allowCreate }) {
  const id = useId();
  // Combobox fields use the organic transitions.dev dropdown instead of the
  // native datalist (which paints a gray OS menu on top of the card).
  if (!rows && Array.isArray(suggestions)) {
    const isHaul = label && /haul/i.test(label);
    return (
      <ComboboxField
        label={label}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        suggestions={suggestions}
        onCommit={onCommit}
        emptyHint={emptyHint}
        listLabel={listLabel}
        allowCreate={allowCreate !== false}
        createVerb={isHaul ? "Create" : "Use"}
        addNewLabel={isHaul ? "+ Add new haul" : ""}
        clearLabel={isHaul && String(value || "").trim() ? "Remove from haul" : ""}
        onClear={isHaul ? () => { onChange(""); onCommit?.(""); } : undefined}
        chevronLabel={listLabel ? "Show " + listLabel.toLowerCase() : "Show options"}
      />
    );
  }
  const common = {
    width: "100%",
    boxSizing: "border-box",
    fontFamily: FONT,
    fontSize: 14,
    color: INK,
    background: BG,
    border: "1px solid transparent",
    borderRadius: 10,
    padding: "10px 12px",
  };
  return (
    <label className="cz-field-label" htmlFor={id}>
      <span>{label}</span>
      {rows ? (
        <textarea
          id={id}
          className="cz-field"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          style={{ ...common, resize: "vertical", lineHeight: 1.5 }}
        />
      ) : (
        <input
          id={id}
          className="cz-field"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={common}
        />
      )}
    </label>
  );
}

// One segmented radiogroup for every chip-style picker — unit toggles and
// other compact radios. Category uses CategorySelect (design 4c).
export function SegmentedControl({ value, onChange, options, label, allowUnset = false }) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      style={{ display: "flex", flexWrap: "wrap", gap: 4, background: SEG, borderRadius: 12, padding: 2 }}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            type="button"
            role="radio"
            aria-checked={active}
            className="cz-chip"
            key={opt.value}
            onClick={() => onChange(active && allowUnset ? "" : opt.value)}
            style={{
              flex: "1 0 auto",
              fontFamily: FONT,
              fontSize: 11,
              fontWeight: 600,
              color: active ? INK : SUB,
              background: active ? CARD : "transparent",
              border: "none",
              borderRadius: 999,
              padding: "6px 8px",
              cursor: "pointer",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// Design 4c (CH-07): category is one select row — value + a muted "auto" tag
// (auto-classified, not hand-picked) + chevron. Tap opens a wrapping chip
// list, selected solid. All ten categories fit, so there is no "More…" tail.
export function CategorySelect({ value, isAuto, onChange, label = "Category" }) {
  const [open, setOpen] = useState(false);
  const currentLabel = (CATEGORIES[value] && CATEGORIES[value].label) || "Not set";
  return (
    <div className={"cz-catselect t-acc" + (open ? " is-open" : "")} data-open={open}>
      <button
        type="button"
        className="cz-catselect-btn"
        aria-label={label + ": " + currentLabel + ". Change."}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="cz-catselect-value">{currentLabel}</span>
        {isAuto && CATEGORIES[value] ? (
          <span className="cz-catselect-auto">auto</span>
        ) : null}
        <ChevronDown
          className="t-acc-chevron"
          size={14}
          strokeWidth={2}
          aria-hidden="true"
        />
      </button>
      <div className="t-acc-panel" aria-hidden={!open} inert={!open ? "" : undefined}>
        <div className="t-acc-panel-inner">
          <div
            className="cz-catselect-list t-panel-slide"
            data-open={open}
            role="listbox"
            aria-label={label}
          >
            {Object.entries(CATEGORIES).map(([key, cat]) => {
              const active = value === key;
              return (
                <button
                  type="button"
                  key={key}
                  role="option"
                  aria-selected={active}
                  className={"cz-catselect-chip" + (active ? " is-active" : "")}
                  onClick={() => {
                    onChange && onChange(key);
                    setOpen(false);
                  }}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// Shared status control. Every surface draws the same two-option switch since
// the shelf handoff (2026-07-28) cut order status to bought-or-not. `mode` is
// kept so existing callers still compile, but it no longer changes the shape:
// one question deserves exactly one control.
export function StatusChips({ value, onChange, label = "Status", mode: _mode = "display" }) {
  return <StatusToggle value={value} onChange={onChange} label={label} />;
}
