import { useEffect, useState } from "react";

// Empty-shelf hero with the transitions.dev staggered text reveal. is-shown
// lands one frame after mount so the entrance transition actually plays.
//
// The headline used to be "One shelf for the whole haul." That slogan moved to
// the landing page (hero spec, Kyle 2026-07-26), where a first-time visitor
// still needs the pitch. A person who already opened the app does not — they
// need to know what to do next. The app now gives the instruction and the site
// keeps the promise, so neither surface repeats the other.
export default function HeroStagger() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className={"t-stagger" + (shown ? " is-shown" : "")}>
      <p className="cz-hero-title cz-title-balance t-stagger-line t-stagger-line--1">
        Start with one link.
      </p>
      {/* Sizes live in .cz-empty-hero .cz-tagline now, not in a style prop —
          the phone step needs its own size and an inline style cannot carry a
          media query. */}
      <p className="cz-tagline t-stagger-line t-stagger-line--2">
        Paste a Weidian, Taobao, Yupoo or Reddit link. The card fills in the rest.
      </p>
    </div>
  );
}
