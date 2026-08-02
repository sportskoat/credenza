import { Check } from "lucide-react";
import {
  Caption,
  ModalShell,
  PRICE_PRIMARIES,
  formatMoney,
  normalizePricePrimary,
} from "../credenza-fashion.jsx";

// Currency picker (lane 2, 2026-08-02). Replaces the three-way click cycle.
// ModalShell is a bottom sheet on phone and a centered dialog on desktop —
// the same contract AgentSheet uses. One list, eight codes, pick and close.
//
// Labels stay plain codes (USD, EUR, …). The sample amount under the code
// shows the symbol formatMoney will print so the pick is never abstract.

const SAMPLE = 100;

const CURRENCY_NAMES = {
  USD: "US dollar",
  EUR: "Euro",
  CNY: "Chinese yuan",
  GBP: "British pound",
  JPY: "Japanese yen",
  KRW: "Korean won",
  CAD: "Canadian dollar",
  AUD: "Australian dollar",
};

export default function CurrencySheet({ pricePrimary, onSelectCurrency, onClose }) {
  const active = normalizePricePrimary(pricePrimary);

  const body = (
    <div className="cz-currency-sheet">
      <div className="cz-currency-kicker">
        <Caption>Prices show in</Caption>
      </div>
      <div
        role="radiogroup"
        aria-label="Primary currency"
        className="cz-currency-list"
      >
        {PRICE_PRIMARIES.map((code) => {
          const selected = code === active;
          return (
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              key={code}
              className={"cz-currency-row" + (selected ? " is-active" : "")}
              onClick={() => onSelectCurrency(code)}
            >
              <span className="cz-currency-row-main">
                <span className="cz-currency-code">{code}</span>
                <span className="cz-currency-name">{CURRENCY_NAMES[code] || code}</span>
              </span>
              <span className="cz-currency-sample" aria-hidden="true">
                {formatMoney(SAMPLE, code)}
              </span>
              {selected ? <Check size={15} aria-hidden="true" /> : <span className="cz-currency-check-slot" />}
            </button>
          );
        })}
      </div>
      <p className="cz-currency-note">
        Your pick sticks on this device. Item prices stay the same; only the
        numbers you see change.
      </p>
    </div>
  );

  return (
    <ModalShell title="Currency" onClose={onClose} maxWidth={420}>
      {body}
    </ModalShell>
  );
}
