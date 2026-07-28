import { useState } from "react";
import { ModalShell, PRICING, Pill } from "../credenza-fashion.jsx";

// Profile sheet (design handoff PR3): account entry up top, then the data
// rows — agent, currency, import, storage. The account section (Part 7e)
// renders only when the build has Supabase env vars; without them the app
// stays account-free.
//
// `full` (desktop): the phone ALSO has the Settings sheet, so there the
// look-and-fit rows (Theme, sizes, fit prefs, fit summary) live in Settings
// and Profile keeps account + data only (Kyle 2026-07-25: the two sheets
// were duplicates). Desktop has no Settings sheet, so it gets every row.
// LB-50. The app's route out to the site. Ordered by what a person in the
// product actually wants next: what does this do, how do I do the thing, what
// does it cost, and who do I ask. Keep it to four — this list sits under the
// data rows, and a long one turns the sheet into a sitemap.
//
// The test at test/app-site-nav.test.js asserts every href here is a directory
// with an index.html under preview/public. A typo here is a 404 in the one
// place a confused person goes.
//
// No counts in the value column. "13 walkthroughs" was the first draft, and a
// number here goes stale the next time a guide ships — in a file nobody edits
// when they add a page.
const SITE_LINKS = [
  ["/how/", "How it works", "The shelf"],
  ["/guides/", "Guides", "Walkthroughs"],
  ["/pricing/", "Plans", "Free & Pro"],
  ["/support/", "Support", "Cancel, refund, bug"],
];

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
  onOpenSharedLinks,
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
  onOpenSettings,
  onClose,
  subPage = null,
  onBack,
}) {
  const themes = [
    ["light", "Gallery", "#F4F4F0", "1px solid rgba(0,0,0,.12)"],
    ["rainbow", "Blackout", "#000000", "1px solid rgba(255,255,255,.18)"],
  ];
  // Local UI state for the account card: the email draft, one busy flag per
  // action, an inline error line, and the "check your email" confirmation.
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(""); // "link" | "google" | "weekly" | "monthly" | "yearly" | "portal" | "signout" | "delete"
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
    <ModalShell title="Profile" onClose={onClose} maxWidth={440} stacked subPage={subPage} onBack={onBack}>
      <div className="cz-profile">
        {/* Auth off = SAY so (Kyle 2026-07-26: "I don't know where the sign-in
            went"). AUTH_ENABLED is false whenever the build has no Supabase
            keys, and until now that silently deleted the whole account
            section — indistinguishable from a bug. A local dev build is the
            usual cause; preview/.env.example lists the two variables. */}
        {!accountEnabled && (
        <div className="cz-profile-signin is-off">
          <div className="cz-profile-signin-title">Accounts are off in this build</div>
          <div className="cz-profile-signin-sub">
            This copy of Credenza has no sign-in server, so there is nothing to
            sign in to. Your shelf works exactly the same and stays on this
            device. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to turn
            accounts back on.
          </div>
        </div>
        )}
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
            <>
              {/* Weekly leads: it carries the 3-day trial and is the lowest
                  commitment. The trial terms sit ON the button and in the
                  note below — FTC negative-option: the free days, the
                  after-trial price, and the cadence next to the start. */}
              <Pill
                primary
                style={{ width: "100%", minHeight: 46, borderRadius: 14, marginBottom: 8 }}
                disabled={!!busy}
                onClick={() => run("weekly", () => onUpgrade("weekly"))}
              >
                {busy === "weekly"
                  ? "Opening…"
                  : PRICING.weeklyTrial + " — then " + PRICING.weekly + " / week"}
              </Pill>
              <div className="cz-profile-upgrade-row">
                <Pill
                  style={{ flex: 1, minHeight: 46, borderRadius: 14 }}
                  disabled={!!busy}
                  onClick={() => run("monthly", () => onUpgrade("monthly"))}
                >
                  {busy === "monthly" ? "Opening…" : PRICING.monthly + " / month"}
                </Pill>
                <Pill
                  style={{ flex: 1, minHeight: 46, borderRadius: 14 }}
                  disabled={!!busy}
                  onClick={() => run("yearly", () => onUpgrade("yearly"))}
                >
                  {busy === "yearly" ? "Opening…" : PRICING.yearly + " / year"}
                </Pill>
              </div>
            </>
          )}
          {/* The saving belongs under the buttons, not inside the yearly one:
              a two-line pill breaks the row, and the number is the reason to
              read the row again, not the label on one button. The trial note
              stays on its own line — it is a legal term, not a selling point. */}
          {!isPro && (
            <>
              <div className="cz-profile-upgrade-note">
                {PRICING.yearlySaving} on yearly · {PRICING.yearlyPerMonth}
              </div>
              <div className="cz-profile-upgrade-note">{PRICING.weeklyTrialNote}</div>
              {/* The referral disclosure must be readable here, in the open,
                  before the first tap — not behind an expander. The buy-link
                  copy in DetailBody/AgentSheet stays the canonical wording for
                  its own surface; this line is about the purchase decision. */}
              <div className="cz-profile-upgrade-note">
                Pro is a cap lift, not a key. Some agent links carry a referral code that
                funds the app. It never changes your price.
              </div>
            </>
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
        {/* Kyle 2026-07-27: "different options cleaner … It's too clunky the
            way it is right now with how everything is set up."

            Every row below used to be one flat run of hairlines from Theme all
            the way to Erase my data — eleven of them, no grouping, so finding
            "Primary currency" meant reading the whole list. They now sit in
            named groups, one card each: Look, Shelf, Data, Learn. The section
            label was already in the file (.cz-profile-label, used twice); this
            just uses it everywhere it was needed. */}
        {full ? (
        <>
        <div className="cz-profile-label">Look &amp; fit</div>
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
        <div className="cz-profile-group">
        <button type="button" className="cz-profile-row" onClick={onOpenSizes}>
          <span>Sizes and measurements</span>
          <span className="cz-profile-row-val">Tops, bottoms, shoes, and body ›</span>
        </button>
        <button type="button" className="cz-profile-row" onClick={onOpenFitPrefs}>
          <span>Fit preferences</span>
          <span className="cz-profile-row-val">Length & looseness ›</span>
        </button>
        </div>
        </>
        ) : null}
        {/* CH-03: the phone masthead lost its ⋯ button, so the avatar menu is
            the only route to the look-and-fit sheet. Phone only — desktop
            (full=true) keeps every row inline above. */}
        {!full && onOpenSettings ? (
        <>
        <div className="cz-profile-label">Look &amp; fit</div>
        <div className="cz-profile-group">
        <button type="button" className="cz-profile-row" onClick={onOpenSettings}>
          <span>Settings</span>
          <span className="cz-profile-row-val">Theme, sizes, and fit ›</span>
        </button>
        </div>
        </>
        ) : null}
        <div className="cz-profile-label">Your shelf</div>
        <div className="cz-profile-group">
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
        </div>
        <div className="cz-profile-label">Your data</div>
        <div className="cz-profile-group">
        <button type="button" className="cz-profile-row" onClick={onOpenImport}>
          <span>Import &amp; backup</span>
          <span className="cz-profile-row-val">›</span>
        </button>
        {/* LB-8. Signed in only: the links live on the server, so a signed-out
            person has none and the row would open an empty page. The share
            sheet's fine print names this row by name — do not rename it
            without changing that sentence too. */}
        {accountEnabled && accountSession && onOpenSharedLinks ? (
          <button type="button" className="cz-profile-row" onClick={onOpenSharedLinks}>
            <span>Shared links</span>
            <span className="cz-profile-row-val">Manage ›</span>
          </button>
        ) : null}
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
        <button type="button" className="cz-profile-row cz-profile-danger" onClick={onEraseData}>
          <span>Erase my data</span>
          <span className="cz-profile-row-val">Deletes everything ›</span>
        </button>
        </div>
        {/* LB-50. The site had twenty-one pages and the app linked to three of
            them. Every static page carries the full nav; the app carried
            Privacy, Terms, and a mailto. So a person inside the product could
            not reach How it works, the guides, or the price table without
            typing a URL, and Support was an empty compose window instead of the
            page that answers "how do I cancel Pro".

            These are real navigations out of a single-page app, so they open in
            a new tab. A same-tab jump would drop an unsaved sheet and make Back
            the only way home. */}
        <div className="cz-profile-label">Learn</div>
        <div className="cz-profile-group">
        {SITE_LINKS.map(([href, label, val]) => (
          <a
            key={href}
            className="cz-profile-row cz-profile-row-link"
            href={href}
            target="_blank"
            rel="noreferrer"
          >
            <span>{label}</span>
            <span className="cz-profile-row-val">{val} ↗</span>
          </a>
        ))}
        </div>
        <div className="cz-profile-legal">
          <a className="cz-profile-legal-link" href="/privacy/" target="_blank" rel="noreferrer">
            Privacy
          </a>
          <a className="cz-profile-legal-link" href="/terms/" target="_blank" rel="noreferrer">
            Terms
          </a>
          <a className="cz-profile-legal-link" href="mailto:wenselllc@gmail.com">
            Email us
          </a>
        </div>
      </div>
    </ModalShell>
  );
}
