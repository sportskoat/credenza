import { useCallback, useEffect, useLayoutEffect, useRef } from "react";

// One measured indicator for every compact single-choice bar. The first
// position and resize corrections snap into place; value changes slide.
export default function SlidingTabsPill({ value }) {
  const pillRef = useRef(null);
  const valueRef = useRef(value);
  const readyRef = useRef(false);
  valueRef.current = value;

  const moveToActive = useCallback((animate) => {
    const pill = pillRef.current;
    const bar = pill && pill.parentElement;
    if (!pill || !bar) return;
    const active = [...bar.children].find(
      (node) => node.dataset && node.dataset.tTabValue === String(valueRef.current)
    );
    if (!active) {
      pill.style.width = "0";
      return;
    }

    if (!animate) {
      const previous = pill.style.transition;
      pill.style.transition = "none";
      pill.style.transform = `translateX(${active.offsetLeft}px)`;
      pill.style.width = `${active.offsetWidth}px`;
      void pill.offsetWidth;
      pill.style.transition = previous;
      return;
    }

    pill.style.transform = `translateX(${active.offsetLeft}px)`;
    pill.style.width = `${active.offsetWidth}px`;
  }, []);

  useLayoutEffect(() => {
    moveToActive(readyRef.current);
    readyRef.current = true;
  }, [moveToActive, value]);

  useEffect(() => {
    const pill = pillRef.current;
    const bar = pill && pill.parentElement;
    if (!bar) return undefined;
    const snap = () => moveToActive(false);
    window.addEventListener("resize", snap);
    const observer = window.ResizeObserver ? new window.ResizeObserver(snap) : null;
    if (observer) observer.observe(bar);
    return () => {
      window.removeEventListener("resize", snap);
      if (observer) observer.disconnect();
    };
  }, [moveToActive]);

  return <span ref={pillRef} className="t-tabs-pill" aria-hidden="true" />;
}
