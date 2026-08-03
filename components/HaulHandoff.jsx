import { useEffect, useMemo, useRef } from "react";
import { ChevronLeft } from "lucide-react";
import { handoffView } from "../haul-fulfillment.js";

/* ═══════════════════════════════════════════════════════════════════════════
   HaulHandoff — haul handoff README, screen 9.

   The moment the app admits it cannot act for you. How gracefully it does this
   sets the tone for the whole product. Credenza writes the instruction, checks
   the box, and totals the cost. A person still presses send on the agent's
   site.

   Three things earn their place here:

     What stays behind is shown, not hidden. A green-lit item left out of the
     box costs a second parcel for nothing, so that row keeps full opacity and
     a money-green action. The other two rows are dimmed, because the person
     cannot act on them today.

     The declared-value field carries one flat warning and no advice. This is a
     customs liability boundary. Both branches of the warning end the same way.

     "Mark submitted to agent" marks it here only. The line under the button
     says so. Do not cut that sentence.
   ═══════════════════════════════════════════════════════════════════════════ */

export default function HaulHandoff({
  // The haul's items, already shaped by toHaulItem.
  items = [],
  // The parcel arithmetic, already worked out by the screen behind this one.
  maths = null,
  line = "EMS",
  declared = 0,
  domesticUsd = 18.4,
  // (item) -> { image, tint }, for the row tiles.
  tileFor,
  onClose,
  // (text) — copies the instruction.
  onCopy,
  // (id) — moves a green-lit item into the parcel.
  onAddToParcel,
  // (value) — saves the declared value.
  onSetDeclared,
  // Marks the parcel submitted and opens tracking.
  onSubmit,
}) {
  const view = useMemo(
    () => handoffView({ items, maths, line, declared, domesticUsd }),
    [items, maths, line, declared, domesticUsd]
  );

  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog && dialog.open) dialog.close();
    };
  }, []);

  const tile = (id) => {
    const item = items.find((entry) => entry && entry.id === id);
    const face = item && tileFor ? tileFor(item) : null;
    const style = {};
    if (face && face.tint) style["--cz-ho-tint"] = face.tint;
    if (face && face.image) style.backgroundImage = "url(" + face.image + ")";
    return style;
  };

  return (
    <dialog
      ref={dialogRef}
      className="cz-ho"
      aria-label="Hand parcel A to your agent"
      onCancel={(event) => {
        event.preventDefault();
        if (onClose) onClose();
      }}
    >
      <div className="cz-ho-page">
        <div className="cz-ho-head">
          <button type="button" className="cz-ho-back" onClick={onClose}>
            <ChevronLeft aria-hidden="true" size={14} strokeWidth={2.2} />
            Back to the board
          </button>
          <h1 className="cz-ho-h1">Hand parcel A to your agent</h1>
        </div>
        <p className="cz-ho-lede">
          Credenza can&rsquo;t submit this for you. Check the box, then copy the instruction below
          into your agent&rsquo;s parcel form.
        </p>

        <div className="cz-ho-cols">
          <div className="cz-ho-left">
            <div className="cz-ho-card">
              <span className="cz-ho-kicker">In the box · {view.count}</span>

              {view.packed.map((row) => (
                <div className="cz-ho-row" key={row.id}>
                  <span className="cz-ho-tile" style={tile(row.id)} aria-hidden="true" />
                  <span className="cz-ho-rowtext">
                    <span className="cz-ho-title">{row.title}</span>
                    <span className="cz-ho-sub">{row.sub}</span>
                  </span>
                  <span className="cz-ho-weight">{row.weight}</span>
                  <span className="cz-ho-price">{row.price}</span>
                </div>
              ))}

              {view.leftBehind.length ? (
                <span className="cz-ho-kicker cz-ho-kicker-gap">What stays behind</span>
              ) : null}

              {view.leftBehind.map((row) => (
                <div className="cz-ho-row cz-ho-row-left" data-dim={row.dim ? "true" : "false"} key={row.id}>
                  <span className="cz-ho-tile" style={tile(row.id)} aria-hidden="true" />
                  <span className="cz-ho-rowtext">
                    <span className="cz-ho-title">{row.title}</span>
                    <span className="cz-ho-sub" data-tone={row.tone}>
                      {row.sub}
                    </span>
                  </span>
                  {row.actionLabel ? (
                    <button
                      type="button"
                      className="cz-ho-add"
                      onClick={() => onAddToParcel && onAddToParcel(row.id)}
                    >
                      {row.actionLabel}
                    </button>
                  ) : (
                    <span className="cz-ho-static">{row.staticLabel}</span>
                  )}
                </div>
              ))}
            </div>

            <div className="cz-ho-card">
              <div className="cz-ho-kickrow">
                <span className="cz-ho-kicker">Paste into your agent&rsquo;s parcel form</span>
                <span className="cz-ho-lang">EN + 中文</span>
              </div>
              <pre className="cz-ho-block">{view.instruction}</pre>
              <button
                type="button"
                className="cz-ho-outline"
                onClick={() => onCopy && onCopy(view.instruction)}
              >
                Copy instruction
              </button>
            </div>
          </div>

          <div className="cz-ho-right">
            <div className="cz-ho-sum">
              <div className="cz-ho-sumrow">
                <span className="cz-ho-sumlabel">Chargeable</span>
                <span className="cz-ho-sumvalue">{view.chargeable}</span>
              </div>
              <div className="cz-ho-sumrow">
                <span className="cz-ho-sumlabel">Billed at</span>
                <span className="cz-ho-sumvalue">{view.billed}</span>
              </div>
              <div className="cz-ho-sumrow">
                <span className="cz-ho-sumlabel">Line</span>
                <span className="cz-ho-sumvalue">{view.line}</span>
              </div>
              <div className="cz-ho-rule" />
              <div className="cz-ho-sumrow">
                <span className="cz-ho-sumlabel">Goods in this box</span>
                <span className="cz-ho-sumvalue cz-ho-money">{view.goods}</span>
              </div>
              <div className="cz-ho-sumrow">
                <span className="cz-ho-sumlabel">Agent domestic</span>
                <span className="cz-ho-sumvalue cz-ho-quiet">{view.domestic}</span>
              </div>
              <div className="cz-ho-sumrow">
                <span className="cz-ho-sumlabel">International</span>
                <span className="cz-ho-sumvalue cz-ho-money">{view.international}</span>
              </div>
              <div className="cz-ho-rule" />
              <div className="cz-ho-sumrow">
                <span className="cz-ho-landlabel">Landed</span>
                <span className="cz-ho-landvalue">{view.landed}</span>
              </div>
            </div>

            <div className="cz-ho-card cz-ho-declared">
              <div className="cz-ho-decrow">
                <span className="cz-ho-declabel" id="cz-ho-declared-label">
                  Declared value
                </span>
                <input
                  className="cz-ho-decinput"
                  type="number"
                  min="0"
                  step="1"
                  aria-labelledby="cz-ho-declared-label"
                  value={declared}
                  onChange={(event) => {
                    if (!onSetDeclared) return;
                    const next = Number(event.target.value);
                    onSetDeclared(Number.isFinite(next) && next > 0 ? next : 0);
                  }}
                />
              </div>
              <p className="cz-ho-warn">{view.declaredWarning}</p>
            </div>

            <button type="button" className="cz-ho-cta" onClick={onSubmit}>
              Mark submitted to agent
            </button>
            <p className="cz-ho-foot">
              Marks the parcel submitted here. You still have to press send on your agent&rsquo;s
              site.
            </p>
          </div>
        </div>
      </div>
    </dialog>
  );
}
