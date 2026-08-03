/* @ds-bundle: {"format":4,"namespace":"CredenzaFashionDesignSystem_8f0205","components":[{"name":"BrandLockup","sourcePath":"components/brand/BrandLockup.jsx"},{"name":"BrandMark","sourcePath":"components/brand/BrandMark.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"BuyButton","sourcePath":"components/core/BuyButton.jsx"},{"name":"Caption","sourcePath":"components/core/Caption.jsx"},{"name":"Chip","sourcePath":"components/core/Chip.jsx"},{"name":"Field","sourcePath":"components/core/Field.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"Kicker","sourcePath":"components/core/Kicker.jsx"},{"name":"SearchField","sourcePath":"components/core/SearchField.jsx"},{"name":"SegmentedControl","sourcePath":"components/core/SegmentedControl.jsx"},{"name":"ModalShell","sourcePath":"components/feedback/ModalShell.jsx"},{"name":"Toast","sourcePath":"components/feedback/Toast.jsx"},{"name":"Masthead","sourcePath":"components/navigation/Masthead.jsx"},{"name":"ViewTabs","sourcePath":"components/navigation/ViewTabs.jsx"},{"name":"HaulBar","sourcePath":"components/shelf/HaulBar.jsx"},{"name":"PriceChip","sourcePath":"components/shelf/PriceChip.jsx"},{"name":"ProductCard","sourcePath":"components/shelf/ProductCard.jsx"},{"name":"SizeChartTable","sourcePath":"components/shelf/SizeChartTable.jsx"},{"name":"SizeRecommendation","sourcePath":"components/shelf/SizeRecommendation.jsx"},{"name":"StatusPill","sourcePath":"components/shelf/StatusPill.jsx"},{"name":"StatusTrack","sourcePath":"components/shelf/StatusTrack.jsx"}],"sourceHashes":{"components/brand/BrandLockup.jsx":"3ce34ec92685","components/brand/BrandMark.jsx":"739ddf37f513","components/core/Button.jsx":"b9fdd0856b60","components/core/BuyButton.jsx":"b5f2c19043ee","components/core/Caption.jsx":"88ed2f36c9be","components/core/Chip.jsx":"ae5171e3e05c","components/core/Field.jsx":"3bf740293bc2","components/core/IconButton.jsx":"4a0818055c46","components/core/Kicker.jsx":"1a9661b44857","components/core/SearchField.jsx":"2caf8945e4de","components/core/SegmentedControl.jsx":"b7b22072bb3d","components/feedback/ModalShell.jsx":"abc91cea9d90","components/feedback/Toast.jsx":"c46122b21231","components/navigation/Masthead.jsx":"ac9e257c590d","components/navigation/ViewTabs.jsx":"5b3e0b90c355","components/shelf/HaulBar.jsx":"80ef1dbf2d9b","components/shelf/PriceChip.jsx":"edeaba39d94c","components/shelf/ProductCard.jsx":"680e07c8c5ab","components/shelf/SizeChartTable.jsx":"2b5fc405d49a","components/shelf/SizeRecommendation.jsx":"8c49e8e4f05e","components/shelf/StatusPill.jsx":"37250451e726","components/shelf/StatusTrack.jsx":"5325f6aa5829","ui_kits/fashion_app/AppShell.jsx":"db5653b6a2a1","ui_kits/fashion_app/DetailScreen.jsx":"01d67931f4c1","ui_kits/fashion_app/EmptyShelfScreen.jsx":"637d000a5627","ui_kits/fashion_app/HaulsScreen.jsx":"700477fa5030","ui_kits/fashion_app/ShelfScreen.jsx":"e15b0937cc7a","ui_kits/fashion_app/data.js":"fcabe466705a","ui_kits/marketing_site/Blocks.jsx":"35fc89917282","ui_kits/marketing_site/Nav.jsx":"32b466146060","ui_kits/marketing_site/Sections.jsx":"59c9fb73ec4d"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.CredenzaFashionDesignSystem_8f0205 = window.CredenzaFashionDesignSystem_8f0205 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/brand/BrandMark.jsx
try { (() => {
// The Credenza mark: rounded ground, outlined C, blue rule beneath.
// The C is a PATH, not live text — a serif glyph fell back to Georgia when the
// webfont missed and the mark changed shape on slow connections. This outline
// is Instrument Serif 400 traced at the shipped icon-192.png geometry.
// Colours are FIXED in both themes on purpose: a mark that re-tints with the
// colourway is not a mark.
function BrandMark({
  size = 34,
  title = "Credenza",
  className = "",
  style
}) {
  return /*#__PURE__*/React.createElement("svg", {
    className: "cz-brand-mark" + (className ? " " + className : ""),
    viewBox: "0 0 40 40",
    width: size,
    height: size,
    role: "img",
    "aria-label": title,
    style: {
      display: "block",
      flex: "0 0 auto",
      ...style
    }
  }, /*#__PURE__*/React.createElement("rect", {
    width: "40",
    height: "40",
    rx: "12.4",
    fill: "var(--cz-brand-ground)"
  }), /*#__PURE__*/React.createElement("path", {
    fill: "var(--cz-brand-c)",
    d: "M21.30 27.80Q19.21 27.80 17.64 26.50Q16.07 25.20 15.21 22.84Q14.34 20.48 14.34 17.26Q14.34 14.15 15.29 11.81Q16.24 9.48 17.84 8.20Q19.43 6.91 21.39 6.91Q22.54 6.91 23.42 7.12Q24.30 7.33 24.98 7.67Q25.32 7.87 25.32 8.27L25.40 12.56Q25.40 13.04 25.06 13.04Q24.75 13.04 24.67 12.68L24.38 11.63Q23.79 9.43 23.01 8.58Q22.23 7.73 21.16 7.73Q19.18 7.73 17.87 10.17Q16.55 12.62 16.55 17.26Q16.55 20.42 17.21 22.60Q17.88 24.78 18.94 25.88Q20.00 26.98 21.19 26.98Q22.46 26.98 23.24 26.19Q24.02 25.40 24.55 23.14L24.89 21.75Q24.98 21.33 25.34 21.39Q25.66 21.44 25.66 21.87L25.54 26.45Q25.54 26.84 25.17 27.04Q24.50 27.38 23.58 27.59Q22.66 27.80 21.30 27.80Z"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "11.03",
    y: "29.66",
    width: "17.93",
    height: "2.76",
    rx: "1.38",
    fill: "var(--cz-brand-rule)"
  }));
}
Object.assign(__ds_scope, { BrandMark });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/BrandMark.jsx", error: String((e && e.message) || e) }); }

// components/brand/BrandLockup.jsx
try { (() => {
// Mark + stacked wordmark. CREDENZA is the sans at 800 tracked 0.16em; the
// kicker under it (Fashion) is 8.5px tracked 0.30em. The two lines are the
// logo — do not set them in the serif, do not letterspace them differently.
function BrandLockup({
  kicker = "Fashion",
  size = 30,
  gap = 11,
  className = "",
  style
}) {
  return /*#__PURE__*/React.createElement("span", {
    className: "cz-brand-lockup" + (className ? " " + className : ""),
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap,
      fontFamily: "var(--cz-sans)",
      color: "var(--cz-ink)",
      ...style
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.BrandMark, {
    size: size
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      flexDirection: "column",
      alignItems: "flex-start",
      gap: 3,
      lineHeight: 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13.5,
      fontWeight: 800,
      letterSpacing: "0.16em",
      lineHeight: 1
    }
  }, "CREDENZA"), kicker ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 8.5,
      fontWeight: 700,
      letterSpacing: "0.30em",
      textTransform: "uppercase",
      lineHeight: 1,
      color: "var(--cz-faint)"
    }
  }, kicker) : null));
}
Object.assign(__ds_scope, { BrandLockup });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/BrandLockup.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// The Credenza pill. One shape for every button in the app chrome: 999px,
// 40px min height, 13px/600 sans, tracked -0.01em. Three variants only.
//   default  — muted ink fill (near-solid ink on light, near-white on dark)
//   primary  — full action fill
//   subtle   — no fill, sub-ink label
// Press is a 0.96 scale; hover is a 2% brightness drop, never a colour change.
const VARIANT = {
  default: {
    color: "var(--cz-action-muted-text)",
    background: "var(--cz-action-muted-bg)"
  },
  primary: {
    color: "var(--cz-action-text)",
    background: "var(--cz-action-fill)"
  },
  subtle: {
    color: "var(--cz-sub)",
    background: "transparent"
  }
};
function Button({
  children,
  variant = "default",
  onClick,
  disabled = false,
  loading = false,
  title,
  type = "button",
  className = "",
  style,
  ...rest
}) {
  const unavailable = disabled || loading;
  const [pressed, setPressed] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    className: "cz-pill" + (className ? " " + className : ""),
    "data-variant": variant === "default" ? undefined : variant,
    title: title,
    disabled: unavailable,
    "aria-busy": loading || undefined,
    onClick: unavailable ? undefined : onClick,
    onPointerDown: () => setPressed(true),
    onPointerUp: () => setPressed(false),
    onPointerLeave: () => {
      setPressed(false);
      setHover(false);
    },
    onPointerEnter: () => setHover(true)
  }, rest, {
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      fontFamily: "var(--cz-sans)",
      fontSize: 13,
      fontWeight: 600,
      letterSpacing: "-0.01em",
      border: "none",
      borderRadius: 999,
      minHeight: 40,
      padding: "8px 14px",
      cursor: unavailable ? "not-allowed" : "pointer",
      whiteSpace: "nowrap",
      opacity: unavailable ? 0.56 : 1,
      filter: hover && !unavailable ? "brightness(0.98)" : "none",
      transform: pressed && !unavailable ? "scale(0.96)" : "none",
      transition: "transform var(--dur-micro) var(--ease-out), background var(--dur-micro) var(--ease-out), color var(--dur-micro) var(--ease-out), opacity var(--dur-micro) var(--ease-out)",
      ...VARIANT[variant],
      ...style
    }
  }), children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/BuyButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// The one dominant action on a card. Solid ink, 42px, full width, 13px/700.
