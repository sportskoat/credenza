import { ModalShell, PRICING } from "../credenza-fashion.jsx";
import { Pill } from "../components/atoms.jsx";
import { PLAN_COPY } from "../components/plans.js";
import { PLAN_CAPS } from "../preview/src/usage.js";
import { ANON_FREE_CARDS, limitStandingLine } from "../preview/src/limits.js";

// ═══════════════════════════════════════════════════════════════════════════
// LimitsSheet — ONE sheet for every limit in the app (Kyle 2026-07-30)
//
// Before this, each limit had its own words in its own corner: a toast for the
// spent free cards, a red line in the Ask box for its allowance, a settings
// screen for a lapsed membership. Three walls, three vocabularies, and every
// one of them read as a defect.
//
// Now the header pill, a spent allowance, a plan cap and an ended membership
// all open this sheet, and it always answers the same three questions in the
// same order:
//
//   1. Where am I now?
//   2. What does signing in give me?   (signed-out only)
//   3. What does Pro give me, and what does it cost?
//
// THE SHEET NEVER OPENS ITSELF. A sheet that appears on page load is nagging,
// and nagging drives visitors away. The caller opens it on a tap, or when the
// person actually reaches a wall.
// ═══════════════════════════════════════════════════════════════════════════

// One row per metered action, in the order a person meets them. The numbers come
// from PLAN_CAPS, so the sheet can never quote a cap the app does not enforce.
const ROWS = [
  { freeKey: "resolveTotal", proKey: "resolvePerMonth", label: "Cards from a link" },
  { freeKey: "chartVisionTotal", proKey: "chartVisionPerMonth", label: "Size chart reads" },
  // Kyle 2026-08-02: no page prints an Ask number. The cap still runs and the
  // meter still names it when a person reaches the wall.
];

