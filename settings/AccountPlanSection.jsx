import { useState } from "react";
import { Pill } from "../credenza-fashion.jsx";
import { PLAN_CAPS, usageTotal, usageAudience } from "../preview/src/usage.js";
import { PLAN_COPY } from "../components/plans.js";
import { useSettings } from "./SettingsContext.jsx";
import SettingsSection from "./SettingsSection.jsx";

// ═══════════════════════════════════════════════════════════════════════════
// Account and plan — sign-in handoff README, screen 4.
//
// "Report where the user stands and provide the door. No form, no price
// table." The old pane held both: an email field with a Google button, a
// billing switch, two price cards and an eight-row caps table. All of that
// now lives on two surfaces of its own — the sign-in modal (screen 2) and
// the /upgrade route (screen 3). This pane only reports and links.
//
// Every number is a projection, never a stored copy:
//   - The signed-out counter reads `limits`, which the app re-computes on
//     every spent read.
//   - The signed-in counters read usageToday() against PLAN_CAPS at render.
//     limitStatus() returns null for a Pro member, so Pro cannot use it.
//
// README deviations, for the morning report:
//   1. The README's 4a body says an account "makes the shelf unlimited".
//      The Kyle 2026-08-02 ruling forbids the word: a free account adds 8
//      cards and 8 chart reads, and the allowance never resets.
//      PLAN_COPY.settingsSignedOutBody is the corrected sentence and this
//      pane uses it.
//   2. The README's 4a Allowance row says "0 of 2 chart reads" for a
//      signed-out person. 2 was the signed-in free cap; a signed-out device
//      has its own allowance. The row prints the card counter only.
//   3. "renews 9 Aug" and the whole "2 devices · kept in step" row are
//      dropped. The signed entitlement the browser holds carries only
//      { sub, plan, state, lim, exp, graceUntil }. Neither the renewal date
//      nor a device count reaches this device, and a made-up date next to a
//      price is a false statement to someone who is paying.
//   4. Two rows the README does not draw survive here, because no other
//      surface offers them: "Restore purchase" and "Delete account".
// ═══════════════════════════════════════════════════════════════════════════