// It is deliberately NOT the pill: Buy is the only control in the system with
// its own geometry, so a customer never confuses it with chrome.
function BuyButton({
  label = "Buy",
  agent,
  onClick,
  disabled = false,
  className = "",
  style,
  ...rest
}) {
  const [pressed, setPressed] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  const text = agent ? label + " via " + agent : label;
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    className: "cz-buy-btn" + (className ? " " + className : ""),
    disabled: disabled,
    onClick: onClick,
    onPointerDown: () => setPressed(true),
    onPointerUp: () => setPressed(false),
    onPointerEnter: () => setHover(true),
    onPointerLeave: () => {
      setPressed(false);
      setHover(false);
    }
  }, rest, {
    style: {
      position: "relative",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      height: 42,
      minHeight: 42,
      padding: "0 16px",
      border: 0,
      borderRadius: 999,
      background: "var(--cz-ink)",
      color: "var(--cz-card-solid)",
      fontFamily: "var(--cz-sans)",
      fontSize: 13,
      fontWeight: 700,
      letterSpacing: "0.01em",
      lineHeight: 1,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : hover ? 0.94 : 1,
      transform: pressed && !disabled ? "scale(0.98)" : "none",
      transition: "opacity var(--dur-micro) var(--ease-out), transform var(--dur-press) var(--ease-out)",
      ...style
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "relative",
      zIndex: 2
    }
  }, text));
}
Object.assign(__ds_scope, { BuyButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/BuyButton.jsx", error: String((e && e.message) || e) }); }

// components/core/Caption.jsx
try { (() => {
// 12px/650 sans in --cz-faint. The quiet line under a control or a card.
function Caption({
  children,
  className = "",
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "cz-caption" + (className ? " " + className : ""),
    style: {
      fontFamily: "var(--cz-sans)",
      fontSize: 12,
      fontWeight: 650,
      letterSpacing: "0.01em",
      color: "var(--cz-faint)",
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Caption });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Caption.jsx", error: String((e && e.message) || e) }); }

// components/core/Chip.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// Small radio chip used inside SegmentedControl and as a standalone filter.
// 11px/600, 999px, no border. Active swaps to the card fill + full ink.
function Chip({
  children,
  active = false,
  onClick,
  disabled = false,
  role,
  className = "",
  style,
  ...rest
}) {
  const [pressed, setPressed] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    role: role,
    "aria-checked": role === "radio" ? active : undefined,
    "aria-pressed": role ? undefined : active,
    className: "cz-chip" + (className ? " " + className : ""),
    disabled: disabled,
    onClick: onClick,
    onPointerDown: () => setPressed(true),
    onPointerUp: () => setPressed(false),
    onPointerLeave: () => setPressed(false)
  }, rest, {
    style: {
      flex: "1 0 auto",
      fontFamily: "var(--cz-sans)",
      fontSize: 11,
      fontWeight: 600,
      color: active ? "var(--cz-ink)" : "var(--cz-sub)",
      background: active ? "var(--cz-card)" : "transparent",
      border: "none",
      borderRadius: 999,
      padding: "6px 8px",
      minHeight: 28,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      transform: pressed && !disabled ? "scale(0.94)" : "none",
      transition: "transform var(--dur-press) var(--ease-out), background var(--dur-micro) var(--ease-out), color var(--dur-micro) var(--ease-out)",
      ...style
    }
  }), children);
}
Object.assign(__ds_scope, { Chip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Chip.jsx", error: String((e && e.message) || e) }); }

// components/core/Field.jsx
try { (() => {
// Labelled text / textarea. Label is 12px/650 in --cz-faint above a 10px-radius
// field on the page background — never a white box on a white card.
function Field({
  label,
  value,
  onChange,
  placeholder,
  rows,
  id,
  disabled = false,
  className = "",
  style
}) {
  const auto = React.useId();
  const fieldId = id || auto;
  const [focus, setFocus] = React.useState(false);
  const common = {
    width: "100%",
    boxSizing: "border-box",
    fontFamily: "var(--cz-sans)",
    fontSize: 14,
    color: "var(--cz-ink)",
    background: "var(--cz-bg)",
    border: "1px solid transparent",
    borderRadius: 10,
    padding: "10px 12px",
    caretColor: "var(--cz-accent)",
    outline: focus ? "2px solid var(--cz-focus)" : "none",
    outlineOffset: 2
  };
  return /*#__PURE__*/React.createElement("label", {
    className: "cz-field-label" + (className ? " " + className : ""),
    htmlFor: fieldId,
    style: {
      display: "grid",
      gap: 5,
      color: "var(--cz-faint)",
      fontFamily: "var(--cz-sans)",
      fontSize: 12,
      fontWeight: 650,
      lineHeight: 1.25,
      opacity: disabled ? 0.56 : 1,
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", null, label), rows ? /*#__PURE__*/React.createElement("textarea", {
    id: fieldId,
    className: "cz-note-field",
    value: value,
    rows: rows,
    disabled: disabled,
    placeholder: placeholder,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    onChange: e => onChange && onChange(e.target.value),
    style: {
      ...common,
      resize: "vertical",
      lineHeight: 1.5
    }
  }) : /*#__PURE__*/React.createElement("input", {
    id: fieldId,
    className: "cz-field",
    value: value,
    disabled: disabled,
    placeholder: placeholder,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    onChange: e => onChange && onChange(e.target.value),
    style: common
  }));
}
Object.assign(__ds_scope, { Field });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Field.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// Round 40px (44px on touch) chrome button — the heart, the close, the
// overflow. Icon only, no fill at rest, quiet accent tint on hover.
function IconButton({
  children,
  label,
  onClick,
  active = false,
  size = 40,
  disabled = false,
  className = "",
  style,
  ...rest
}) {
  const [pressed, setPressed] = React.useState(false);
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    className: "cz-icon-button" + (className ? " " + className : ""),
    "aria-label": label,
    "aria-pressed": active || undefined,
    disabled: disabled,
    onClick: onClick,
    onPointerDown: () => setPressed(true),
    onPointerUp: () => setPressed(false),
    onPointerEnter: () => setHover(true),
    onPointerLeave: () => {
      setPressed(false);
      setHover(false);
    }
  }, rest, {
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: size,
      height: size,
      minWidth: size,
      minHeight: size,
      padding: 0,
      border: 0,
      borderRadius: 999,
      background: hover && !disabled ? "color-mix(in srgb, var(--cz-accent) 10%, transparent)" : "transparent",
      color: active ? "var(--cz-like)" : hover ? "var(--cz-accent-deep)" : "var(--cz-sub)",
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.5 : 1,
      transform: pressed && !disabled ? "scale(0.94)" : "none",
      transition: "transform var(--dur-press) var(--ease-out), color var(--dur-micro) var(--ease-out), background var(--dur-micro) var(--ease-out)",
      ...style
    }
  }), children);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/core/Kicker.jsx
try { (() => {
// Mono, uppercase, tracked. The section label above every serif heading and
// the small label inside panels. Never the serif, never sentence case.
function Kicker({
  children,
  size = 11,
  tracking = "0.14em",
  tone = "muted",
  as: Tag = "div",
  className = "",
  style
}) {
  const color = tone === "money" ? "var(--cz-money)" : tone === "ink" ? "var(--cz-ink)" : "var(--cz-faint)";
  return /*#__PURE__*/React.createElement(Tag, {
    className: "cz-kicker" + (className ? " " + className : ""),
    style: {
      fontFamily: "var(--cz-mono)",
      fontSize: size,
      fontWeight: 700,
      letterSpacing: tracking,
      textTransform: "uppercase",
      color,
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Kicker });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Kicker.jsx", error: String((e && e.message) || e) }); }

// components/core/SearchField.jsx
try { (() => {
// Two shapes, one component.
//   variant="bar"  — the 999px shelf search bar that lives beside the tabs
//   variant="hero" — the 52px 14px-radius empty-shelf paste field
function SearchField({
  value,
  onChange,
  placeholder = "Search your shelf",
  variant = "bar",
  onClear,
  leading,
  trailing,
  className = "",
  style
}) {
  const [focus, setFocus] = React.useState(false);
  const hero = variant === "hero";
  return /*#__PURE__*/React.createElement("div", {
    className: (hero ? "cz-empty-hero-search" : "cz-search-shell") + (className ? " " + className : ""),
    style: {
      flex: "1 1 auto",
      minWidth: 0,
      display: "flex",
      alignItems: "center",
      gap: hero ? 11 : 8,
      boxSizing: "border-box",
      height: hero ? 52 : undefined,
      minHeight: hero ? undefined : 44,
      padding: hero ? "0 16px" : "4px 12px 4px 14px",
      borderRadius: hero ? 14 : 999,
      border: "1px solid " + (focus ? "color-mix(in srgb, var(--cz-ink) 30%, var(--cz-hair))" : hero ? "var(--cz-hair)" : "var(--cz-hair-strong)"),
      background: hero ? "var(--cz-bg-elevated)" : "var(--cz-card-solid)",
      boxShadow: focus ? "0 0 0 3px var(--cz-glow-weak), var(--shadow-hairline)" : "var(--shadow-hairline)",
      cursor: "text",
      transition: "border-color var(--dur-micro) var(--ease-out), box-shadow var(--dur-micro) var(--ease-out)",
      ...style
    }
  }, leading ? /*#__PURE__*/React.createElement("span", {
    style: {
      flex: "0 0 auto",
      display: "inline-flex",
      color: "var(--cz-faint)"
    }
  }, leading) : null, /*#__PURE__*/React.createElement("input", {
    className: "cz-search-input",
    value: value,
    placeholder: placeholder,
    onChange: e => onChange && onChange(e.target.value),
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      flex: "1 1 auto",
      minWidth: 0,
      height: hero ? "auto" : 36,
      margin: 0,
      padding: 0,
      border: 0,
      background: "transparent",
      color: "var(--cz-ink)",
      fontFamily: "var(--cz-sans)",
      fontSize: hero ? 15 : 13.5,
      fontWeight: hero ? 500 : 400,
      outline: "none"
    }
  }), value && onClear ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Clear search",
    onClick: onClear,
    style: {
      flex: "0 0 auto",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: 28,
      height: 28,
      border: 0,
      borderRadius: 999,
      background: "transparent",
      color: "var(--cz-sub)",
      cursor: "pointer",
      fontSize: 15,
      lineHeight: 1
    }
  }, "\xD7") : null, trailing);
}
Object.assign(__ds_scope, { SearchField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/SearchField.jsx", error: String((e && e.message) || e) }); }

// components/core/SegmentedControl.jsx
try { (() => {
// One segmented radiogroup for every compact picker — units, sort, view mode.
// Track is --cz-seg at 12px radius with 2px padding; the puck is the card fill.
function SegmentedControl({
  value,
  onChange,
  options,
  label,
  allowUnset = false,
  className = "",
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "radiogroup",
    "aria-label": label,
    className: "cz-segmented" + (className ? " " + className : ""),
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 4,
      background: "var(--cz-seg)",
      borderRadius: 12,
      padding: 2,
      ...style
    }
  }, options.map(opt => {
    const active = value === opt.value;
    return /*#__PURE__*/React.createElement(__ds_scope.Chip, {
      key: opt.value,
      role: "radio",
      active: active,
      onClick: () => onChange && onChange(active && allowUnset ? "" : opt.value)
    }, opt.label);
  }));
}
Object.assign(__ds_scope, { SegmentedControl });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/SegmentedControl.jsx", error: String((e && e.message) || e) }); }

// components/feedback/ModalShell.jsx
try { (() => {
// Modal / bottom-sheet shell. 720px cap on desktop; on a coarse pointer it
// anchors to the bottom edge with 18px top corners and 88dvh max height.
// Backdrop is a 0.5 ink scrim with a 6px blur.
function ModalShell({
  open = true,
  title,
  subtitle,
  onClose,
  footer,
  children,
  width = 720,
  sheet = false,
  className = "",
  style
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: sheet ? "flex-end" : "center",
      justifyContent: "center",
      background: "oklch(0.16 0.01 260 / 0.5)",
      backdropFilter: "blur(6px)",
      WebkitBackdropFilter: "blur(6px)",
      zIndex: 60
    },
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "cz-modal-surface" + (className ? " " + className : ""),
    role: "dialog",
    "aria-modal": "true",
    "aria-label": title,
    onClick: e => e.stopPropagation(),
    style: {
      width: sheet ? "100%" : "min(" + width + "px, calc(100% - 32px))",
      maxHeight: sheet ? "88%" : "min(760px, calc(100% - 32px))",
      overflow: "auto",
      background: "var(--cz-card-solid)",
      color: "var(--cz-ink)",
      borderRadius: sheet ? "18px 18px 0 0" : 20,
      boxShadow: "var(--shadow-modal)",
      ...style
    }
  }, sheet ? /*#__PURE__*/React.createElement("div", {
    "aria-hidden": "true",
    style: {
      width: 38,
      height: 4,
      borderRadius: 999,
      background: "var(--cz-hair)",
      margin: "10px auto 0"
    }
  }) : null, title || onClose ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-start",
      gap: 12,
      padding: "18px 20px 12px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, title ? /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      fontFamily: "var(--cz-display)",
      fontSize: 22,
      fontWeight: 600,
      letterSpacing: "-0.035em",
      color: "var(--cz-ink)"
    }
  }, title) : null, subtitle ? /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "4px 0 0",
      fontFamily: "var(--cz-sans)",
      fontSize: 12,
      color: "var(--cz-faint)"
    }
  }, subtitle) : null), onClose ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Close",
    onClick: onClose,
    style: {
      display: "grid",
      placeItems: "center",
      width: 34,
      height: 34,
      borderRadius: 999,
      border: "1px solid var(--cz-hair)",
      background: "transparent",
      color: "var(--cz-sub)",
      cursor: "pointer",
      fontSize: 15,
      lineHeight: 1
    }
  }, "\xD7") : null) : null, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "0 20px 20px"
    }
  }, children), footer ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      justifyContent: "flex-end",
      padding: "0 20px 20px"
    }
  }, footer) : null));
}
Object.assign(__ds_scope, { ModalShell });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/ModalShell.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Toast.jsx
try { (() => {
// Toast. Muted-ink fill, 520px cap, centred over the bottom bar. Error tone
// swaps to the error pair. No icon unless the caller passes one.
function Toast({
  children,
  tone = "default",
  icon,
  action,
  onAction,
  className = "",
  style
}) {
  const error = tone === "error";
  return /*#__PURE__*/React.createElement("div", {
    className: "cz-toast" + (className ? " " + className : ""),
    "data-tone": error ? "error" : undefined,
    role: "status",
    style: {
      width: "min(520px, 100%)",
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "11px 12px 11px 14px",
      borderRadius: 999,
      fontFamily: "var(--cz-sans)",
      fontSize: 13,
      fontWeight: 600,
      color: error ? "var(--cz-error-text)" : "var(--cz-action-muted-text)",
      background: error ? "var(--cz-error-bg)" : "var(--cz-action-muted-bg)",
      border: "1px solid " + (error ? "color-mix(in oklch, var(--cz-error-text) 18%, transparent)" : "color-mix(in oklch, var(--cz-action-muted-text) 16%, transparent)"),
      boxShadow: "var(--shadow-toast)",
      ...style
    }
  }, icon, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, children), action ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onAction,
    style: {
      border: 0,
      background: "transparent",
      color: "inherit",
      fontFamily: "inherit",
      fontSize: 13,
      fontWeight: 700,
      textDecoration: "underline",
      textUnderlineOffset: 3,
      cursor: "pointer"
    }
  }, action) : null);
}
Object.assign(__ds_scope, { Toast });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Toast.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Masthead.jsx
try { (() => {
// The app masthead and the site nav are the same object: lockup left,
// links centre-right, one pill CTA. Sticky with an 88%-opaque backdrop blur.
function Masthead({
  links = [],
  cta,
  onCta,
  kicker = "Fashion",
  sticky = true,
  trailing,
  className = "",
  style
}) {
  return /*#__PURE__*/React.createElement("header", {
    className: "cz-masthead" + (className ? " " + className : ""),
    style: {
      position: sticky ? "sticky" : "static",
      top: 0,
      zIndex: 20,
      background: "color-mix(in srgb, var(--cz-bg) 88%, transparent)",
      backdropFilter: "blur(12px)",
      WebkitBackdropFilter: "blur(12px)",
      borderBottom: "1px solid var(--cz-hair)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 14,
      maxWidth: 1120,
      margin: "0 auto",
      padding: "12px clamp(24px, 6.5vw, 48px)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.BrandLockup, {
    kicker: kicker
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), links.length ? /*#__PURE__*/React.createElement("nav", {
    "aria-label": "Page",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 22,
      fontFamily: "var(--cz-sans)",
      fontSize: 13.5
    }
  }, links.map(l => /*#__PURE__*/React.createElement("a", {
    key: l.label,
    href: l.href,
    style: {
      color: "var(--cz-sub)",
      textDecoration: "none"
    }
  }, l.label))) : null, trailing, cta ? /*#__PURE__*/React.createElement("a", {
    href: "#",
    onClick: e => {
      e.preventDefault();
      onCta && onCta();
    },
    style: {
      display: "inline-flex",
      alignItems: "center",
      minHeight: 38,
      padding: "0 17px",
      borderRadius: 999,
      background: "var(--cz-action-fill)",
      color: "var(--cz-action-text)",
      fontFamily: "var(--cz-sans)",
      fontSize: 13.5,
      fontWeight: 650,
      textDecoration: "none",
      flex: "0 0 auto"
    }
  }, cta) : null));
}
Object.assign(__ds_scope, { Masthead });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Masthead.jsx", error: String((e && e.message) || e) }); }

// components/navigation/ViewTabs.jsx
try { (() => {
// Underline tabs, never opaque pills. 13px, 18px gap, 2px active underline in
// ink, sitting on a 1px hairline that spans the row.
function ViewTabs({
  tabs,
  value,
  onChange,
  trailing,
  className = "",
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "cz-view-tabs-row" + (className ? " " + className : ""),
    style: {
      display: "flex",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: 12,
      borderBottom: "1px solid var(--cz-hair)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    role: "tablist",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 18,
      flex: 1,
      minWidth: 0
    }
  }, tabs.map(tab => {
    const active = tab.value === value;
    return /*#__PURE__*/React.createElement("button", {
      key: tab.value,
      type: "button",
      role: "tab",
      "aria-selected": active,
      onClick: () => onChange && onChange(tab.value),
      style: {
        fontFamily: "var(--cz-sans)",
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        color: active ? "var(--cz-ink)" : "var(--cz-sub)",
        background: "transparent",
        border: "none",
        borderBottom: "2px solid " + (active ? "var(--cz-accent)" : "transparent"),
        borderRadius: 0,
        padding: "9px 0 11px",
        marginBottom: -1,
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "color var(--dur-micro) var(--ease-out), border-color var(--dur-micro) var(--ease-out)"
      }
    }, tab.label, tab.count != null ? /*#__PURE__*/React.createElement("span", {
      style: {
        color: "var(--cz-faint)"
      }
    }, " · " + tab.count) : null);
  })), trailing ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      paddingBottom: 8,
      flexShrink: 0
    }
  }, trailing) : null);
}
Object.assign(__ds_scope, { ViewTabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/ViewTabs.jsx", error: String((e && e.message) || e) }); }

// components/shelf/HaulBar.jsx
try { (() => {
// Haul summary strip: name, item count, parcel estimate, running total.
// The total is the one big money number in the app.
function HaulBar({
  name,
  items,
  parcel,
  total,
  className = "",
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "cz-haul-bar" + (className ? " " + className : ""),
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      flexWrap: "wrap",
      padding: "14px 16px",
      border: "1px solid var(--cz-hair)",
      borderRadius: 14,
      background: "var(--cz-card-solid)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--cz-mono)",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: "var(--cz-faint)"
    }
  }, name), items ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--cz-sans)",
      fontSize: 13.5,
      color: "var(--cz-sub)"
    }
  }, items) : null, parcel ? /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    style: {
      width: 1,
      height: 15,
      background: "var(--cz-hair)"
    }
  }) : null, parcel ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--cz-sans)",
      fontSize: 13.5,
      color: "var(--cz-sub)"
    }
  }, parcel) : null, /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: "auto",
      fontFamily: "var(--cz-mono)",
      fontSize: 17,
      fontWeight: 700,
      color: "var(--cz-money)"
    }
  }, total));
}
Object.assign(__ds_scope, { HaulBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/shelf/HaulBar.jsx", error: String((e && e.message) || e) }); }

// components/shelf/PriceChip.jsx
try { (() => {
// Price. Three surfaces, one component.
//   overlay — high-contrast chip pinned bottom-right over a photo
//   meta    — inline mono green in a card meta row
//   hero    — big serif price on a card back
function PriceChip({
  children,
  variant = "overlay",
  className = "",
  style
}) {
  if (children == null || children === "") return null;
  if (variant === "hero") {
    return /*#__PURE__*/React.createElement("div", {
      className: "cz-carousel-price-hero" + (className ? " " + className : ""),
      style: {
        fontFamily: "var(--cz-display)",
        fontSize: 28,
        fontWeight: 600,
        letterSpacing: "-0.035em",
        color: "var(--cz-ink)",
        ...style
      }
    }, children);
  }
  if (variant === "meta") {
    return /*#__PURE__*/React.createElement("span", {
      className: "cz-price-meta" + (className ? " " + className : ""),
      style: {
        fontFamily: "var(--cz-mono)",
        fontSize: 13,
        fontWeight: 700,
        color: "var(--cz-money)",
        ...style
      }
    }, children);
  }
  return /*#__PURE__*/React.createElement("span", {
    className: "cz-price-chip" + (className ? " " + className : ""),
    style: {
      fontFamily: "var(--cz-mono)",
      fontSize: 12.5,
      fontWeight: 700,
      padding: "6px 11px",
      borderRadius: 999,
      background: "rgba(23, 24, 26, 0.82)",
      backdropFilter: "blur(10px)",
      WebkitBackdropFilter: "blur(10px)",
      color: "#fff",
      border: "1px solid rgba(255, 255, 255, 0.18)",
      boxShadow: "var(--shadow-chip)",
      whiteSpace: "nowrap",
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { PriceChip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/shelf/PriceChip.jsx", error: String((e && e.message) || e) }); }

// components/shelf/SizeChartTable.jsx
try { (() => {
// Seller size chart. Mono columns, the recommended row tinted with the
// accent tint and its size cell in money green.
function SizeChartTable({
  columns,
  rows,
  recommended,
  footnote,
  className = "",
  style
}) {
  const grid = "repeat(" + columns.length + ", minmax(0, 1fr))";
  return /*#__PURE__*/React.createElement("div", {
    className: "cz-size-chart" + (className ? " " + className : ""),
    role: "table",
    "aria-label": "Size chart",
    style: {
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    role: "row",
    style: {
      display: "grid",
      gridTemplateColumns: grid,
      gap: 6,
      padding: "7px 10px",
      fontFamily: "var(--cz-mono)",
      fontSize: 9.5,
      fontWeight: 700,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "var(--cz-faint)",
      borderBottom: "1px solid var(--cz-hair)"
    }
  }, columns.map(c => /*#__PURE__*/React.createElement("span", {
    key: c
  }, c))), rows.map(row => {
    const isRec = row[0] === recommended;
    return /*#__PURE__*/React.createElement("div", {
      key: row[0],
      role: "row",
      style: {
        display: "grid",
        gridTemplateColumns: grid,
        gap: 6,
        padding: "8px 10px",
        fontFamily: "var(--cz-mono)",
        fontSize: 12,
        fontWeight: isRec ? 700 : 500,
        color: isRec ? "var(--cz-ink)" : "var(--cz-sub)",
        background: isRec ? "var(--cz-accent-tint)" : "transparent",
        borderBottom: "1px solid var(--cz-hair)"
      }
    }, row.map((cell, i) => /*#__PURE__*/React.createElement("span", {
      key: i,
      style: i === 0 && isRec ? {
        color: "var(--cz-money)"
      } : undefined
    }, cell)));
  }), footnote ? /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "8px 10px 0",
      fontFamily: "var(--cz-sans)",
      fontSize: 11.5,
      color: "var(--cz-faint)"
    }
  }, footnote) : null);
}
Object.assign(__ds_scope, { SizeChartTable });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/shelf/SizeChartTable.jsx", error: String((e && e.message) || e) }); }

// components/shelf/SizeRecommendation.jsx
try { (() => {
// The size pick that shows its work: big serif size, a confidence line, one
// plain-English sentence of reasoning, then You / Garment / Ease.
function SizeRecommendation({
  size,
  confidence,
  prescription,
  you,
  garment,
  ease,
  children,
  className = "",
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "cz-size-rec" + (className ? " " + className : ""),
    style: {
      padding: 16,
      border: "1px solid var(--cz-ink)",
      borderRadius: 15,
      background: "var(--cz-card-solid)",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(__ds_scope.Kicker, {
    size: 9.5,
    tracking: "0.12em"
  }, "We recommend"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 2,
      fontFamily: "var(--cz-display)",
      fontSize: 28,
      fontWeight: 600,
      letterSpacing: "-0.035em",
      lineHeight: 1.1,
      color: "var(--cz-ink)"
    }
  }, size)), confidence ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      paddingTop: 5,
      fontFamily: "var(--cz-sans)",
      fontSize: 11.5,
      fontWeight: 650,
      color: "var(--cz-money)",
      textAlign: "right"
    }
  }, /*#__PURE__*/React.createElement("i", {
    "aria-hidden": "true",
    style: {
      width: 7,
      height: 7,
      borderRadius: 999,
      background: "var(--cz-money)",
      flex: "0 0 auto"
    }
  }), confidence) : null), prescription ? /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "9px 0 0",
      fontFamily: "var(--cz-sans)",
      fontSize: 14,
      lineHeight: 1.5,
      color: "var(--cz-sub)",
      textWrap: "pretty"
    }
  }, prescription) : null, you || garment || ease ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      gap: 7,
      marginTop: 13
    }
  }, [["You", you, false], ["Garment", garment, false], ["Ease", ease, true]].map(([lbl, val, money]) => val ? /*#__PURE__*/React.createElement("div", {
    key: lbl,
    style: {
      display: "grid",
      gap: 3,
      padding: "9px 10px",
      border: "1px solid var(--cz-hair)",
      borderRadius: 11,
      background: "var(--cz-inset-bg)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--cz-mono)",
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      color: "var(--cz-faint)"
    }
  }, lbl), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--cz-mono)",
      fontSize: 13.5,
      fontWeight: 700,
      color: money ? "var(--cz-money)" : "var(--cz-ink)"
    }
  }, val)) : null)) : null, children ? /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 13
    }
  }, children) : null);
}
Object.assign(__ds_scope, { SizeRecommendation });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/shelf/SizeRecommendation.jsx", error: String((e && e.message) || e) }); }

