// A0 · Arrival — the three-step intro strip under the paste bar.
// Onboarding handoff README, "A0 · Arrival". A visitor arrives cold from a
// Reddit thread. The strip says what pasting one link buys them, in three
// numbered lines, and then gets out of the way for good.
//
// Copy is verbatim from the README copy deck. Do not paraphrase.
// Dismissal is permanent: onboarding.introDismissed in localStorage.
import { X } from "lucide-react";

/** The three numbered rows, in order. Verbatim from the README. */
export const INTRO_STRIP_STEPS = [
  "Paste one seller link.",
  "We read that seller's size chart.",
  "You get the size that fits you.",
];

export const INTRO_STRIP_KICKER = "FROM REDDIT · HERE IS THE TRICK";
export const INTRO_STRIP_FOOTER =
  "Two taps on the first card is all we ask for. No tape, no account.";

export default function IntroStrip({ onDismiss }) {
  return (
    <section className="cz-intro-strip" aria-label="How Credenza works">
      <div className="cz-intro-strip-kicker-row">
        <span className="cz-intro-strip-kicker">{INTRO_STRIP_KICKER}</span>
        <button
          type="button"
          className="cz-intro-strip-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          <X aria-hidden="true" size={14} strokeWidth={2.2} />
        </button>
      </div>
      <ol className="cz-intro-strip-steps">
        {INTRO_STRIP_STEPS.map((step, i) => (
          <li className="cz-intro-strip-step" key={step}>
            <span className="cz-intro-strip-num" aria-hidden="true">
              {i + 1}
            </span>
            <span className="cz-intro-strip-label">{step}</span>
          </li>
        ))}
      </ol>
      <p className="cz-intro-strip-foot">{INTRO_STRIP_FOOTER}</p>
    </section>
  );
}
