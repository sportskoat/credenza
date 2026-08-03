import { useState } from "react";
import { Pill } from "../credenza-fashion.jsx";

// Shared Google + magic-link form (Part 7e). Used by the dedicated Sign-in
// page. No password path — Supabase email OTP + Google OAuth only.
// Username/password is a separate product decision (Kyle 2026-08-03).

export default function SignInForm({
  accountEnabled = true,
  onMagicLink,
  onGoogle,
  // Optional: fire after a magic link is sent so a parent can keep the page open
  // with the "check your email" state visible.
  compact = false,
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(""); // "link" | "google"
  const [error, setError] = useState("");
  const [linkSent, setLinkSent] = useState(false);

  const run = async (key, fn) => {
    if (busy) return;
    setBusy(key);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(err && err.message ? String(err.message) : "Something went wrong. Try again.");
    } finally {
      setBusy("");
    }
  };

  if (!accountEnabled) {
    return (
      <div className="cz-profile-signin is-off">
        <div className="cz-profile-signin-title">Accounts are off in this build</div>
        <div className="cz-profile-signin-sub">
          This copy of Credenza has no sign-in server, so there is nothing to
          sign in to. Your shelf works exactly the same and stays on this
          device. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to turn
          accounts back on.
        </div>
      </div>
    );
  }

  return (
    <div className={"cz-profile-signin" + (compact ? " is-compact" : "")}>
      {!compact ? (
        <>
          <div className="cz-profile-signin-title">Sign in to Credenza</div>
          <div className="cz-profile-signin-sub">
            An account keeps your shelf and limits in sync across devices. Your
            shelf stays on this device either way. No password — use Google, or
            a one-time link to your email.
          </div>
        </>
      ) : null}
      {linkSent ? (
        <div className="cz-profile-signin-sent" role="status">
          Check your email. The link signs you in. It works on this device only.
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
          <div className="cz-profile-signin-or" aria-hidden="true">
            or
          </div>
          <Pill
            style={{ width: "100%", minHeight: 50, borderRadius: 15 }}
            disabled={!!busy}
            onClick={() => run("google", onGoogle)}
          >
            {busy === "google" ? "Opening Google…" : "Continue with Google"}
          </Pill>
        </>
      )}
      {error ? (
        <div className="cz-profile-signin-error" role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
}