// components/shelf/StatusPill.jsx
try { (() => {
// Order-status flag pinned to the top-left of a card photo. Mono 10px/800,
// tracked, uppercase. "want" renders nothing — the default is not a fact
// worth space.
const TONE = {
  bought: {
    background: "var(--cz-status-bought-bg)",
    color: "var(--cz-status-bought-text)"
  },
  shipped: {
    background: "var(--cz-status-shipped-bg)",
    color: "var(--cz-status-shipped-text)"
  },
  qc: {
    background: "var(--cz-status-qc-bg)",
    color: "var(--cz-status-qc-text)"
  },
  received: {
    background: "var(--cz-money-bg)",
    color: "var(--cz-money)"
  },
  returned: {
    background: "var(--cz-error-bg)",
    color: "var(--cz-error-text)"
  }
};
function StatusPill({
  status,
  variant = "pill",
  dense = false,
  className = "",
  style
}) {
  if (!status || status === "want") return null;
  const tone = TONE[status] || {
    background: "var(--cz-chip-fill)",
    color: "var(--cz-ink)"
  };
  if (variant === "chip") {
    return /*#__PURE__*/React.createElement("span", {
      className: "cz-meta-chip" + (className ? " " + className : ""),
      style: {
        fontFamily: "var(--cz-mono)",
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: tone.color,
        ...style
      }
    }, status);
  }
  return /*#__PURE__*/React.createElement("span", {
    className: "cz-status-pill" + (className ? " " + className : ""),
    style: {
      fontFamily: "var(--cz-mono)",
      fontSize: dense ? 9 : 10,
      fontWeight: 800,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      padding: dense ? "4px 8px" : "5px 10px",
      borderRadius: 999,
      boxShadow: "var(--shadow-flag)",
      whiteSpace: "nowrap",
      ...tone,
      ...style
    }
  }, status);
}
Object.assign(__ds_scope, { StatusPill });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/shelf/StatusPill.jsx", error: String((e && e.message) || e) }); }

// components/shelf/ProductCard.jsx
try { (() => {
// The editorial grid card. At rest: photo hero (4:5), status flag top-left,
// quiet outline heart top-right, album count bottom-right, serif title, size
// reading and green price. No Buy at rest — it fades in over the photo on
// hover, fine pointers only. Radius 16, one hairline, a 6/16 shadow.
function ProductCard({
  title,
  price,
  image,
  alt = "",
  status,
  favorite = false,
  onToggleFavorite,
  albumCount,
  sizeLabel,
  sizeKind,
  sizeLive = false,
  seller,
  buyAgent,
  onBuy,
  onOpen,
  selected = false,
  className = "",
  style
}) {
  const [hover, setHover] = React.useState(false);
  return /*#__PURE__*/React.createElement("article", {
    className: "cz-editorial-card" + (className ? " " + className : ""),
    onPointerEnter: () => setHover(true),
    onPointerLeave: () => setHover(false),
    style: {
      position: "relative",
      display: "grid",
      background: "var(--cz-card-solid)",
      borderRadius: 16,
      border: "1px solid " + (selected ? "var(--cz-accent)" : "var(--cz-hair)"),
      boxShadow: selected ? "0 0 0 3px var(--cz-accent-bg), 0 14px 32px rgba(23, 24, 26, 0.12)" : hover ? "var(--shadow-card-hover)" : "var(--shadow-card)",
      overflow: "hidden",
      transform: hover ? "translateY(-2px)" : "none",
      transition: "border-color .2s, box-shadow .2s, transform .2s",
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": "Open " + (title || "saved item"),
    onClick: onOpen,
    style: {
      display: "block",
      width: "100%",
      padding: 0,
      margin: 0,
      background: "transparent",
      border: 0,
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      aspectRatio: "4 / 5",
      background: "var(--cz-chip-fill)",
      overflow: "hidden"
    }
  }, image ? /*#__PURE__*/React.createElement("img", {
    src: image,
    alt: alt,
    loading: "lazy",
    decoding: "async",
    style: {
      display: "block",
      width: "100%",
      height: "100%",
      objectFit: "cover",
      outline: "1px solid oklch(0 0 0 / 0.08)",
      outlineOffset: -1
    }
  }) : null)), status ? /*#__PURE__*/React.createElement(__ds_scope.StatusPill, {
    status: status,
    dense: true,
    className: "cz-card-status",
    style: {
      position: "absolute",
      top: 8,
      left: 8,
      zIndex: 2
    }
  }) : null, /*#__PURE__*/React.createElement("button", {
    type: "button",
    "aria-label": favorite ? "Remove from favourites" : "Add to favourites",
    "aria-pressed": favorite,
    onClick: onToggleFavorite,
    style: {
      position: "absolute",
      top: 8,
      right: 8,
      zIndex: 2,
      display: "grid",
      placeItems: "center",
      width: 30,
      height: 30,
      border: 0,
      borderRadius: 999,
      background: "rgba(255, 255, 255, 0.88)",
      color: favorite ? "var(--cz-like)" : "rgba(23, 24, 26, 0.5)",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    fill: favorite ? "currentColor" : "none",
    stroke: "currentColor",
    strokeWidth: "2",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 20s-7-4.6-7-9.4A3.9 3.9 0 0 1 12 7a3.9 3.9 0 0 1 7 3.6C19 15.4 12 20 12 20z"
  }))), albumCount ? /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      bottom: 8,
      right: 8,
      zIndex: 2,
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
      padding: "4px 9px",
      borderRadius: 999,
      background: "rgba(12, 12, 14, 0.62)",
      backdropFilter: "blur(6px)",
      fontFamily: "var(--cz-mono)",
      fontSize: 9.5,
      color: "var(--cz-link-on-photo)"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "9",
    height: "9",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.4",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "4",
    width: "14",
    height: "14",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M21 7v11a2 2 0 0 1-2 2H8"
  })), albumCount) : null, onBuy ? /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      left: 12,
      right: 12,
      bottom: 12,
      zIndex: 3,
      opacity: hover ? 1 : 0,
      transform: hover ? "translateY(0)" : "translateY(6px)",
      pointerEvents: hover ? "auto" : "none",
      transition: "opacity 200ms var(--ease-out), transform 200ms var(--ease-out)"
    }
  }, /*#__PURE__*/React.createElement(__ds_scope.BuyButton, {
    agent: buyAgent,
    onClick: onBuy
  })) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 4,
      padding: "12px 13px 13px",
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--cz-display)",
      fontSize: 16,
      fontWeight: 600,
      lineHeight: 1.25,
      letterSpacing: "-0.03em",
      color: "var(--cz-ink)",
      display: "-webkit-box",
      WebkitBoxOrient: "vertical",
      WebkitLineClamp: 2,
      overflow: "hidden",
      minHeight: "2.5em"
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "baseline",
      gap: 6,
      minWidth: 0
    }
  }, sizeKind ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--cz-mono)",
      fontSize: 8.5,
      fontWeight: 700,
      letterSpacing: "0.1em",
      whiteSpace: "nowrap",
      flex: "0 0 auto",
      color: sizeLive ? "var(--cz-money)" : "var(--cz-faint)"
    }
  }, sizeKind) : null, sizeLabel ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--cz-mono)",
      fontSize: 11.5,
      fontWeight: sizeLive ? 700 : 650,
      color: sizeLive ? "var(--cz-money)" : "var(--cz-ink)"
    }
  }, sizeLabel) : null, price ? /*#__PURE__*/React.createElement("span", {
    style: {
      marginLeft: "auto",
      fontFamily: "var(--cz-mono)",
      fontSize: 13,
      fontWeight: 700,
      color: "var(--cz-money)"
    }
  }, price) : null), seller ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--cz-sans)",
      fontSize: 11,
      color: "var(--cz-faint)",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, seller) : null));
}
Object.assign(__ds_scope, { ProductCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/shelf/ProductCard.jsx", error: String((e && e.message) || e) }); }

// components/shelf/StatusTrack.jsx
try { (() => {
// Four-stop order track. Filled rails behind the current stop, a single
// primary pill for the next transition. Off-track states (refund, QC failed)
// hang UNDER their own dot — they are not progress, so they never become a
// fifth column.
const STOPS = ["Want", "Bought", "Shipped", "Received"];
function StatusTrack({
  stops = STOPS,
  current = 0,
  onChange,
  nextLabel,
  onNext,
  detour,
  className = "",
  style
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "cz-status-row" + (className ? " " + className : ""),
    style: {
      display: "grid",
      gap: 12,
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    role: "radiogroup",
    "aria-label": "Order status",
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(" + stops.length + ", minmax(0, 1fr))"
    }
  }, stops.map((name, i) => {
    const done = i < current;
    const active = i === current;
    const on = "var(--cz-ink)";
    const off = "var(--cz-hair)";
    return /*#__PURE__*/React.createElement("button", {
      key: name,
      type: "button",
      role: "radio",
      "aria-checked": active,
      onClick: () => onChange && onChange(i),
      style: {
        position: "relative",
        display: "grid",
        justifyItems: "center",
        gap: 7,
        padding: "6px 0",
        minHeight: 44,
        border: 0,
        background: "transparent",
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        position: "relative",
        display: "grid",
        placeItems: "center",
        width: "100%",
        height: 14
      }
    }, /*#__PURE__*/React.createElement("span", {
      "aria-hidden": "true",
      style: {
        position: "absolute",
        left: 0,
        right: "50%",
        top: 6,
        height: 2,
        background: i === 0 ? "transparent" : i <= current ? on : off
      }
    }), /*#__PURE__*/React.createElement("span", {
      "aria-hidden": "true",
      style: {
        position: "absolute",
        left: "50%",
        right: 0,
        top: 6,
        height: 2,
        background: i === stops.length - 1 ? "transparent" : i < current ? on : off
      }
    }), /*#__PURE__*/React.createElement("span", {
      "aria-hidden": "true",
      style: {
        position: "relative",
        display: "grid",
        placeItems: "center",
        width: active ? 14 : 12,
        height: active ? 14 : 12,
        borderRadius: 999,
        background: done || active ? on : "var(--cz-card-solid)",
        border: done || active ? "0" : "2px solid " + off,
        boxShadow: active ? "0 0 0 4px var(--cz-accent-bg)" : "none"
      }
    }, done ? /*#__PURE__*/React.createElement("svg", {
      width: "7",
      height: "7",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "var(--cz-action-text)",
      strokeWidth: "4",
      strokeLinecap: "round",
      strokeLinejoin: "round"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M4 12.5l5 5L20 6.5"
    })) : null)), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--cz-sans)",
        fontSize: 11,
        fontWeight: active ? 700 : 600,
        color: active ? "var(--cz-ink)" : done ? "var(--cz-sub)" : "var(--cz-faint)"
      }
    }, name), active && detour ? /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--cz-mono)",
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--cz-warn-ink)"
      }
    }, detour) : null);
  })), nextLabel ? /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onNext,
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      minHeight: 40,
      padding: "0 16px",
      border: 0,
      borderRadius: 999,
      background: "var(--cz-action-fill)",
      color: "var(--cz-action-text)",
      fontFamily: "var(--cz-sans)",
      fontSize: 13,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, nextLabel, /*#__PURE__*/React.createElement("svg", {
    width: "13",
    height: "13",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.4",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M9 6l6 6-6 6"
  }))) : null);
}
Object.assign(__ds_scope, { StatusTrack });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/shelf/StatusTrack.jsx", error: String((e && e.message) || e) }); }

