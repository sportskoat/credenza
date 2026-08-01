import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import SettingsContext from "./SettingsContext.jsx";
import SettingsNav, { SETTINGS_SECTIONS } from "./SettingsNav.jsx";
import AccountPlanSection from "./AccountPlanSection.jsx";
import SizesSection from "./SizesSection.jsx";
import ShelfDefaultsSection from "./ShelfDefaultsSection.jsx";
import YourDataSection from "./YourDataSection.jsx";
import AboutSupportSection from "./AboutSupportSection.jsx";

// One scrolling settings page (design handoff 2026-08-01). Five sections live
// in one column. The rail smooth-scrolls and tracks the active section.
// Fit preferences folds into Sizes — the old /settings/fit URL maps to sizes.
//
// `section` still comes from the URL for deep links. Clicking the rail and
// scrolling both keep the URL and the highlight in sync.

const SECTION_BODY = {
  account: AccountPlanSection,
  sizes: SizesSection,
  shelf: ShelfDefaultsSection,
  data: YourDataSection,
  about: AboutSupportSection,
};

const VALID_KEYS = new Set(SETTINGS_SECTIONS.map((s) => s.key));
// Space above a deep-linked section so the green kicker is not cut off.
// Matches scroll-margin-top on .cz-settings-section-anchor.
const SECTION_SCROLL_LEAD = 28;
const FIRST_SECTION_KEY = SETTINGS_SECTIONS[0].key;

function normalizeSection(key) {
  if (key === "fit") return "sizes";
  if (key && VALID_KEYS.has(key)) return key;
  return "account";
}

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

// Scroll offset for a section inside the content column. Use the scroller's
// own box — el.offsetTop is relative to the dialog (masthead + pad), so it
// overshoots and clips the kicker.
function sectionScrollTop(scroller, el, lead = SECTION_SCROLL_LEAD) {
  const delta =
    el.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
  return Math.max(0, scroller.scrollTop + delta - lead);
}

export default function SettingsPage({ section, onNavigate, onClose, value, isPhone }) {
  const dialogRef = useRef(null);
  const scrollerRef = useRef(null);
  const sectionEls = useRef({});
  // Suppress scroll-spy while a click-driven scroll is in flight.
  const scrollLock = useRef(false);
  // First open must scroll for a non-first deep link even when active is
  // already seeded from the URL (otherwise /settings/sizes stays at 0).
  const didInitialScroll = useRef(false);
  const [active, setActive] = useState(() => normalizeSection(section));

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    const onCancel = (e) => e.preventDefault();
    if (dialog) dialog.addEventListener("cancel", onCancel);
    return () => {
      if (dialog) dialog.removeEventListener("cancel", onCancel);
      if (dialog && dialog.open) dialog.close();
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const scrollToSection = useCallback(
    (key, { updateUrl = true } = {}) => {
      const target = normalizeSection(key);
      const el = sectionEls.current[target];
      const scroller = scrollerRef.current;
      if (!el || !scroller) {
        setActive(target);
        if (updateUrl && onNavigate) onNavigate(target);
        return;
      }
      scrollLock.current = true;
      setActive(target);
      if (updateUrl && onNavigate) onNavigate(target);
      const top = sectionScrollTop(scroller, el);
      scroller.scrollTo({
        top,
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
      window.setTimeout(() => {
        scrollLock.current = false;
      }, prefersReducedMotion() ? 50 : 450);
    },
    [onNavigate]
  );

  // Deep link / external navigation: jump to the requested section.
  useEffect(() => {
    const target = normalizeSection(section);
    // Wait a frame so section refs exist after paint.
    const jump = () => scrollToSection(target, { updateUrl: false });
    // First mount: active is initialized from `section`, so target === active
    // would otherwise skip a later-section deep link and leave scrollTop 0.
    // The first section is already at the top — do not scroll it (a forced
    // jump clips the green kicker into the title below).
    if (!didInitialScroll.current) {
      didInitialScroll.current = true;
      if (target === FIRST_SECTION_KEY) return;
      requestAnimationFrame(jump);
      return;
    }
    if (target === active && !section) return;
    if (target !== active) {
      requestAnimationFrame(jump);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to section prop
  }, [section]);

  // Scroll-spy: last section whose top is within 60px of the scroller top.
  // Must use sectionScrollTop (same box as click/deep-link), not el.offsetTop
  // against the dialog — mixed frames flip the rail back to Account after a
  // sizes deep link settles.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const onScroll = () => {
      if (scrollLock.current) return;
      const threshold = scroller.scrollTop + 60;
      let current = SETTINGS_SECTIONS[0].key;
      for (const { key } of SETTINGS_SECTIONS) {
        const el = sectionEls.current[key];
        if (!el) continue;
        if (sectionScrollTop(scroller, el, 0) <= threshold) current = key;
      }
      setActive((prev) => {
        if (prev === current) return prev;
        if (onNavigate) onNavigate(current);
        return current;
      });
    };
    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, [onNavigate]);

  const bindSection = (key) => (el) => {
    if (el) sectionEls.current[key] = el;
    else delete sectionEls.current[key];
  };

  return (
    <SettingsContext.Provider value={value}>
      <dialog ref={dialogRef} className="cz-settings-page" aria-label="Settings">
        <header className="cz-settings-page-masthead">
          <button type="button" className="cz-settings-back" onClick={onClose}>
            <ArrowLeft size={15} strokeWidth={2.2} aria-hidden="true" />
            Back to the shelf
          </button>
          <span className="cz-settings-page-wordmark">CREDENZA</span>
          <span className="cz-settings-page-title">Settings</span>
        </header>
        <div className="cz-settings-page-layout">
          {!isPhone ? (
            <SettingsNav active={active} onSelect={(key) => scrollToSection(key)} />
          ) : null}
          <main ref={scrollerRef} className="cz-settings-content">
            <div className="cz-settings-column">
              {SETTINGS_SECTIONS.map(({ key }) => {
                const Body = SECTION_BODY[key];
                return (
                  <div key={key} ref={bindSection(key)} className="cz-settings-section-anchor">
                    {Body ? <Body /> : null}
                  </div>
                );
              })}
            </div>
          </main>
        </div>
      </dialog>
    </SettingsContext.Provider>
  );
}
