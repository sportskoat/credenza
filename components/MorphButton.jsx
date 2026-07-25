import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePrefersReducedMotion } from "../credenza-fashion.jsx";

export default function MorphButton({
  label,
  icon: Icon,
  activeIcon: ActiveIcon,
  onClick,
  ariaLabel,
  disabled = false,
  className = "",
  title,
  iconOnly = false,
}) {
  const reduced = usePrefersReducedMotion();
  const [engaged, setEngaged] = useState(false);
  const CurrentIcon = engaged ? ActiveIcon : Icon;
  const showLabel = Boolean(label) && !iconOnly;
  return (
    <motion.button
      type="button"
      className={("cz-morph-button " + (iconOnly || !showLabel ? "is-icon-only " : "") + className).trim()}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel || label}
      title={title || label || ariaLabel}
      onMouseEnter={() => setEngaged(true)}
      onMouseLeave={() => setEngaged(false)}
      onFocus={() => setEngaged(true)}
      onBlur={() => setEngaged(false)}
      whileHover={reduced || disabled ? undefined : { scale: 1.02 }}
      whileTap={reduced || disabled ? undefined : { scale: 0.96 }}
      transition={{ duration: reduced ? 0 : 0.16 }}
    >
      <span className="cz-morph-icon" aria-hidden="true">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={engaged ? "active" : "idle"}
            initial={reduced ? false : { opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduced ? undefined : { opacity: 0, scale: 0.5 }}
            transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 600, damping: 25 }}
          >
            <CurrentIcon size={iconOnly || !showLabel ? 18 : 16} strokeWidth={2.2} />
          </motion.span>
        </AnimatePresence>
      </span>
      {showLabel ? <span>{label}</span> : null}
    </motion.button>
  );
}