// One row of the standing group. The action sits on the right; the flag is
// the mono chip that stands in for an action on a row that has none.
//
// Kyle 2026-08-03 audit, finding 5: the failure line used to sit at the foot
// of the whole pane, after every row. Sign out failed and the red words
// appeared beside "Delete account", which is a frightening place to read them.
// A row now carries its own failure, so the message sits under the button that
// caused it and under no other.
function StandingRow({ title, value, mono, pill, action, flag, error }) {
  return (
    <div className={"cz-plan-standing-row" + (error ? " has-error" : "")}>
      <div className="cz-plan-standing-main">
        <div className="cz-plan-standing-title">
          {title}
          {pill ? <span className="cz-plan-pro-pill">{pill}</span> : null}
        </div>
        <div className={"cz-plan-standing-value" + (mono ? " is-mono" : "")}>{value}</div>
      </div>
      {action ? <div className="cz-plan-standing-action">{action}</div> : null}
      {flag ? <span className="cz-plan-flag">{flag}</span> : null}
      {error ? (
        <div className="cz-plan-standing-error" role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
}

export default function AccountPlanSection() {
  const {
    accountEnabled,
    accountSession,
    accountPlan,
    limits,
    onSignIn,
    onOpenUpgrade,
    onPortal,
    onSignOut,
    onDeleteAccount,
    onRestorePurchase,
  } = useSettings();

  const [busy, setBusy] = useState(""); // "portal" | "restore" | "signout" | "delete"
  // Finding 5: the message travels with the key of the button that raised it.
  // run() already knows the key, so the pairing costs nothing and it is the
  // only way a row can tell its own failure from another row's.
  const [failure, setFailure] = useState(null); // { key, message } | null
  // Delete account is two-tap: the first tap arms it, the second sends it.
  const [deleteArmed, setDeleteArmed] = useState(false);

  // Read the message for one row. Every other row reads null and prints nothing.
  const errorFor = (key) => (failure && failure.key === key ? failure.message : "");

  const run = async (key, fn) => {
    if (busy) return;
    setBusy(key);
    setFailure(null);
    try {
      await fn();
    } catch (err) {
      setFailure({
        key,
        message: err && err.message ? String(err.message) : "Something went wrong. Try again.",
      });
    } finally {
      setBusy("");
    }
  };

  const planState = accountPlan && accountPlan.state ? accountPlan.state : "free";
  const isOwner = planState === "owner";
  const isPro = planState === "pro" || planState === "grace" || isOwner;
  const signedIn = accountEnabled && !!accountSession;
  const email = (signedIn && accountSession.user && accountSession.user.email) || "";

  // The Allowance line. Read at render, so a card resolved a second ago
  // already shows here. usageTick in the app re-renders this tree on every
  // spend. Free counters are lifetime and never reset; Pro counters are
  // monthly. limitStatus() returns null for a Pro member, so Pro reads the
  // live usage against PLAN_CAPS.pro instead of `limits`.
  const caps = isPro ? PLAN_CAPS.pro : PLAN_CAPS.free;
  const audience = usageAudience(accountPlan, signedIn);
  // Kyle 2026-08-04: the owner saw "0 of 50 chart reads · PRO CAPS" and read
  // it as a wall. An owner has no counters at all — say so, in the row's own
  // words, and never print a cap against this plan.
  const todayOwner = "Open · no caps, nothing is counted";
  const todaySignedIn = isPro
    ? usageTotal("chartVision", { audience }) + " of " + caps.chartVisionPerMonth + " chart reads · " +
      usageTotal("resolve", { audience }) + " of " + caps.resolvePerMonth + " cards this month"
    : usageTotal("chartVision", { audience }) + " of " + caps.chartVisionTotal + " chart reads · " +
      usageTotal("resolve", { audience }) + " of " + caps.resolveTotal + " cards · they never reset";
  const todaySignedOut = limits
    ? limits.cap - limits.left + " of " + limits.cap + " cards · they never reset"
    : "Counted on this device · the allowance never resets";

  const heading = !signedIn
    ? "You are signed out."
    : isOwner
      ? "Signed in. Owner access is on."
      : isPro
        ? "Signed in. Pro is on."
        : "Signed in. You are on Free.";

  const body = signedIn
    ? // Kyle 2026-08-03: one promise about the shelf, in one voice. The old
      // "on a new phone" wording is gone from every plan surface.
      isOwner
      ? "Owner access never expires. Every counter is open and Credenza keeps a spare copy of your shelf."
      : isPro
        ? "Pro is on for this account. Your monthly counters are raised and Credenza keeps a spare copy of your shelf."
        : "Your account is free. It adds " + PLAN_CAPS.free.resolveTotal +
          " cards and " + PLAN_CAPS.free.chartVisionTotal +
          " chart reads, and the allowance never resets."
    : PLAN_COPY.settingsSignedOutBody;

  return (
    <SettingsSection
      kicker="ACCOUNT AND PLAN"
      title={heading}
      sectionId="account"
      lead={body}
    >
      {/* Accounts off = SAY so (same rule as the old profile sheet: a build
          with no Supabase keys must not silently lose the account UI). */}
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

      {accountEnabled && (
        <div className={"cz-plan-standing" + (signedIn ? " is-tight" : "")}>
          {signedIn ? (
            <StandingRow
              title="Account"
              value={email || "Signed in"}
              mono={!!email}
              action={
                <Pill subtle disabled={!!busy} onClick={() => run("signout", onSignOut)}>
                  {busy === "signout" ? "Signing out…" : "Sign out"}
                </Pill>
              }
              error={errorFor("signout")}
            />
          ) : (
            <StandingRow
              title="Account"
              value="Signed out · this device only"
              action={
                <Pill primary onClick={() => onSignIn()}>
                  Sign in
                </Pill>
              }
            />
          )}

          {/* A Pro member has nothing left to buy, so the upgrade door goes
              and the billing door takes its place. An owner has no billing
              at all: the access is permanent and no subscription exists. */}
          {isOwner ? (
            <StandingRow title="Plan" pill="OWNER" value="Owner · permanent full access" />
          ) : isPro ? (
            <StandingRow
              title="Plan"
              pill="PRO"
              value={
                planState === "grace"
                  ? "Pro · a payment did not go through"
                  : "Pro · billed through Stripe · cancel any time"
              }
              action={
                <Pill disabled={!!busy} onClick={() => run("portal", onPortal)}>
                  {busy === "portal" ? "Opening…" : "Manage billing"}
                </Pill>
              }
              error={errorFor("portal")}
            />
          ) : (
            <StandingRow
              title="Plan"
              value="Free · $0"
              action={
                <Pill onClick={() => onOpenUpgrade()}>See what Pro changes</Pill>
              }
            />
          )}

          <StandingRow
            title="Allowance"
            value={signedIn ? (isOwner ? todayOwner : todaySignedIn) : todaySignedOut}
            flag={!signedIn ? "LOCAL" : isOwner ? "OWNER" : isPro ? "PRO CAPS" : "FREE CAPS"}
          />

          {/* Not in the README. It stays because a person who paid on another
              device has no other way to make this one notice. */}
          {signedIn && !isPro && (
            <StandingRow
              title="Purchases"
              value="Paid already on another device?"
              action={
                <Pill subtle disabled={!!busy} onClick={() => run("restore", onRestorePurchase)}>
                  {busy === "restore" ? "Checking…" : "Restore purchase"}
                </Pill>
              }
              error={errorFor("restore")}
            />
          )}

          {/* Not in the README either. Deleting the account is the only door
              that no other pane holds. Your data holds the local erase. */}
          {signedIn && (
            <StandingRow
              title="Delete your account"
              value={
                deleteArmed
                  ? "No undo. Your shelf stays on this device."
                  : "Removes the sync copy, not the local one."
              }
              action={
                <Pill
                  subtle
                  disabled={!!busy}
                  onClick={() => {
                    if (!deleteArmed) {
                      setDeleteArmed(true);
                      setFailure(null);
                      return;
                    }
                    run("delete", onDeleteAccount);
                  }}
                >
                  {busy === "delete"
                    ? "Deleting…"
                    : deleteArmed
                      ? "Tap again to delete your account"
                      : "Delete account"}
                </Pill>
              }
              error={errorFor("delete")}
            />
          )}
        </div>
      )}

      {/* Finding 5: the failure line used to render here, at the foot of the
          pane and after every row. It now renders inside the row that raised
          it, so a person reads it under the button they pressed. */}

      {accountEnabled && (
        <p className="cz-plan-standing-note">
          {isPro && !isOwner && signedIn
            ? "Manage billing opens the Stripe portal. Credenza never sees your card number."
            : "Two rows and a counter. The sign-in form and the price table used to sit here; both moved to their own surface and this page links to them."}
        </p>
      )}
    </SettingsSection>
  );
}
