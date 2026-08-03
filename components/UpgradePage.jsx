import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { PRICING } from "../credenza-fashion.jsx";
import { Pill, RainbowBackground, SegmentedControl } from "./atoms.jsx";
import {
  PLAN_COPY,
  PLAN_REASSURANCE,
  PLAN_ROWS,
  PLAN_ROWS_NOTE,
} from "./plans.js";

// ═══════════════════════════════════════════════════════════════════════════
// UpgradePage — sign-in handoff README, screen 3.
//
// Pro gets a route, not a settings pane. A billing period, two plan cards and
// a nine-row table do not fit in the right-hand column of a settings page, and
// a person who came here to read the numbers should be able to send the
// address to someone else.
//
// Two things this screen must never do:
//
//   It never takes a card number. The button hands off to Stripe. Credenza
//   does not host a checkout (docs/Monetization.md).
//
//   It never charges a signed-out person. Signed out, the button opens the
//   sign-in window and records where it came from, so the round trip through
//   the mail app comes back here with the period still chosen.
//
// Every number is read from PRICING or from plans.js. A price typed here
// would drift away from what Stripe actually charges, and the person would
// read one figure on the button and see another on the card.
// ═══════════════════════════════════════════════════════════════════════════

const PERIOD_OPTIONS = [
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

// README deviation, for the morning report: the README's price table prints
// "3 days free" on all three rows. The shipped checkout attaches the trial to
// the weekly price only (preview/netlify/functions/checkout.js). Promising
// free days on a plan that bills at once would be a false statement to
// someone about to pay, so only weekly carries the trial here.
const PERIODS = {
  weekly: {
    price: PRICING.weekly,
    unit: "a week",
    note: PRICING.weeklyTrialNote + ".",
    trial: true,
  },
  monthly: {
    price: PRICING.monthly,
    unit: "a month",
    note: PRICING.monthly + " a month until you cancel.",
    trial: false,
  },
  yearly: {
    price: PRICING.yearly,
    unit: "a year",
    note:
      "Works out to " +
      PRICING.yearlyPerMonth +
      ". " +
      PRICING.yearlySaving +
      " against weekly.",
    trial: false,
  },
};

const DEFAULT_PERIOD = "weekly";

/**
 * @param {object} props
 * @param {boolean} props.signedIn
 * @param {boolean} props.isPro
 * @param {string} [props.period] - restored from a sign-in round trip.
 * @param {(period: string) => void} props.onStart - checkout, or sign-in first.
 * @param {() => void} props.onClose
 */
export default function UpgradePage({
  signedIn = false,
  isPro = false,
  period: initialPeriod,
  onStart,
  onClose,
}) {
  const dialogRef = useRef(null);
  const [period, setPeriod] = useState(
    PERIODS[initialPeriod] ? initialPeriod : DEFAULT_PERIOD,
  );
  const [busy, setBusy] = useState(false);
  const plan = PERIODS[period] || PERIODS[DEFAULT_PERIOD];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    // The browser closes a dialog on Escape by itself, and that would leave
    // the address bar still saying /upgrade. Cancel it and take the same door
    // the back link takes.
    const onCancel = (e) => {
      e.preventDefault();
      onClose();
    };
    if (dialog) dialog.addEventListener("cancel", onCancel);
    return () => {
      if (dialog) dialog.removeEventListener("cancel", onCancel);
    };
  }, [onClose]);

  // The flag in the top right is a projection of where this person stands. It
  // is never stored, so it can never disagree with the plan cards below it.
  const standing = !signedIn
    ? "Signed out · Free"
    : isPro
      ? "Signed in · Pro"
      : "Signed in · Free";

  const start = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onStart(period);
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog ref={dialogRef} className="cz-upgrade" aria-label="Pro">
      <RainbowBackground />

      <header className="cz-upgrade-bar">
        <button type="button" className="cz-upgrade-back" onClick={onClose}>
          <ArrowLeft size={15} strokeWidth={2.2} aria-hidden="true" />
          Back to the shelf
        </button>
        <span className="cz-upgrade-divider" aria-hidden="true" />
        <span className="cz-upgrade-wordmark">CREDENZA</span>
        <span className="cz-upgrade-bar-title">Pro</span>
        <span className="cz-upgrade-standing">{standing}</span>
      </header>

      <div className="cz-upgrade-scroll">
        <div className="cz-upgrade-body">
          <section className="cz-upgrade-hero">
            <p className="cz-upgrade-kicker">Pro</p>
            <h1 className="cz-upgrade-head">Free is the whole app. Pro is more of it.</h1>
            <p className="cz-upgrade-lede">
              Nothing on your shelf is locked. Pro raises the daily counters on the three
              things that call a paid model, and funds the servers.
            </p>
            <div className="cz-upgrade-period">
              <SegmentedControl
                label="Billing period"
                value={period}
                onChange={(v) => setPeriod(v || DEFAULT_PERIOD)}
                options={PERIOD_OPTIONS}
              />
            </div>
          </section>

          <section className="cz-upgrade-plans">
            <div className="cz-upgrade-plan">
              <div className="cz-upgrade-plan-flag">
                <span>Free</span>
                {!isPro ? <span className="cz-upgrade-tag">Your plan</span> : null}
              </div>
              <p className="cz-upgrade-figure">
                <span className="cz-upgrade-amount">$0</span>
              </p>
              {/* The free promise is read from plans.js, so this card, the cap
                  modal and Settings all quote the same number. */}
              <p className="cz-upgrade-plan-body">{PLAN_COPY.freeCardBody}</p>
              <span className="cz-upgrade-spacer" aria-hidden="true" />
              <p className="cz-upgrade-foot">
                Most people do not need Pro. It only helps once you hit a counter.
              </p>
            </div>

            <div className="cz-upgrade-plan is-pro">
              <div className="cz-upgrade-plan-flag">
                <span className="cz-upgrade-flag-money">Pro</span>
                {isPro ? (
                  <span className="cz-upgrade-tag">Your plan</span>
                ) : plan.trial ? (
                  <span className="cz-upgrade-tag is-money">{PRICING.weeklyTrial}</span>
                ) : null}
              </div>
              <p className="cz-upgrade-figure">
                <span className="cz-upgrade-amount">{plan.price}</span>
                <span className="cz-upgrade-unit">{plan.unit}</span>
              </p>
              {/* The money line sits next to the button that starts the charge,
                  never in a footnote. */}
              <p className="cz-upgrade-note">{plan.note}</p>
              <span className="cz-upgrade-spacer" aria-hidden="true" />
              <Pill primary onClick={start} loading={busy} style={{ width: "100%" }}>
                {plan.trial ? "Start " + PRICING.weeklyTrial : "Upgrade to Pro"}
              </Pill>
              {!signedIn ? (
                <p className="cz-upgrade-foot">
                  Sign in first. The button opens the sign-in window, then comes straight
                  back here.
                </p>
              ) : null}
            </div>
          </section>

          <section className="cz-upgrade-table" aria-label="What changes with Pro">
            <div className="cz-upgrade-row is-head">
              <span className="cz-upgrade-row-kicker">What changes</span>
              <span className="cz-upgrade-col-free">Free</span>
              <span className="cz-upgrade-col-pro">Pro</span>
            </div>
            {PLAN_ROWS.map((row) => (
              <div className="cz-upgrade-row" key={row.label}>
                <span className="cz-upgrade-row-what">
                  <span className="cz-upgrade-row-name">{row.label}</span>
                  {row.note ? (
                    <span className="cz-upgrade-row-note">{row.note}</span>
                  ) : null}
                </span>
                <span className="cz-upgrade-col-free">{row.free}</span>
                <span className="cz-upgrade-col-pro">{row.pro}</span>
              </div>
            ))}
          </section>

          <p className="cz-upgrade-closing">{PLAN_ROWS_NOTE}</p>

          <section className="cz-upgrade-reassure">
            {PLAN_REASSURANCE.map((card) => (
              <div className="cz-upgrade-card" key={card.kicker}>
                <p className="cz-upgrade-kicker">{card.kicker}</p>
                <p className="cz-upgrade-card-head">{card.head}</p>
                <p className="cz-upgrade-card-body">{card.body}</p>
              </div>
            ))}
          </section>
        </div>
      </div>
    </dialog>
  );
}
