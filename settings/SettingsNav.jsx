import { useSettings } from "./SettingsContext.jsx";

// Five sections. Fit preferences folds into Sizes (design handoff 2026-08-01).
// Order matches the scroll column. Shelf carries the agent · currency meta.
// `chip` is the short phone jump label (mobile item C / backlog item 6).
export const SETTINGS_SECTIONS = [
  { key: "account", label: "Account and plan", chip: "Account", summary: null },
  { key: "sizes", label: "Sizes and measurements", chip: "Sizes", summary: null },
  { key: "shelf", label: "Shelf defaults", chip: "Agent", summary: null },
  { key: "data", label: "Your data", chip: "Data", summary: null },
  { key: "about", label: "About and support", chip: "About", summary: null },
];

// Desktop rail (236px). Phone drops the rail; the page stacks every section.
// Account block is pinned to the bottom and scrolls to Account and plan.
export default function SettingsNav({ active, onSelect }) {
  const { accountSession, accountPlan, agentLabel, pricePrimary } = useSettings();
  const planState = accountPlan && accountPlan.state ? accountPlan.state : "free";
  const isOwner = planState === "owner";
  const isPro = planState === "pro" || planState === "grace" || planState === "owner";
  const email = accountSession && accountSession.user ? accountSession.user.email : "";
  const initial = email ? email.charAt(0).toUpperCase() : "?";

  return (
    <nav className="cz-settings-nav" aria-label="Settings sections">
      {SETTINGS_SECTIONS.map(({ key, label }) => (
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
              {String(agentLabel).toUpperCase()} · {pricePrimary}
            </span>
          ) : null}
        </button>
      ))}
      <button
        type="button"
        className="cz-settings-nav-account"
        onClick={() => onSelect("account")}
        aria-label={email ? "Account: " + email : "Account and plan"}
      >
        <span className="cz-settings-nav-avatar" aria-hidden="true">
          {initial}
        </span>
        <span className="cz-settings-nav-email">{email || "Signed out"}</span>
        {isPro ? <span className="cz-settings-nav-pro">{isOwner ? "OWNER" : "PRO"}</span> : null}
      </button>
    </nav>
  );
}
