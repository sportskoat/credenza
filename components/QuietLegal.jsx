import { useState } from "react";

// Round 5 point 5.3 (2026-07-29 — Kyle: legal text "MUTED TO THE LARGEST
// DEGREE"). Legal and affiliate copy renders small, low contrast, never
// bold: one line in normal view, the full wording behind a small "i"
// control. The disclosure is never deleted — it stays one tap away, because
// the site makes a public promise about affiliate links.
export default function QuietLegal({
  line,
  more,
  className = "cz-quiet-legal",
  label = "About referral links",
  style,
}) {
  const [open, setOpen] = useState(false);
  return (
    <p className={className + (open ? " is-open" : "")} style={style}>
      <span>{line}</span>{" "}
      <button
        type="button"
        className="cz-quiet-legal-i"
        aria-expanded={open}
        aria-label={label}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
      >
        i
      </button>
      {open ? <span className="cz-quiet-legal-more"> {more}</span> : null}
    </p>
  );
}