// ui_kits/fashion_app/AppShell.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// Shared shelf chrome: masthead row, search + tabs, totals.
const {
  BrandLockup,
  ViewTabs,
  SearchField,
  IconButton,
  Button
} = window.CredenzaFashionDesignSystem_8f0205;
function Search(props) {
  return /*#__PURE__*/React.createElement(SearchField, _extends({}, props, {
    leading: /*#__PURE__*/React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      "aria-hidden": "true"
    }, /*#__PURE__*/React.createElement("circle", {
      cx: "11",
      cy: "11",
      r: "7"
    }), /*#__PURE__*/React.createElement("path", {
      d: "m20 20-3.5-3.5"
    }))
  }));
}
function AppShell({
  view,
  onView,
  query,
  onQuery,
  theme,
  onTheme,
  total,
  count,
  children,
  onStash
}) {
  return /*#__PURE__*/React.createElement("div", {
    "data-theme": theme === "dark" ? "dark" : undefined,
    style: {
      minHeight: "100%",
      background: "var(--cz-bg)",
      color: "var(--cz-ink)",
      fontFamily: "var(--cz-sans)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 1080,
      margin: "0 auto",
      padding: "18px 28px 100px"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      marginBottom: 18
    }
  }, /*#__PURE__*/React.createElement(BrandLockup, null), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement(IconButton, {
    label: "Switch colourway",
    onClick: onTheme
  }, theme === "dark" ? /*#__PURE__*/React.createElement("svg", {
    width: "17",
    height: "17",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"
  })) : /*#__PURE__*/React.createElement("svg", {
    width: "17",
    height: "17",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"
  }))), /*#__PURE__*/React.createElement(IconButton, {
    label: "Profile"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "17",
    height: "17",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "8",
    r: "3.4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M4.5 20a7.5 7.5 0 0 1 15 0"
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(Search, {
    value: query,
    onChange: onQuery,
    onClear: () => onQuery(""),
    placeholder: "Paste a Weidian, Taobao, Yupoo or 1688 link \u2014 or search your shelf"
  }), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    onClick: onStash
  }, "Stash")), /*#__PURE__*/React.createElement(ViewTabs, {
    value: view,
    onChange: onView,
    tabs: [{
      value: "shelf",
      label: "Shelf",
      count
    }, {
      value: "hauls",
      label: "Hauls",
      count: 2
    }, {
      value: "inbox",
      label: "Inbox",
      count: 1
    }],
    trailing: /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--cz-mono)",
        fontSize: 12.5,
        fontWeight: 700,
        color: "var(--cz-money)"
      }
    }, total),
    style: {
      marginBottom: 18
    }
  }), children));
}
Object.assign(window, {
  AppShell,
  Search
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/fashion_app/AppShell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/fashion_app/DetailScreen.jsx
try { (() => {
const {
  StatusPill,
  PriceChip,
  StatusTrack,
  SizeRecommendation,
  SizeChartTable,
  BuyButton,
  Chip,
  Kicker,
  Caption,
  IconButton
} = window.CredenzaFashionDesignSystem_8f0205;
const NEXT = ["Mark bought", "Mark shipped", "Mark received", null];

// Card back / detail. Photo strip left, facts + size + status + Buy right.
function DetailScreen({
  item,
  agent,
  onAgent,
  onClose,
  stop,
  onStop
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      border: "1px solid var(--cz-hair)",
      borderRadius: 20,
      background: "var(--cz-card-solid)",
      boxShadow: "var(--shadow-card)",
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "minmax(0, 340px) minmax(0, 1fr)",
      gap: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      background: "var(--cz-strip-bg)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      aspectRatio: "4/5",
      overflow: "hidden"
    }
  }, item.image ? /*#__PURE__*/React.createElement("img", {
    src: item.image,
    alt: item.alt,
    style: {
      display: "block",
      width: "100%",
      height: "100%",
      objectFit: "cover"
    }
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      placeItems: "center",
      height: "100%",
      background: "var(--cz-tile-taobao)",
      color: "#fff",
      fontFamily: "var(--cz-display)",
      fontSize: 24,
      fontWeight: 600,
      letterSpacing: "0.04em"
    }
  }, "1688")), /*#__PURE__*/React.createElement(StatusPill, {
    status: item.status,
    style: {
      position: "absolute",
      top: 14,
      left: 14
    }
  }), /*#__PURE__*/React.createElement(PriceChip, {
    style: {
      position: "absolute",
      bottom: 14,
      right: 14
    }
  }, item.price), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      padding: 10,
      background: "var(--cz-strip-bg)"
    }
  }, [0, 1, 2, 3].map(i => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      flex: 1,
      aspectRatio: "1/1",
      borderRadius: 8,
      background: "var(--cz-chip-fill)",
      border: "1px solid var(--cz-hair)",
      overflow: "hidden"
    }
  }, item.image ? /*#__PURE__*/React.createElement("img", {
    src: item.image,
    alt: "",
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      opacity: i === 0 ? 1 : 0.55
    }
  }) : null)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 16,
      padding: "18px 20px 20px",
      alignContent: "start"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "flex-start",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement(Kicker, {
    size: 9.5
  }, item.seller), /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: "4px 0 0",
      fontFamily: "var(--cz-display)",
      fontSize: 26,
      fontWeight: 600,
      lineHeight: 1.15,
      letterSpacing: "-0.035em",
      color: "var(--cz-ink)"
    }
  }, item.title)), /*#__PURE__*/React.createElement(IconButton, {
    label: "Close",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("svg", {
    width: "17",
    height: "17",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M18 6 6 18M6 6l12 12"
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(3, minmax(0,1fr))",
      gap: 7
    }
  }, [["Price", item.price + " · " + item.cny], ["Ship weight", item.weight], ["Photos", (item.albumCount || 0) + " from the listing"]].map(([l, v]) => /*#__PURE__*/React.createElement("div", {
    key: l,
    style: {
      display: "grid",
      gap: 3,
      padding: "9px 10px",
      border: "1px solid var(--cz-hair)",
      borderRadius: 11,
      background: "var(--cz-inset-bg)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--cz-mono)",
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      color: "var(--cz-faint)"
    }
  }, l), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--cz-mono)",
      fontSize: 12.5,
      fontWeight: 700,
      color: "var(--cz-ink)"
    }
  }, v)))), /*#__PURE__*/React.createElement(StatusTrack, {
    current: stop,
    onChange: onStop,
    nextLabel: NEXT[stop],
    onNext: () => onStop(Math.min(stop + 1, 3))
  }), /*#__PURE__*/React.createElement(SizeRecommendation, {
    size: item.sizeLive ? "Large" : "Your usual, L",
    confidence: item.sizeLive ? "Read from the seller's chart" : undefined,
    prescription: item.sizeLive ? "Take the Large. Its 104cm chest gives you 6cm of room over your 98cm, which is where this jersey is meant to sit. The Medium's 100cm would pull across the chest." : "This listing has no size chart, so there is nothing to measure against. Falling back to the size you usually take.",
    you: item.sizeLive ? "98cm" : undefined,
    garment: item.sizeLive ? "104cm" : undefined,
    ease: item.sizeLive ? "+6cm" : undefined
  }, item.sizeLive ? /*#__PURE__*/React.createElement(SizeChartTable, {
    columns: ["Size", "Chest", "Length", "Shldr"],
    rows: [["S", "96", "68", "44"], ["M", "100", "70", "46"], ["L", "104", "72", "48"], ["XL", "108", "74", "50"]],
    recommended: "L",
    footnote: "Chart read from 4 album photos \xB7 Jul 24"
  }) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 9
    }
  }, /*#__PURE__*/React.createElement(Kicker, {
    size: 9.5
  }, "Open with"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 6
    }
  }, window.AGENTS.map(a => /*#__PURE__*/React.createElement(Chip, {
    key: a,
    active: a === agent,
    onClick: () => onAgent(a),
    style: {
      flex: "0 0 auto"
    }
  }, a))), /*#__PURE__*/React.createElement(BuyButton, {
    agent: agent
  }), /*#__PURE__*/React.createElement(Caption, null, "Some agent links carry a referral code that funds the app. It never changes your price.")))));
}
Object.assign(window, {
  DetailScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/fashion_app/DetailScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/fashion_app/EmptyShelfScreen.jsx
try { (() => {
const {
  SearchField,
  Button,
  Caption
} = window.CredenzaFashionDesignSystem_8f0205;

// First run: the shelf is empty, so the whole page becomes the paste field
// over a faded ghost grid. One sentence, one field, one button.
function EmptyShelfScreen({
  value,
  onChange,
  onStash
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center",
      padding: "28px 12px 56px",
      overflow: "hidden",
      isolation: "isolate"
    }
  }, /*#__PURE__*/React.createElement("div", {
    "aria-hidden": "true",
    style: {
      position: "absolute",
      inset: 0,
      zIndex: 0,
      display: "grid",
      gridTemplateColumns: "repeat(4, minmax(0,1fr))",
      gap: 10,
      opacity: 0.16,
      pointerEvents: "none",
      padding: "0 8px"
    }
  }, [0, 1, 2, 3, 4, 5, 6, 7].map(i => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      borderRadius: 16,
      border: "1px solid var(--cz-hair)",
      background: "var(--cz-card-solid)",
      aspectRatio: "4/5"
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      zIndex: 1,
      width: "100%",
      maxWidth: 640,
      display: "flex",
      flexDirection: "column",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: "0 auto 16px",
      maxWidth: "16ch",
      fontFamily: "var(--cz-display)",
      fontSize: 44,
      fontWeight: 600,
      lineHeight: 1.06,
      letterSpacing: "-0.038em",
      color: "var(--cz-ink)",
      textWrap: "balance"
    }
  }, "One shelf for the whole haul."), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 auto 26px",
      maxWidth: "44ch",
      fontFamily: "var(--cz-sans)",
      fontSize: 15.5,
      lineHeight: 1.6,
      color: "var(--cz-sub)",
      textWrap: "balance"
    }
  }, "Paste a Weidian, Taobao, Yupoo or 1688 link. It comes back as a card with the photos, the price and a size pick."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      width: "100%",
      maxWidth: 560,
      margin: "0 auto 16px"
    }
  }, /*#__PURE__*/React.createElement(SearchField, {
    variant: "hero",
    value: value,
    onChange: onChange,
    placeholder: "weidian.com/item.html?itemID=\u2026",
    leading: /*#__PURE__*/React.createElement("svg", {
      width: "17",
      height: "17",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      "aria-hidden": "true"
    }, /*#__PURE__*/React.createElement("path", {
      d: "M9 15l6-6"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M11 6l1-1a4.2 4.2 0 0 1 6 6l-1 1"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M13 18l-1 1a4.2 4.2 0 0 1-6-6l1-1"
    }))
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onStash,
    style: {
      flex: "0 0 auto",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      height: 52,
      padding: "0 24px",
      border: 0,
      borderRadius: 14,
      background: "var(--cz-action-fill)",
      color: "var(--cz-action-text)",
      fontFamily: "var(--cz-sans)",
      fontSize: 15,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 20,
      fontWeight: 500,
      lineHeight: 1
    }
  }, "+"), "Stash")), /*#__PURE__*/React.createElement(Caption, null, "No account. Nothing to install. Your shelf stays on this device.")));
}
Object.assign(window, {
  EmptyShelfScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/fashion_app/EmptyShelfScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/fashion_app/HaulsScreen.jsx
try { (() => {
const {
  HaulBar,
  Kicker,
  Button,
  Caption
} = window.CredenzaFashionDesignSystem_8f0205;
function HaulsScreen({
  hauls,
  items,
  onOpenShelf
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 20
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 12
    }
  }, hauls.map(h => /*#__PURE__*/React.createElement("div", {
    key: h.id,
    style: {
      display: "grid",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(HaulBar, {
    name: h.name,
    items: h.items + " items",
    parcel: h.parcel,
    total: h.total
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(6, minmax(0,1fr))",
      gap: 10
    }
  }, items.slice(0, 6).map(it => /*#__PURE__*/React.createElement("button", {
    key: h.id + it.id,
    type: "button",
    onClick: onOpenShelf,
    style: {
      padding: 0,
      border: "1px solid var(--cz-hair)",
      borderRadius: 14,
      background: "var(--cz-card-solid)",
      overflow: "hidden",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      aspectRatio: "1/1",
      background: "var(--cz-chip-fill)"
    }
  }, it.image ? /*#__PURE__*/React.createElement("img", {
    src: it.image,
    alt: "",
    style: {
      display: "block",
      width: "100%",
      height: "100%",
      objectFit: "cover"
    }
  }) : null), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "block",
      padding: "7px 9px 9px",
      fontFamily: "var(--cz-mono)",
      fontSize: 11,
      fontWeight: 700,
      color: "var(--cz-money)",
      textAlign: "left"
    }
  }, it.price))))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 10,
      justifyItems: "start",
      padding: "28px 20px",
      border: "1px solid var(--cz-hair)",
      borderRadius: 20,
      background: "var(--cz-card-solid)"
    }
  }, /*#__PURE__*/React.createElement(Kicker, null, "Free plan"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "var(--cz-display)",
      fontSize: 20,
      fontWeight: 600,
      letterSpacing: "-0.035em",
      color: "var(--cz-ink)"
    }
  }, "Two hauls open at once."), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      maxWidth: "42ch",
      fontFamily: "var(--cz-sans)",
      fontSize: 13,
      lineHeight: 1.55,
      color: "var(--cz-sub)"
    }
  }, "Close a haul when the parcel ships and the slot comes back. Pro raises it to 100 \u2014 nothing you already saved is ever deleted."), /*#__PURE__*/React.createElement(Button, null, "See what Pro changes")), /*#__PURE__*/React.createElement(Caption, null, "Parcel weights are planning estimates. Carriers bill the larger of actual and volumetric."));
}
Object.assign(window, {
  HaulsScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/fashion_app/HaulsScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/fashion_app/ShelfScreen.jsx
try { (() => {
const {
  ProductCard,
  HaulBar,
  Caption
} = window.CredenzaFashionDesignSystem_8f0205;
function ShelfScreen({
  items,
  onOpen,
  onToggleFavorite,
  agent
}) {
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
      gap: 10,
      alignItems: "stretch"
    }
  }, items.map(it => /*#__PURE__*/React.createElement(ProductCard, {
    key: it.id,
    title: it.title,
    image: it.image,
    alt: it.alt,
    price: it.price,
    sizeKind: it.sizeKind,
    sizeLabel: it.sizeLabel,
    sizeLive: it.sizeLive,
    status: it.status,
    favorite: it.favorite,
    albumCount: it.albumCount,
    seller: it.seller,
    buyAgent: agent,
    onBuy: () => onOpen(it.id),
    onOpen: () => onOpen(it.id),
    onToggleFavorite: () => onToggleFavorite(it.id)
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(HaulBar, {
    name: "July haul",
    items: "8 items",
    parcel: "est. parcel 3.4 kg",
    total: "$548.08"
  })), /*#__PURE__*/React.createElement(Caption, {
    style: {
      marginTop: 14
    }
  }, "Weight is a planning estimate, not a quote. Your agent bills the larger of actual and volumetric."));
}
Object.assign(window, {
  ShelfScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/fashion_app/ShelfScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/fashion_app/data.js
try { (() => {
// Fixture shelf. Photos are the real product images shipped in the repo.
const ITEMS = [{
  id: "a",
  title: "Kit jersey · black",
  image: "../../assets/img/kit-jersey-black.jpg",
  alt: "Kit jersey in black",
  price: "$23.52",
  sizeKind: "AI SIZE",
  sizeLabel: "L",
  sizeLive: true,
  status: "shipped",
  favorite: true,
  albumCount: 8,
  seller: "Mook-official",
  weight: "~380 g",
  cny: "¥168",
  stop: 2
}, {
  id: "b",
  title: "Kit shorts · black",
  image: "../../assets/img/kit-shorts-black.jpg",
  alt: "Kit shorts in black",
  price: "$27.72",
  sizeKind: "AI SIZE",
  sizeLabel: "L",
  sizeLive: true,
  status: "bought",
  favorite: false,
  albumCount: 6,
  seller: "Mook-official",
  weight: "~240 g",
  cny: "¥198",
  stop: 1
}, {
  id: "c",
  title: "Floral soccer jersey",
  image: "../../assets/img/floral-soccer-jersey.jpg",
  alt: "Floral soccer jersey",
  price: "$38.92",
  sizeKind: "YOUR USUAL",
  sizeLabel: "L",
  sizeLive: false,
  status: "want",
  favorite: true,
  albumCount: 12,
  seller: "Yupoo · linfinity",
  weight: "~360 g",
  cny: "¥278",
  stop: 0
}, {
  id: "d",
  title: "Dry-fit training top",
  image: "../../assets/img/dry-fit-training-top.jpg",
  alt: "Dry-fit training top",
  price: "$32.06",
  sizeKind: "SIZE",
  sizeLabel: "XL",
  sizeLive: false,
  status: "qc",
  favorite: false,
  albumCount: 9,
  seller: "Taobao · 运动仓",
  weight: "~310 g",
  cny: "¥229",
  stop: 1
}, {
  id: "e",
  title: "Heavyweight hoodie · bone",
  image: "../../assets/img/specimen-jersey.jpg",
  alt: "Heavyweight hoodie",
  price: "$46.10",
  sizeKind: "AI SIZE",
  sizeLabel: "XL",
  sizeLive: true,
  status: "want",
  favorite: false,
  albumCount: 5,
  seller: "Weidian · 3050",
  weight: "~720 g",
  cny: "¥329",
  stop: 0
}, {
  id: "f",
  title: "Cargo trousers · sand",
  image: "",
  alt: "",
  price: "$34.80",
  sizeKind: "YOUR USUAL",
  sizeLabel: "32",
  sizeLive: false,
  status: "want",
  favorite: false,
  albumCount: 0,
  seller: "1688 · Nanshan",
  weight: "~540 g",
  cny: "¥249",
  stop: 0
}];
const HAULS = [{
  id: "jul",
  name: "July haul",
  items: 8,
  parcel: "est. parcel 3.4 kg",
  total: "$548.08",
  open: true
}, {
  id: "aug",
  name: "August restock",
  items: 3,
  parcel: "est. parcel 1.1 kg",
  total: "$96.40",
  open: true
}];
const AGENTS = ["Superbuy", "CNFans", "Mulebuy", "Kakobuy", "Hoobuy", "Oopbuy"];
Object.assign(window, {
  ITEMS,
  HAULS,
  AGENTS
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/fashion_app/data.js", error: String((e && e.message) || e) }); }

// ui_kits/marketing_site/Blocks.jsx
try { (() => {
const {
  Kicker,
  StatusTrack,
  Chip,
  BuyButton,
  BrandLockup
} = window.CredenzaFashionDesignSystem_8f0205;
const BOX = {
  marginTop: 18,
  padding: 16,
  border: "1px solid var(--cz-hair)",
  borderRadius: 15,
  background: "var(--cz-card-solid)"
};
function StatusAndBuy() {
  const {
    WRAP,
    SECTION,
    SERIF_H,
    LEDE
  } = window;
  const [stop, setStop] = React.useState(2);
  const [agent, setAgent] = React.useState("Superbuy");
  return /*#__PURE__*/React.createElement("section", {
    style: {
      borderTop: "1px solid var(--cz-hair)",
      background: "var(--cz-footer-bg)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...WRAP,
      ...SECTION,
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 330px), 1fr))",
      gap: "clamp(28px, 4vw, 56px)",
      alignItems: "start"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Kicker, null, "QC & status"), /*#__PURE__*/React.createElement("h2", {
    style: {
      ...SERIF_H,
      fontSize: "clamp(24px, 3vw, 32px)"
    }
  }, "Know where every parcel is."), /*#__PURE__*/React.createElement("p", {
    style: {
      ...LEDE,
      fontSize: 15.5
    }
  }, "Attach the warehouse photos, mark GL or RL, and move the item along the track. The shelf shows what's still a maybe and what's already in the air."), /*#__PURE__*/React.createElement("div", {
    style: BOX
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(Kicker, {
    size: 9.5
  }, "Status"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--cz-mono)",
      fontSize: 10.5,
      color: "var(--cz-faint)"
    }
  }, "In transit \xB7 agent \u2192 you")), /*#__PURE__*/React.createElement(StatusTrack, {
    current: stop,
    onChange: setStop,
    nextLabel: stop < 3 ? "Mark received" : null,
    onNext: () => setStop(3)
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      minHeight: 30,
      padding: "0 12px",
      borderRadius: 999,
      background: "var(--cz-money-bg)",
      color: "var(--cz-money)",
      fontSize: 11.5,
      fontWeight: 700
    }
  }, "GL \xB7 green light"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-flex",
      alignItems: "center",
      minHeight: 30,
      padding: "0 12px",
      borderRadius: 999,
      border: "1px solid var(--cz-hair)",
      color: "var(--cz-faint)",
      fontSize: 11.5,
      fontWeight: 700
    }
  }, "RL")))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Kicker, null, "Buy"), /*#__PURE__*/React.createElement("h2", {
    style: {
      ...SERIF_H,
      fontSize: "clamp(24px, 3vw, 32px)"
    }
  }, "Your agent, one tap."), /*#__PURE__*/React.createElement("p", {
    style: {
      ...LEDE,
      fontSize: 15.5
    }
  }, "Pick your agent once and every Buy button opens the right item there. Credenza never takes your money and never checks out for you."), /*#__PURE__*/React.createElement("div", {
    style: BOX
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 6
    }
  }, ["Superbuy", "CNFans", "Mulebuy", "Kakobuy", "Hoobuy", "Oopbuy"].map(a => /*#__PURE__*/React.createElement(Chip, {
    key: a,
    active: a === agent,
    onClick: () => setAgent(a),
    style: {
      flex: "0 0 auto"
    }
  }, a))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--cz-mono)",
      fontSize: 17,
      fontWeight: 700,
      color: "var(--cz-money)"
    }
  }, "$23.52"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement(BuyButton, {
    agent: agent
  }))), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "12px 0 0",
      fontSize: 11.5,
      lineHeight: 1.5,
      color: "var(--cz-faint)"
    }
  }, "Some agent links carry a referral code that funds the app. It never changes your price.")))));
}
function CardGrid({
  id,
  kicker,
  heading,
  lede,
  cards
}) {
  const {
    WRAP,
    SECTION,
    SERIF_H,
    LEDE
  } = window;
  return /*#__PURE__*/React.createElement("section", {
    id: id,
    style: {
      borderTop: "1px solid var(--cz-hair)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...WRAP,
      ...SECTION
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: "44rem"
    }
  }, /*#__PURE__*/React.createElement(Kicker, null, kicker), /*#__PURE__*/React.createElement("h2", {
    style: SERIF_H
  }, heading), lede ? /*#__PURE__*/React.createElement("p", {
    style: {
      ...LEDE,
      fontSize: 15.5
    }
  }, lede) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
      gap: 14,
      marginTop: 30
    }
  }, cards.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.h,
    style: {
      padding: "18px 18px 20px",
      border: "1px solid var(--cz-hair)",
      borderRadius: 16,
      background: "var(--cz-card-solid)"
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      fontFamily: "var(--cz-display)",
      fontSize: 19,
      fontWeight: 600,
      letterSpacing: "-0.035em"
    }
  }, c.h), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "9px 0 0",
      fontSize: 14,
      lineHeight: 1.55,
      color: "var(--cz-sub)",
      textWrap: "pretty"
    }
  }, c.p))))));
}
function CtaBand() {
  const {
    WRAP
  } = window;
  return /*#__PURE__*/React.createElement("section", {
    id: "open",
    style: {
      background: "var(--cz-brand-ground)",
      color: "#f4f4f0"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...WRAP,
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 26,
      padding: "clamp(40px, 5vw, 60px) clamp(24px, 6.5vw, 48px)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 280
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: 0,
      fontFamily: "var(--cz-display)",
      fontSize: "clamp(26px, 3.2vw, 36px)",
      fontWeight: 600,
      letterSpacing: "-0.038em"
    }
  }, "Paste your first link."), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "12px 0 0",
      maxWidth: "42em",
      fontSize: 15,
      lineHeight: 1.6,
      color: "rgba(244,244,240,.72)"
    }
  }, "Free to start. No account, no card, nothing to install. Your shelf lives on this device until you export it. Pro is $4.99 a month if you outgrow the free caps.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 10,
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#open",
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: 54,
      padding: "0 26px",
      borderRadius: 16,
      background: "#f4f4f0",
      color: "#17181a",
      fontSize: 15.5,
      fontWeight: 700,
      textDecoration: "none"
    }
  }, "Open Credenza"), /*#__PURE__*/React.createElement("a", {
    href: "#how",
    style: {
      fontSize: 13.5,
      color: "rgba(244,244,240,.66)"
    }
  }, "Read how it works first"))));
}
function SiteFooter() {
  const {
    WRAP
  } = window;
  const links = ["How", "Guides", "Pricing", "FAQ", "Support", "Contact", "Privacy", "Terms", "llms.txt"];
  return /*#__PURE__*/React.createElement("footer", {
    style: {
      borderTop: "1px solid var(--cz-hair)",
      background: "var(--cz-footer-bg)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...WRAP,
      display: "flex",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 16,
      paddingTop: 22,
      paddingBottom: 22,
      fontSize: 12.5,
      color: "var(--cz-faint)"
    }
  }, /*#__PURE__*/React.createElement(BrandLockup, {
    size: 24
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("nav", {
    "aria-label": "Site",
    style: {
      display: "flex",
      flexWrap: "wrap",
      gap: 16
    }
  }, links.map(l => /*#__PURE__*/React.createElement("a", {
    key: l,
    href: "#open",
    style: {
      color: "var(--cz-sub)",
      textDecoration: "none"
    }
  }, l)))));
}
Object.assign(window, {
  StatusAndBuy,
  CardGrid,
  CtaBand,
  SiteFooter
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketing_site/Blocks.jsx", error: String((e && e.message) || e) }); }

// ui_kits/marketing_site/Nav.jsx
try { (() => {
const {
  BrandLockup,
  Kicker,
  ProductCard,
  HaulBar,
  SizeRecommendation,
  SizeChartTable,
  StatusTrack,
  Chip,
  BuyButton,
  Caption
} = window.CredenzaFashionDesignSystem_8f0205;
const WRAP = {
  maxWidth: 1120,
  margin: "0 auto",
  padding: "0 clamp(24px, 6.5vw, 48px)"
};
const SECTION = {
  padding: "clamp(48px, 6.5vw, 80px) 0"
};
const SERIF_H = {
  margin: "12px 0 0",
  fontFamily: "var(--cz-display)",
  fontSize: "clamp(26px, 3.4vw, 38px)",
  fontWeight: 600,
  lineHeight: 1.14,
  letterSpacing: "-0.035em",
  textWrap: "balance"
};
const LEDE = {
  margin: "14px 0 0",
  fontSize: 16,
  lineHeight: 1.6,
  color: "var(--cz-sub)",
  textWrap: "pretty",
  maxWidth: "44rem"
};
function Check() {
  return /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--cz-money)",
    strokeWidth: "3",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    style: {
      flex: "0 0 auto",
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M4 12.5l5 5L20 6.5"
  }));
}
function TopNav({
  onTheme,
  theme
}) {
  const links = ["How it works", "Sizing", "What it isn't", "Guides", "Pricing", "FAQ"];
  return /*#__PURE__*/React.createElement("header", {
    style: {
      position: "sticky",
      top: 0,
      zIndex: 20,
      background: "color-mix(in srgb, var(--cz-bg) 88%, transparent)",
      backdropFilter: "blur(12px)",
      borderBottom: "1px solid var(--cz-hair)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...WRAP,
      display: "flex",
      alignItems: "center",
      gap: 14,
      paddingTop: 12,
      paddingBottom: 12
    }
  }, /*#__PURE__*/React.createElement(BrandLockup, null), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("nav", {
    "aria-label": "Page",
    style: {
      display: "flex",
      alignItems: "center",
      gap: 22,
      fontSize: 13.5
    }
  }, links.map(l => /*#__PURE__*/React.createElement("a", {
    key: l,
    href: "#how",
    style: {
      color: "var(--cz-sub)",
      textDecoration: "none"
    }
  }, l))), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: onTheme,
    style: {
      border: "1px solid var(--cz-hair)",
      background: "transparent",
      color: "var(--cz-sub)",
      borderRadius: 999,
      minHeight: 38,
      padding: "0 14px",
      fontSize: 12.5,
      fontWeight: 650,
      cursor: "pointer"
    }
  }, theme === "dark" ? "Gallery" : "Blackout"), /*#__PURE__*/React.createElement("a", {
    href: "#open",
    style: {
      display: "inline-flex",
      alignItems: "center",
      minHeight: 38,
      padding: "0 17px",
      borderRadius: 999,
      background: "var(--cz-action-fill)",
      color: "var(--cz-action-text)",
      fontSize: 13.5,
      fontWeight: 650,
      textDecoration: "none"
    }
  }, "Open the app")));
}
function PasteDemo() {
  const URL = "weidian.com/item.html?itemID=7809154670";
  const [step, setStep] = React.useState(3);
  const [typed, setTyped] = React.useState(URL);
  const timers = React.useRef([]);
  const run = React.useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));
    setStep(0);
    setTyped("");
    later(() => setStep(1), 420);
    for (let i = 1; i <= URL.length; i++) later(() => setTyped(URL.slice(0, i)), 420 + i * 17);
    const end = 420 + URL.length * 17;
    later(() => setStep(2), end + 260);
    later(() => setStep(3), end + 1240);
  }, []);
  React.useEffect(() => {
    run();
    return () => timers.current.forEach(clearTimeout);
  }, [run]);
  const LABELS = ["Paste anything", "Reading", "Reading the listing", "Stashed"];
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "clamp(18px, 2.4vw, 24px)",
      borderRadius: 22,
      background: "var(--cz-strip-bg)",
      border: "1px solid var(--cz-hair)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement(Kicker, {
    size: 10,
    tracking: "0.13em"
  }, LABELS[step]), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: run,
    style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      minHeight: 30,
      padding: "0 11px",
      border: "1px solid var(--cz-hair)",
      borderRadius: 999,
      background: "var(--cz-card-solid)",
      color: "var(--cz-sub)",
      fontSize: 11.5,
      fontWeight: 650,
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "11",
    height: "11",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.4",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M20 11a8 8 0 1 0-2.3 5.7"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M20 5v6h-6"
  })), "Replay")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10,
      minHeight: 52,
      padding: "0 14px",
      border: "1px solid color-mix(in srgb, var(--cz-ink) 20%, transparent)",
      borderRadius: 14,
      background: "var(--cz-card-solid)"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.2",
    strokeLinecap: "round",
    "aria-hidden": "true",
    style: {
      color: "var(--cz-faint)",
      flex: "0 0 auto"
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M9 15l6-6"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M11 6l1-1a4.2 4.2 0 0 1 6 6l-1 1"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M13 18l-1 1a4.2 4.2 0 0 1-6-6l1-1"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0,
      fontFamily: "var(--cz-mono)",
      fontSize: 13,
      color: "var(--cz-ink)",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, typed), step === 1 ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-block",
      width: 1.5,
      height: 16,
      background: "var(--cz-ink)"
    }
  }) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: 34,
      fontFamily: "var(--cz-mono)",
      fontSize: 11,
      color: "var(--cz-faint)",
      gap: 8
    }
  }, step === 2 ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    style: {
      display: "inline-block",
      width: 12,
      height: 12,
      border: "2px solid var(--cz-hair)",
      borderTopColor: "var(--cz-ink)",
      borderRadius: 999,
      animation: "czSpin .7s linear infinite"
    }
  }), "Reading the listing") : null, step === 3 ? /*#__PURE__*/React.createElement("svg", {
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 5v13"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7 13l5 5 5-5"
  })) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: 318
    }
  }, step === 3 ? /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(ProductCard, {
    title: "Kit jersey \xB7 black",
    image: "../../assets/img/kit-jersey-black.jpg",
    alt: "Kit jersey in black",
    price: "$23.52",
    sizeKind: "AI SIZE",
    sizeLabel: "L",
    sizeLive: true,
    status: "want",
    albumCount: 8
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 8,
      alignContent: "start"
    }
  }, [["Seller", "Mook-official"], ["Photos", "8 from the listing"], ["Size", "L · from the chart"], ["Weight", "~380 g"]].map(([l, v]) => /*#__PURE__*/React.createElement("div", {
    key: l,
    style: {
      display: "flex",
      alignItems: "center",
      gap: 9,
      minHeight: 46,
      padding: "0 12px",
      border: "1px solid var(--cz-hair)",
      borderRadius: 11,
      background: "var(--cz-card-solid)"
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--cz-money)",
    strokeWidth: "3",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M4 12.5l5 5L20 6.5"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: "var(--cz-mono)",
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      color: "var(--cz-faint)",
      flex: "0 0 auto"
    }
  }, l), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0,
      fontSize: 12.5,
      fontWeight: 650,
      textAlign: "right",
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, v))))) : null)), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "12px 2px 0",
      fontSize: 12.5,
      lineHeight: 1.5,
      color: "var(--cz-faint)"
    }
  }, "One paste. Photos, price, seller and a size pick. No typing, no spreadsheet row."));
}
Object.assign(window, {
  TopNav,
  PasteDemo,
  WRAP,
  SECTION,
  SERIF_H,
  LEDE,
  Check
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketing_site/Nav.jsx", error: String((e && e.message) || e) }); }

// ui_kits/marketing_site/Sections.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const {
  Kicker,
  ProductCard,
  HaulBar,
  SizeRecommendation,
  SizeChartTable,
  StatusTrack,
  Chip,
  BuyButton
} = window.CredenzaFashionDesignSystem_8f0205;
function Hero() {
  const {
    WRAP,
    PasteDemo
  } = window;
  return /*#__PURE__*/React.createElement("section", {
    style: {
      ...WRAP,
      padding: "clamp(36px, 5.5vw, 72px) clamp(24px, 6.5vw, 48px) clamp(34px, 4.5vw, 58px)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
      gap: "clamp(28px, 4vw, 56px)",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 9,
      flexWrap: "wrap",
      fontFamily: "var(--cz-mono)",
      fontSize: 11,
      fontWeight: 650,
      letterSpacing: "0.13em",
      textTransform: "uppercase",
      color: "var(--cz-faint)"
    }
  }, /*#__PURE__*/React.createElement("span", null, "Taobao"), /*#__PURE__*/React.createElement("span", {
    style: {
      opacity: 0.45
    }
  }, "\xB7"), /*#__PURE__*/React.createElement("span", null, "Weidian"), /*#__PURE__*/React.createElement("span", {
    style: {
      opacity: 0.45
    }
  }, "\xB7"), /*#__PURE__*/React.createElement("span", null, "Yupoo"), /*#__PURE__*/React.createElement("span", {
    style: {
      opacity: 0.45
    }
  }, "\xB7"), /*#__PURE__*/React.createElement("span", null, "1688")), /*#__PURE__*/React.createElement("h1", {
    style: {
      margin: "14px 0 0",
      fontFamily: "var(--cz-display)",
      fontSize: "clamp(34px, 5vw, 58px)",
      fontWeight: 600,
      lineHeight: 1.06,
      letterSpacing: "-0.038em",
      textWrap: "balance"
    }
  }, "Your haul lives in 40 tabs and a note app."), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "18px 0 0",
      maxWidth: "32em",
      fontSize: "clamp(15.5px, 1.3vw, 17.5px)",
      lineHeight: 1.62,
      color: "var(--cz-sub)",
      textWrap: "pretty"
    }
  }, "Credenza is a Taobao, Weidian and 1688 shopping organizer. Paste a link and it becomes a card with the photos, the price and a size pick. Track QC, group it into a haul, then open Buy in your own agent."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 12,
      flexWrap: "wrap",
      marginTop: 28
    }
  }, /*#__PURE__*/React.createElement("a", {
    href: "#open",
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: 54,
      padding: "0 26px",
      borderRadius: 16,
      background: "var(--cz-action-fill)",
      color: "var(--cz-action-text)",
      fontSize: 15.5,
      fontWeight: 700,
      textDecoration: "none"
    }
  }, "Open Credenza, it's free"), /*#__PURE__*/React.createElement("a", {
    href: "#how",
    style: {
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: 54,
      padding: "0 20px",
      borderRadius: 16,
      border: "1px solid var(--cz-hair)",
      background: "var(--cz-card-solid)",
      color: "var(--cz-ink)",
      fontSize: 15,
      fontWeight: 650,
      textDecoration: "none"
    }
  }, "See it work")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap",
      marginTop: 16,
      fontFamily: "var(--cz-mono)",
      fontSize: 11.5,
      color: "var(--cz-faint)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: 999,
      background: "var(--cz-money)"
    }
  }), /*#__PURE__*/React.createElement("span", null, "No account"), /*#__PURE__*/React.createElement("span", {
    style: {
      opacity: 0.45
    }
  }, "\xB7"), /*#__PURE__*/React.createElement("span", null, "Nothing to install"), /*#__PURE__*/React.createElement("span", {
    style: {
      opacity: 0.45
    }
  }, "\xB7"), /*#__PURE__*/React.createElement("span", null, "Your shelf stays on your device"))), /*#__PURE__*/React.createElement(PasteDemo, null)));
}
function ShelfSection() {
  const {
    WRAP,
    SECTION,
    SERIF_H,
    LEDE
  } = window;
  const cards = [{
    title: "Kit jersey · black",
    image: "../../assets/img/kit-jersey-black.jpg",
    price: "$23.52",
    sizeKind: "AI SIZE",
    sizeLabel: "L",
    sizeLive: true,
    status: "shipped",
    favorite: true,
    albumCount: 8
  }, {
    title: "Kit shorts · black",
    image: "../../assets/img/kit-shorts-black.jpg",
    price: "$27.72",
    sizeKind: "AI SIZE",
    sizeLabel: "L",
    sizeLive: true,
    status: "bought",
    albumCount: 6
  }, {
    title: "Floral soccer jersey",
    image: "../../assets/img/floral-soccer-jersey.jpg",
    price: "$38.92",
    sizeKind: "YOUR USUAL",
    sizeLabel: "L",
    favorite: true,
    albumCount: 12
  }, {
    title: "Dry-fit training top",
    image: "../../assets/img/dry-fit-training-top.jpg",
    price: "$32.06",
    sizeKind: "SIZE",
    sizeLabel: "XL",
    status: "qc",
    albumCount: 9
  }];
  return /*#__PURE__*/React.createElement("section", {
    id: "how",
    style: {
      borderTop: "1px solid var(--cz-hair)",
      background: "var(--cz-footer-bg)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...WRAP,
      ...SECTION
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: "44rem"
    }
  }, /*#__PURE__*/React.createElement(Kicker, null, "The shelf"), /*#__PURE__*/React.createElement("h2", {
    style: SERIF_H
  }, "Everything you're watching, on one page."), /*#__PURE__*/React.createElement("p", {
    style: LEDE
  }, "Cards carry the photo, the size pick, the price and where it is in the order. Group them into a haul and you get the running total and a parcel weight estimate before you commit.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(196px, 1fr))",
      gap: 14,
      marginTop: 30
    }
  }, cards.map(c => /*#__PURE__*/React.createElement(ProductCard, _extends({
    key: c.title
  }, c, {
    alt: c.title
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement(HaulBar, {
    name: "July haul",
    items: "8 items",
    parcel: "est. parcel 3.4 kg",
    total: "$548.08"
  }))));
}
function SizeSection() {
  const {
    WRAP,
    SECTION,
    SERIF_H,
    LEDE,
    Check
  } = window;
  const points = ["Reads the chart out of the listing text, or out of the album photos when the seller only posts an image.", "Tells you the ease in centimetres, not a vague “runs small”.", "Says when it doesn't know. No chart means no confident pick."];
  return /*#__PURE__*/React.createElement("section", {
    id: "size",
    style: {
      borderTop: "1px solid var(--cz-hair)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...WRAP,
      ...SECTION,
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 330px), 1fr))",
      gap: "clamp(28px, 4vw, 56px)",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Kicker, null, "Sizing"), /*#__PURE__*/React.createElement("h2", {
    style: SERIF_H
  }, "A size pick that shows its work."), /*#__PURE__*/React.createElement("p", {
    style: LEDE
  }, "Save your measurements once. Credenza reads the seller's chart, from the listing text or the photos of it, then compares it to you and tells you which size and why in one sentence. No chart on the listing? It says so and falls back to your usual size rather than inventing a confident answer."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 9,
      marginTop: 20
    }
  }, points.map(p => /*#__PURE__*/React.createElement("div", {
    key: p,
    style: {
      display: "flex",
      gap: 9,
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement(Check, null), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14.5,
      lineHeight: 1.55,
      color: "var(--cz-sub)"
    }
  }, p))))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "clamp(16px, 2vw, 22px)",
      borderRadius: 22,
      background: "var(--cz-strip-bg)",
      border: "1px solid var(--cz-hair)"
    }
  }, /*#__PURE__*/React.createElement(SizeRecommendation, {
    size: "Large",
    confidence: "Read from the seller's chart",
    prescription: "Take the Large. Its 104cm chest gives you 6cm of room over your 98cm, which is where this jersey is meant to sit. The Medium's 100cm would pull across the chest.",
    you: "98cm",
    garment: "104cm",
    ease: "+6cm"
  }, /*#__PURE__*/React.createElement(SizeChartTable, {
    columns: ["Size", "Chest", "Length", "Shldr"],
    rows: [["S", "96", "68", "44"], ["M", "100", "70", "46"], ["L", "104", "72", "48"], ["XL", "108", "74", "50"]],
    recommended: "L",
    footnote: "Chart read from 4 album photos \xB7 Jul 24"
  })))));
}
Object.assign(window, {
  Hero,
  ShelfSection,
  SizeSection
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/marketing_site/Sections.jsx", error: String((e && e.message) || e) }); }

__ds_ns.BrandLockup = __ds_scope.BrandLockup;

__ds_ns.BrandMark = __ds_scope.BrandMark;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.BuyButton = __ds_scope.BuyButton;

__ds_ns.Caption = __ds_scope.Caption;

__ds_ns.Chip = __ds_scope.Chip;

__ds_ns.Field = __ds_scope.Field;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Kicker = __ds_scope.Kicker;

__ds_ns.SearchField = __ds_scope.SearchField;

__ds_ns.SegmentedControl = __ds_scope.SegmentedControl;

__ds_ns.ModalShell = __ds_scope.ModalShell;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.Masthead = __ds_scope.Masthead;

__ds_ns.ViewTabs = __ds_scope.ViewTabs;

__ds_ns.HaulBar = __ds_scope.HaulBar;

__ds_ns.PriceChip = __ds_scope.PriceChip;

__ds_ns.ProductCard = __ds_scope.ProductCard;

__ds_ns.SizeChartTable = __ds_scope.SizeChartTable;

__ds_ns.SizeRecommendation = __ds_scope.SizeRecommendation;

__ds_ns.StatusPill = __ds_scope.StatusPill;

__ds_ns.StatusTrack = __ds_scope.StatusTrack;

})();
