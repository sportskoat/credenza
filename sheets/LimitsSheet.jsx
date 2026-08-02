import { ModalShell, PRICING } from "../credenza-fashion.jsx";
import { PLAN_CAPS } from "../preview/src/usage.js";
import { ANON_FREE_CARDS, limitStandingLine } from "../preview/src/limits.js";

// ═══════════════════════════════════════════════════════════════════════════
// LimitsSheet — ONE sheet for every limit in the app (Kyle 2026-07-30)
//
// Before this, each limit had its own words in its own corner: a toast for the
// spent free cards, a red line in the Ask box for the daily cap, a settings
// screen for a lapsed membership. Three walls, three vocabularies, and every
// one of them read as a defect.
//
// Now the header pill, a spent allowance, a daily cap and an ended membership
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

// One row per daily read, in the order a person meets them. The numbers come
// from PLAN_CAPS, so the sheet can never quote a cap the app does not enforce.
const ROWS = [
  { key: "resolvePerDay", label: "Cards from a link" },
  { key: "chartVisionPerDay", label: "Size chart reads" },
  { key: "askPerDay", label: "Questions about your shelf" },
];

function CapTable() {
  return (
    <table className="cz-limits-caps">
      <thead>
        <tr>
          <th scope="col">Per day</th>
          <th scope="col">Free</th>
          <th scope="col" className="cz-limits-pro-cell">
            Pro
          </th>
        </tr>
      </thead>
      <tbody>
        {ROWS.map((row) => (
          <tr key={row.key}>
            <th scope="row">{row.label}</th>
            <td>{PLAN_CAPS.free[row.key]}</td>
            <td className="cz-limits-pro-cell">{PLAN_CAPS.pro[row.key]}</td>
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
        {used} of {status.cap} {meterWords(status)} used · resets tomorrow
      </p>
    </div>
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
        ? "That is your third free card."
        : "That is today's free limit."
      : "Your free allowance.";

  return (
    <ModalShell
      title={title}
      onClose={onClose}
      maxWidth={460}
      // F 2026-08-01: the sign-in ask is a decision, not a quick tool, so it
      // gets its own centered, frosted window on every screen instead of the
      // shared phone bottom sheet the other limit states keep. The extra
      // class carries that override; cz-limits-sheet still supplies the
      // shared spacing tokens and typography.
      surfaceClassName={anon ? "cz-limits-sheet cz-signin-sheet" : "cz-limits-sheet"}
    >
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

        {anon && (
          <p className="cz-limits-body">
            A free account raises every daily ceiling and keeps your shelf across your devices. No
            card, no checkout.
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
