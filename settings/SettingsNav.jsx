import { useSettings } from "./SettingsContext.jsx";

// The section registry. Order is the design's order: account first, because
// that is the screen a person opens settings to find; about last. `summary`
// is the small value the rail shows on the right — static per section; the
// Shelf defaults row computes its own from context ("Superbuy · USD").
export const SETTINGS_SECTIONS = [
  { key: "account", label: "Account and plan", summary: null },
  { key: "sizes", label: "Sizes and measurements", summary: null },
  { key: "fit", label: "Fit preferences", summary: null },
  { key: "shelf", label: "Shelf defaults", summary: null },
  { key: "data", label: "Your data", summary: null },
  { key: "about", label: "About and support", summary: null },
];

// The rail (desktop) and the full-screen list (phone). Same rows, same
// order; the page decides the chrome around them. The Shelf defaults row
// carries the design's "Sugargoo · USD" summary — the two values a person
// most often opens settings to check.
export default function SettingsNav({ active, onSelect }) {
  const { accountSession, accountPlan, agentLabel, pricePrimary } = useSettings();
  const planState = accountPlan && accountPlan.state ? accountPlan.state : "free";
  const isPro = planState === "pro" || planState === "grace";
  return (
    <nav className="cz-settings-nav" aria-label="Settings sections">
      {SETTINGS_SECTIONS.map(({ key, label, summary }) => (
        <button
          key={key}
          type="button"
          className={"cz-settings-nav-item" + (key === active ? " is-active" : "")}
          aria-current={key === active ? "page" : undefined}
          onClick={() => onSelect(key)}
        >
          <span className="cz-settings-nav-label">{label}</span>
          {key === "shelf" && agentLabel ? (
            <span className="cz-settings-nav-summary">
              {agentLabel} · {pricePrimary}
            </span>
          ) : summary ? (
            <span className="cz-settings-nav-summary">{summary}</span>
          ) : null}
        </button>
      ))}
      {accountSession ? (
        <div className="cz-settings-nav-footer">
          <span className="cz-settings-nav-email">{accountSession.user.email || "Signed in"}</span>
          <span className={"cz-profile-plan" + (isPro ? " is-pro" : "")}>{isPro ? "Pro" : "Free"}</span>
        </div>
      ) : null}
    </nav>
  );
}
