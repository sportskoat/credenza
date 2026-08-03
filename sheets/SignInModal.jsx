import { useEffect, useState } from "react";
import { ModalShell } from "../credenza-fashion.jsx";
import BrandMark from "../components/BrandMark.jsx";
import { Field, Pill } from "../components/atoms.jsx";
import { PLAN_COPY } from "../components/plans.js";
import { AUTH_MISSING_MESSAGE, signInWith } from "../preview/src/auth.js";
import { rememberIntent } from "../components/sign-in-intent.js";

// ═══════════════════════════════════════════════════════════════════════════
// SignInModal — sign-in handoff README, screen 2.
//
// A modal, never a route. It opens from the cap modal, the account menu,
// Settings, a shared link and the Chrome extension. A route would throw away
// wherever the person was standing.
//
// Two hard rules from the README, both worth restating because both are easy
// to break later:
//
//   NO PRICE ON THIS SURFACE. Arriving from the Pro card returns to Pro
//   afterwards. Sign-in never becomes the checkout.
//
//   NO "CREATE ACCOUNT" TAB. A magic link makes signing in and signing up the
//   same act, so a second tab would be a tab that does nothing.
//
// The body copy is read from PLAN_COPY, not typed here. The cap modal, this
// modal and the Settings signed-out state all promise the same number, and
// PLAN_COPY is the one place that number lives.
// ═══════════════════════════════════════════════════════════════════════════

// README: "Disabled until the value matches /.+@.+\..+/". This gates the
// button and nothing else. There is no inline error while the person types:
// telling someone their half-typed address is wrong is a rebuke, not help.
const EMAIL_SHAPE = /.+@.+\..+/;

// Flat, one line, no stack trace. Credenza's voice: no exclamation mark and
// no "Oops".
const READ_FAILED = "Couldn't read that address.";

function OrDivider() {
  return (
    <div className="cz-signin-or" aria-hidden="true">
      <span className="cz-signin-or-rule" />
      <span className="cz-signin-or-word">OR</span>
      <span className="cz-signin-or-rule" />
    </div>
  );
}

/**
 * @param {object} props
 * @param {() => void} props.onClose
 * @param {{kind: string, returnTo?: string, payload?: object}} [props.intent]
 *   Where sign-in came from and what the person was reaching for. Recorded
 *   before anything navigates, because Google, Apple and the mail app all
 *   leave the page.
 * @param {function} [props.signIn] - injected in tests, never in the app.
 */
export default function SignInModal({ onClose, intent = null, signIn = signInWith }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  // Record the return intent on open, not on submit. An OAuth button navigates
  // away in the same tick it is pressed, and a magic link can be opened hours
  // later on another device.
  useEffect(() => {
    if (intent) rememberIntent(intent);
  }, [intent]);

  const valid = EMAIL_SHAPE.test(email);

  async function run(method) {
    if (busy) return;
    setBusy(method);
    setError("");
    try {
      const result = await signIn(method, { email });
      if (result && result.redirect) {
        window.location.assign(result.redirect);
        return;
      }
      setSentTo(email);
      setSent(true);
    } catch (err) {
      // A build with no provider keys says so plainly. Anything else is the
      // server refusing the address.
      const message = err && err.message === AUTH_MISSING_MESSAGE ? AUTH_MISSING_MESSAGE : READ_FAILED;
      setError(message);
    } finally {
      setBusy("");
    }
  }

  function useAnotherAddress() {
    setSent(false);
    setSentTo("");
    setEmail("");
    setError("");
  }

  return (
    <ModalShell
      // The dialog names itself with the heading the person is looking at.
      title={sent ? "Check your email." : "Sign in to Credenza."}
      onClose={onClose}
      maxWidth={460}
      bareHeader
      surfaceClassName="cz-signin-modal"
    >
      <div className="cz-signin">
        {sent ? (
          <>
            <p className="cz-signin-kicker is-money">LINK SENT</p>
            <h2 className="cz-signin-head">Check your email.</h2>
            <p className="cz-signin-body">
              We sent a sign-in link to <span className="cz-signin-address">{sentTo}</span>. It works
              once and expires in 15 minutes.
            </p>
            <hr className="cz-signin-rule" />
            <p className="cz-signin-note">
              Nothing was sent to the browser you opened it in. Open the link on any device and this
              shelf signs in.
            </p>
            <div className="cz-signin-actions is-sent">
              <Pill onClick={useAnotherAddress} style={{ width: "100%" }}>
                Use another address
              </Pill>
              <Pill
                subtle
                loading={busy === "email"}
                onClick={() => {
                  setEmail(sentTo);
                  run("email");
                }}
                style={{ width: "100%" }}
              >
                Resend
              </Pill>
            </div>
            {error ? <p className="cz-signin-error">{error}</p> : null}
          </>
        ) : (
          <>
            <div className="cz-signin-lockup">
              <BrandMark size={30} />
              <span className="cz-signin-wordmark">CREDENZA</span>
            </div>
            <h2 className="cz-signin-head">Sign in to Credenza.</h2>
            <p className="cz-signin-body">{PLAN_COPY.signInBody}</p>
            <form
              className="cz-signin-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (valid) run("email");
              }}
            >
              <Field
                label="Email"
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
              />
              <Pill
                primary
                disabled={!valid}
                loading={busy === "email"}
                onClick={() => run("email")}
                style={{ width: "100%" }}
              >
                Email me a sign-in link.
              </Pill>
            </form>
            <OrDivider />
            {/* Kyle 2026-08-02: Apple is parked. Credenza has no Apple
                developer account yet, so the button led nowhere. The provider
                stays wired in auth.js, ready to come back. */}
            <div className="cz-signin-oauth">
              <Pill loading={busy === "google"} onClick={() => run("google")} style={{ width: "100%" }}>
                Continue with Google
              </Pill>
            </div>
            {error ? <p className="cz-signin-error">{error}</p> : null}
            <p className="cz-signin-foot">
              No password, ever. Nothing on your shelf is uploaded until you ask for sync.
            </p>
          </>
        )}
      </div>
    </ModalShell>
  );
}
