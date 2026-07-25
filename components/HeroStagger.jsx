import { useEffect, useState } from "react";

// Empty-shelf hero with the transitions.dev staggered text reveal. is-shown
// lands one frame after mount so the entrance transition actually plays.
// Copy: design handoff 4 §10 / 7a (no em dash; names all sources).
export default function HeroStagger() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <div className={"t-stagger" + (shown ? " is-shown" : "")}>
      <p className="cz-hero-title cz-title-balance t-stagger-line t-stagger-line--1">
        One shelf for the whole haul.
      </p>
      <p
        className="cz-tagline t-stagger-line t-stagger-line--2"
        style={{ fontSize: 15, color: "var(--cz-sub)", marginBottom: 22, lineHeight: 1.55 }}
      >
        Drop in a Weidian, Taobao or Yupoo link, a Reddit haul post, even a comment. Price, photos and your size land on the card.
      </p>
    </div>
  );
}
