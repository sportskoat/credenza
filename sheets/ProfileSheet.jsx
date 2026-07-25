import { useState } from "react";
import { ModalShell, Pill } from "../credenza-fashion.jsx";

// Profile sheet (design handoff PR3): account entry up top, then the data
// rows — agent, currency, import, storage. The account section (Part 7e)
// renders only when the build has Supabase env vars; without them the app
// stays account-free.
//
// `full` (desktop): the phone ALSO has the Settings sheet, so there the
// look-and-fit rows (Theme, sizes, fit prefs, fit summary) live in Settings
// and Profile keeps account + data only (Kyle 2026-07-25: the two sheets
// were duplicates). Desktop has no Settings sheet, so it gets every row.
export default function ProfileSheet({
  mode,
  onTheme,
  agentLabel,
  onOpenAgent,
  pricePrimary,
  onCycleCurrency,
  fitSummary,
  onToggleFitSummary,
  fitDetail,
  onCycleFitDetail,
  onOpenSizes,
  onOpenFitPrefs,
  onOpenImport,
  storageLabel,
  storageColor,
  onEraseData,
  accountEnabled,
  accountSession,
  accountPlan,
  onMagicLink,
  onGoogle,
  onUpgrade,
  onPortal,
  onSignOut,
  onDeleteAccount,
  full = true,
  onClose,
}) {
  const themes = [
    ["light", "Gallery", "#F4F4F0", "1px solid rgba(0,0,0,.12)"],
    ["rainbow", "Blackout", "#000000", "1px solid rgba(255,255,255,.18)"],
  ];
  // Local UI state for the account card: the email draft, one busy flag per
  // action, an inline error line, and the "check your email" confirmation.
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(""); // "link" | "google" | "monthly" | "yearly" | "portal" | "signout" | "delete"
  const [error, setError] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  // Delete account is two-tap: the first tap arms it, the second sends it.
  // Arming resets whenever the sheet closes (state dies with the sheet).
  const [deleteArmed, setDeleteArmed] = useState(false);

  const run = async (key, fn) => {
    if (busy) return;
    setBusy(key);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(err && err.message ? String(err.message) : "Something went wrong — try again.");
    } finally {
      setBusy("");
    }
  };

  const planState = accountPlan && accountPlan.state ? accountPlan.state : "free";
  const isPro = planState === "pro" || planState === "grace";
  return (
    <ModalShell title="Profile" onClose={onClose} maxWidth={440}>
      <div className="cz-profile">
        {accountEnabled && !accountSession && (
        <div className="cz-profile-signin">
          <div className="cz-profile-signin-title">Sign in to Credenza</div>
          <div className="cz-profile-signin-sub">
            One account unlocks Pro and keeps your limits in sync. Your shelf stays on this device either way.
          </div>
          {linkSent ? (
            <div className="cz-profile-signin-sent" role="status">
              Check your email — the link signs you in. It works on this device only.
            </div>
          ) : (
            <>
              <label className="cz-profile-signin-field">
                <input
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  aria-label="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && /@.+\./.test(email)) {
                      run("link", async () => {
                        await onMagicLink(email);
                        setLinkSent(true);
                      });
                    }
                  }}
                />
              </label>
              <Pill
                primary
                style={{ width: "100%", minHeight: 50, borderRadius: 15, marginTop: 10 }}
                disabled={!!busy || !/@.+\./.test(email)}
                onClick={() =>
                  run("link", async () => {
                    await onMagicLink(email);
                    setLinkSent(true);
                  })
                }
              >
                {busy === "link" ? "Sending…" : "Email me a sign-in link"}
              </Pill>
              <div className="cz-profile-signin-or" aria-hidden="true">or</div>
              <Pill
                style={{ width: "100%", minHeight: 50, borderRadius: 15 }}
                disabled={!!busy}
                onClick={() => run("google", onGoogle)}
              >
                {busy === "google" ? "Opening Google…" : "Continue with Google"}
              </Pill>
            </>
          )}
          {error && <div className="cz-profile-signin-error" role="alert">{error}</div>}
        </div>
        )}
        {accountEnabled && accountSession && (
        <div className="cz-profile-signin">
          <div className="cz-profile-signin-title">
            {accountSession.user.email || "Signed in"}
            <span className={"cz-profile-plan" + (isPro ? " is-pro" : "")}>
              {isPro ? "Pro" : "Free"}
            </span>
          </div>
          <div className="cz-profile-signin-sub">
            {isPro
              ? planState === "grace"
                ? "Your paid period ended — Pro holds during the grace window."
                : "Thanks for supporting Credenza."
              : "Pro lifts the daily limits and funds the servers."}
          </div>
          {!isPro && (
            <div className="cz-profile-upgrade-row">
              <Pill
                primary
                style={{ flex: 1, minHeight: 46, borderRadius: 14 }}
                disabled={!!busy}
                onClick={() => run("monthly", () => onUpgrade("monthly"))}
              >
                {busy === "monthly" ? "Opening…" : "$5 / month"}
              </Pill>
              <Pill
                style={{ flex: 1, minHeight: 46, borderRadius: 14 }}
                disabled={!!busy}
                onClick={() => run("yearly", () => onUpgrade("yearly"))}
              >
                {busy === "yearly" ? "Opening…" : "$39 / year"}
              </Pill>
            </div>
          )}
          {isPro && (
            <Pill
              style={{ width: "100%", minHeight: 46, borderRadius: 14 }}
              disabled={!!busy}
              onClick={() => run("portal", onPortal)}
            >
              {busy === "portal" ? "Opening…" : "Manage billing"}
            </Pill>
          )}
          <button
            type="button"
            className="cz-profile-row"
            disabled={!!busy}
            onClick={() => run("signout", onSignOut)}
          >
            <span>{busy === "signout" ? "Signing out…" : "Sign out"}</span>
            <span className="cz-profile-row-val">This device only ›</span>
          </button>
          <button
            type="button"
            className="cz-profile-row cz-profile-danger"
            disabled={!!busy}
            onClick={() => {
              if (!deleteArmed) {
                setDeleteArmed(true);
                setError("");
                return;
              }
              run("delete", onDeleteAccount);
            }}
          >
            <span>
              {busy === "delete"
                ? "Deleting…"
                : deleteArmed
                  ? "Tap again to delete your account"
                  : "Delete account"}
            </span>
            <span className="cz-profile-row-val">
              {deleteArmed ? "No undo. Your shelf stays on this device." : "Sign-in & plan ›"}
            </span>
          </button>
          {error && <div className="cz-profile-signin-error" role="alert">{error}</div>}
        </div>
        )}
        {full ? (
        <>
        <div className="cz-profile-label">Theme</div>
        <div className="cz-profile-themes">
          {themes.map(([id, label, swatch, swatchBorder]) => {
            const active = mode === id;
            return (
              <button
                key={id}
                type="button"
                className={"cz-profile-theme" + (active ? " is-active" : "")}
                aria-pressed={active}
                onClick={() => onTheme(id)}
              >
                <span
                  className="cz-profile-theme-swatch"
                  style={{ background: swatch, border: swatchBorder }}
                  aria-hidden="true"
                />
                {label}
                <span className="cz-profile-theme-check" aria-hidden="true">
                  {active ? "✓" : ""}
                </span>
              </button>
            );
          })}
        </div>
        <button type="button" className="cz-profile-row" onClick={onOpenSizes}>
          <span>Your sizes</span>
          <span className="cz-profile-row-val">Body profile ›</span>
        </button>
        <button type="button" className="cz-profile-row" onClick={onOpenFitPrefs}>
          <span>Fit preferences</span>
          <span className="cz-profile-row-val">Length & looseness ›</span>
        </button>
        </>
        ) : null}
        <button type="button" className="cz-profile-row" onClick={onOpenAgent}>
          <span>Default agent</span>
          <span className="cz-profile-row-val">{agentLabel} ›</span>
        </button>
        <button type="button" className="cz-profile-row" onClick={onCycleCurrency}>
          <span>Primary currency</span>
          <span className="cz-profile-row-val">{pricePrimary} ›</span>
        </button>
        {full ? (
        <>
        <button type="button" className="cz-profile-row" onClick={onToggleFitSummary} aria-pressed={fitSummary}>
          {/* Part 5 task 12: local math, not AI — the sentence comes from
              recommendSize over the chart and the body profile. */}
          <span>Fit summary</span>
          <span className="cz-profile-row-val">{fitSummary ? "On" : "Off"} ›</span>
        </button>
        {/* Accordion so the Fit detail row animates in/out on toggle instead of
            popping. Same t-acc + t-panel-slide composite as the dropdowns. */}
        <div className="t-acc cz-profile-acc" data-open={fitSummary}>
          <div
            className="t-acc-panel"
            aria-hidden={!fitSummary}
            inert={!fitSummary ? "" : undefined}
          >
            <div className="t-acc-panel-inner">
              <div className="t-panel-slide" data-open={fitSummary}>
                <button type="button" className="cz-profile-row" onClick={onCycleFitDetail}>
                  <span>Fit detail</span>
                  <span className="cz-profile-row-val">{fitDetail === "detailed" ? "Detailed" : "Concise"} ›</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        </>
        ) : null}
        <button type="button" className="cz-profile-row" onClick={onOpenImport}>
          <span>Import &amp; backup</span>
          <span className="cz-profile-row-val">›</span>
        </button>
        <div className="cz-profile-row is-static">
          <span>Storage</span>
          <span className="cz-profile-row-val cz-profile-storage">
            <span
              className="cz-profile-storage-dot"
              style={{ background: storageColor }}
              aria-hidden="true"
            />
            {storageLabel}
          </span>
        </div>
        <div className="cz-profile-legal">
          <a className="cz-profile-legal-link" href="/privacy/" target="_blank" rel="noreferrer">
            Privacy
          </a>
          <a className="cz-profile-legal-link" href="/terms/" target="_blank" rel="noreferrer">
            Terms
          </a>
          <a className="cz-profile-legal-link" href="mailto:wenselllc@gmail.com">
            Support
          </a>
        </div>
        <button type="button" className="cz-profile-row cz-profile-danger" onClick={onEraseData}>
          <span>Erase my data</span>
          <span className="cz-profile-row-val">Deletes everything ›</span>
        </button>
      </div>
    </ModalShell>
  );
}
