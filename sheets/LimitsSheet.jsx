import { ModalShell, PRICING } from "../credenza-fashion.jsx";
import { Pill } from "../components/atoms.jsx";
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

function CapTable({ plan }) {
  const caps = PLAN_CAPS[plan];
  return (
    <ul className="cz-limits-caps">
      {ROWS.map((row) => (
        <li key={row.key} className="cz-limits-cap">
          <span className="cz-limits-cap-label">{row.label}</span>
          <span className="cz-limits-cap-value">{caps[row.key]} a day</span>
        </li>
      ))}
    </ul>
  );
}

export default function LimitsSheet({ status, signedIn = false, onSignIn, onUpgrade, onClose }) {
  const anon = !signedIn;
  const ended = !!status && status.kind === "ended";

  // The title names the situation the person is in, because the sheet opens
  // from four different places and a generic title leaves them guessing.
  const title = ended
    ? "Your Pro ended"
    : status && status.tone === "wall"
      ? anon
        ? "That is your third free card"
        : "That is today's free limit"
      : "Your free allowance";

  return (
    <ModalShell title={title} onClose={onClose} maxWidth={460}>
      <div className="cz-limits">
        {/* 1. Where you are now. Whole numbers, no bar, no percentage. */}
        <p className="cz-limits-standing">{limitStandingLine(status)}</p>

        {ended && (
          // Rule 4: a wall never breaks what you already have. Say that first,
          // because it is the fear that a lapsed membership creates.
          <p className="cz-limits-body">
            Every card you already made stays on your shelf and stays readable. Only a new read
            needs Pro. Resume for {PRICING.monthly} a month.
          </p>
        )}

        {anon && (
          <>
            {/* 2. What sign-in gives. Free, and it is the cheaper answer, so
                it comes before the price. */}
            <div className="cz-limits-block">
              <div className="cz-limits-block-title">Sign in — free</div>
              <p className="cz-limits-body">
                A free account raises the daily reads and keeps your shelf across your devices.
              </p>
              <CapTable plan="free" />
            </div>
          </>
        )}

        {/* 3. What Pro gives, and the price. */}
        <div className="cz-limits-block">
          <div className="cz-limits-block-title">Pro — {PRICING.monthly} a month</div>
          <CapTable plan="pro" />
          <p className="cz-limits-fine">
            {PRICING.weekly} a week or {PRICING.yearly} a year. Cancel any time.
          </p>
        </div>

        <div className="cz-limits-actions">
          {anon ? (
            <Pill primary style={{ flex: 1, minHeight: 46, borderRadius: 14 }} onClick={onSignIn}>
              Sign in
            </Pill>
          ) : (
            <Pill primary style={{ flex: 1, minHeight: 46, borderRadius: 14 }} onClick={onUpgrade}>
              {ended ? "Resume Pro" : "Go Pro"}
            </Pill>
          )}
          <Pill style={{ flex: 1, minHeight: 46, borderRadius: 14 }} onClick={onClose}>
            Not now
          </Pill>
        </div>

        <p className="cz-limits-fine">
          Your shelf is yours. Credenza never deletes a card you made, whatever your plan.
        </p>
      </div>
    </ModalShell>
  );
}

// Exported for the test that pins the free-card promise against the server.
export { ANON_FREE_CARDS };
