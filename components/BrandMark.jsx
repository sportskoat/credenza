// The Credenza mark: rounded ground, outlined C, rule beneath.
//
// The C is a PATH, not live text. The old badge rendered a serif glyph and
// fell back to Georgia whenever the webfont missed, so the mark changed shape
// on slow connections. This outline is Instrument Serif 400 traced at the
// shipped icon-192.png geometry, so the app, the site and the installed icon
// are the same object.
//
// Colours are fixed in both themes on purpose (logo spec, Kyle 2026-07-26):
// a mark that shifts hue with the colourway is not a mark. The tokens exist
// so the values are named once, not so they can be re-themed.
export default function BrandMark({ size = 34, className = "", title = "Credenza" }) {
  return (
    <svg
      className={"cz-brand-mark" + (className ? " " + className : "")}
      viewBox="0 0 40 40"
      width={size}
      height={size}
      role="img"
      aria-label={title}
    >
      <rect width="40" height="40" rx="12.4" fill="var(--cz-brand-ground)" />
      <path
        fill="var(--cz-brand-c)"
        d="M21.30 27.80Q19.21 27.80 17.64 26.50Q16.07 25.20 15.21 22.84Q14.34 20.48 14.34 17.26Q14.34 14.15 15.29 11.81Q16.24 9.48 17.84 8.20Q19.43 6.91 21.39 6.91Q22.54 6.91 23.42 7.12Q24.30 7.33 24.98 7.67Q25.32 7.87 25.32 8.27L25.40 12.56Q25.40 13.04 25.06 13.04Q24.75 13.04 24.67 12.68L24.38 11.63Q23.79 9.43 23.01 8.58Q22.23 7.73 21.16 7.73Q19.18 7.73 17.87 10.17Q16.55 12.62 16.55 17.26Q16.55 20.42 17.21 22.60Q17.88 24.78 18.94 25.88Q20.00 26.98 21.19 26.98Q22.46 26.98 23.24 26.19Q24.02 25.40 24.55 23.14L24.89 21.75Q24.98 21.33 25.34 21.39Q25.66 21.44 25.66 21.87L25.54 26.45Q25.54 26.84 25.17 27.04Q24.50 27.38 23.58 27.59Q22.66 27.80 21.30 27.80Z"
      />
      <rect x="11.03" y="29.66" width="17.93" height="2.76" rx="1.38" fill="var(--cz-brand-rule)" />
    </svg>
  );
}