function CapTable() {
  return (
    <table className="cz-limits-caps">
      <thead>
        <tr>
          <th scope="col">Allowance</th>
          <th scope="col">Free</th>
          <th scope="col" className="cz-limits-pro-cell">
            Pro
          </th>
        </tr>
      </thead>
      <tbody>
        {ROWS.map((row) => (
          <tr key={row.label}>
            <th scope="row">{row.label}</th>
            <td>{PLAN_CAPS.free[row.freeKey]} total</td>
            <td className="cz-limits-pro-cell">{PLAN_CAPS.pro[row.proKey]} monthly</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function meterWords(status) {
  if (!status) return "";
  if (status.kind === "anon") return "free cards";
  if (status.feature === "chartVision") return "chart reads";
  if (status.feature === "ask") return "questions";
  return "cards from a link";
}

function UsageMeter({ status }) {
  if (!status) return null;
  const used = Math.max(0, Math.min(status.used, status.cap));
  const segments = Array.from({ length: status.cap }, (_, index) => index < used);

  return (
    <div className="cz-limits-meter">
      <div
        className="cz-limits-meter-track"
        role="progressbar"
        style={{ "--cz-limit-segments": status.cap }}
        aria-label={limitStandingLine(status)}
        aria-valuemin={0}
        aria-valuemax={status.cap}
        aria-valuenow={used}
      >
        {segments.map((filled, index) => (
          <span
            // The meter has no interactive children. Its fixed order is its identity.
            key={index}
            className={filled ? "is-filled" : ""}
            aria-hidden="true"
          />
        ))}
      </div>
      <p className="cz-limits-meter-caption">
        {used} of {status.cap} {meterWords(status)} used
      </p>
    </div>
  );
}

// ── The cap modal (sign-in handoff README, screen 1) ───────────────────────
//
// The signed-out wall is its own screen now. It answers one question — why did
// the shelf stop — and then offers TWO different doors, not one door twice.
//
// Before this, "Sign in, free" and "Go Pro" both landed on the same settings
// page, so the choice the modal offered was not a real choice. The primary is
// free and instant. The secondary is honest about being a separate question,
// and it leaves for its own route.
//
// The cap table, the price note and the promise line all belong to the
// signed-in states below. This screen names no price at all.
function CapProgress({ status }) {
  if (!status) return null;
  const used = Math.max(0, Math.min(status.used, status.cap));
  const segments = Array.from({ length: status.cap }, (_, index) => index < used);

  return (
    <div className="cz-cap-progress">
      <div
        className="cz-cap-progress-track"
        role="progressbar"
        aria-label={limitStandingLine(status)}
        aria-valuemin={0}
        aria-valuemax={status.cap}
        aria-valuenow={used}
      >
        {segments.map((filled, index) => (
          <span
            // The bar has no interactive children. Its fixed order is its identity.
            key={index}
            className={filled ? "is-filled" : ""}
            aria-hidden="true"
          />
        ))}
      </div>
      {/* Every number here is read off the status, so the line can never
          promise a count the gate does not enforce. */}
      <p className="cz-cap-flag">
        {used} of {status.cap} · Signed out
      </p>
    </div>
  );
}

function CapModal({ status, title, onSignIn, onUpgrade, onClose }) {
  return (
    <ModalShell
      title={title}
      onClose={onClose}
      maxWidth={520}
      bareHeader
      surfaceClassName="cz-cap-modal"
    >
      <div className="cz-cap">
        {/* The heading and the close button read as one title row. The shell
            lifts its bare header out of flow and pins it top right, and the
            heading reserves that corner, so the two never overlap. */}
        <h2 className="cz-cap-head">{title}</h2>
        <CapProgress status={status} />
        <p className="cz-cap-body">{PLAN_COPY.capBody}</p>
        <div className="cz-cap-actions">
          <Pill primary onClick={onSignIn} style={{ width: "100%" }}>
            Sign in · free
          </Pill>
          <Pill onClick={onUpgrade} style={{ width: "100%" }}>
            See what Pro changes
          </Pill>
        </div>
        <Pill subtle onClick={onClose} style={{ alignSelf: "center" }}>
          Not now
        </Pill>
      </div>
    </ModalShell>
  );
}

export default function LimitsSheet({ status, signedIn = false, onSignIn, onUpgrade, onClose }) {
  const anon = !signedIn;
  const ended = !!status && status.kind === "ended";

  // The title names the situation the person is in, because the sheet opens
  // from four different places and a generic title leaves them guessing.
  const title = ended
    ? "Your Pro ended."
    : status && status.tone === "wall"
      ? anon
        ? "That is your fifth free card."
        : "That is your Free allowance."
      : "Your free allowance.";

  if (anon) {
    return (
      <CapModal
        status={status}
        title={title}
        onSignIn={onSignIn}
        onUpgrade={onUpgrade}
        onClose={onClose}
      />
    );
  }

  return (
    <ModalShell title={title} onClose={onClose} maxWidth={460} surfaceClassName="cz-limits-sheet">
      <div className="cz-limits">
        <UsageMeter status={status} />

        {ended && (
          // Rule 4: a wall never breaks what you already have. Say that first,
          // because it is the fear that a lapsed membership creates.
          <p className="cz-limits-body">
            Every card you already made stays on your shelf and stays readable. Only a new read
            needs Pro. Resume for {PRICING.monthly} a month.
          </p>
        )}

        <CapTable />

        <div className="cz-limits-actions">
          {anon && (
            <button type="button" className="cz-limits-action is-primary" onClick={onSignIn}>
              Sign in, free
            </button>
          )}
          <button type="button" className="cz-limits-action" onClick={onUpgrade}>
            {ended ? "Resume Pro" : "Go Pro"}: {PRICING.monthly} a month
          </button>
          <p className="cz-limits-price-note">
            {PRICING.yearly} a year works out to {PRICING.yearlyPerMonth} · cancel any time
          </p>
        </div>

        <p className="cz-limits-promise">
          Your shelf is yours. Credenza never deletes a card you made, whatever your plan.
        </p>

        <button type="button" className="cz-limits-dismiss" onClick={onClose}>
          Not now
        </button>
      </div>
    </ModalShell>
  );
}

// Exported for the test that pins the free-card promise against the server.
export { ANON_FREE_CARDS };
