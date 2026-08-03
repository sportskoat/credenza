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

// Brand marks for the OAuth buttons. Inline SVG, no asset fetch, no emoji.
function GoogleLogo() {
  return (
    <svg className="cz-signin-oauth-logo" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

function DiscordLogo() {
  return (
    <svg className="cz-signin-oauth-logo" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#5865F2"
        d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z"
      />
    </svg>
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
                <GoogleLogo />
                Continue with Google
              </Pill>
              {/* Kyle 2026-08-03: Discord joins Google. The provider list in
                  auth.js is the door — this button is its pair. */}
              <Pill loading={busy === "discord"} onClick={() => run("discord")} style={{ width: "100%" }}>
                <DiscordLogo />
                Continue with Discord
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
