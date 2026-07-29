import { useEffect, useRef } from "react";
import BrandMark from "../components/BrandMark.jsx";
import SettingsContext from "./SettingsContext.jsx";
import SettingsNav, { SETTINGS_SECTIONS } from "./SettingsNav.jsx";
import AccountPlanSection from "./AccountPlanSection.jsx";
import SizesSection from "./SizesSection.jsx";
import FitPrefsSection from "./FitPrefsSection.jsx";
import ShelfDefaultsSection from "./ShelfDefaultsSection.jsx";
import YourDataSection from "./YourDataSection.jsx";
import AboutSupportSection from "./AboutSupportSection.jsx";

// SettingsPage: the routed settings surface (design: "anything with a back
// button, a form, or a destructive action gets a URL"). It renders
// full-screen over the shelf. Desktop gets the 236px rail plus a content
// pane; the phone gets a full-screen list that pushes to a full-screen
// section.
//
// Routing lives in credenza-fashion.jsx: `section` is the current URL's
// section key (null on the phone's list view), onNavigate pushes
// /settings/<section>, onClose returns to the shelf. This component only
// renders what it is told.

// All six sections are real (Phase 4). Sizes and Fit reuse the editors the
// old sheet stack embedded; Shelf defaults is read-only by design (1e);
// About and support took the site links from the deleted Profile sheet.
const SECTION_BODY = {
  account: AccountPlanSection,
  sizes: SizesSection,
  fit: FitPrefsSection,
  shelf: ShelfDefaultsSection,
  data: YourDataSection,
  about: AboutSupportSection,
};

export default function SettingsPage({ section, onNavigate, onClose, value, isPhone }) {
  // The open card is a native <dialog>, and a native dialog paints above every
  // ordinary element whatever the z-index says. As a plain panel this page
  // drew UNDERNEATH it, so a tap on a setting landed on the right section but
  // behind the blurred card (Kyle 2026-07-28: "it'll take you there in the
  // background with it blurred out"). A dialog of its own joins the same layer
  // and, opening last, sits on top. The card stays mounted, so Back returns to
  // it. `cancel` is blocked because Escape is handled below — the browser's own
  // close would remove the page without telling the app.
  const dialogRef = useRef(null);
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

  // Escape closes the page, same contract as the sheets it replaces.
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

  // The page is fixed over the shelf; stop the shelf scrolling under it.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const active = SETTINGS_SECTIONS.find((s) => s.key === section) || null;
  const Body = active ? SECTION_BODY[active.key] : null;
  // Phone with no section picked: the list IS the page. Desktop always has
  // a section (the router defaults to account).
  const showList = isPhone && !active;

  return (
    <SettingsContext.Provider value={value}>
      <dialog ref={dialogRef} className="cz-settings-page" aria-label="Settings">
        <header className="cz-settings-page-masthead">
          <button type="button" className="cz-settings-back" onClick={onClose}>
            <span aria-hidden="true">←</span> Back to the shelf
          </button>
          <span className="cz-settings-page-brand">
            <BrandMark size={20} />
            <span className="cz-settings-page-title">Settings</span>
          </span>
        </header>
        <div className="cz-settings-page-layout">
          {!isPhone ? (
            <SettingsNav active={active ? active.key : null} onSelect={onNavigate} />
          ) : null}
          <main className="cz-settings-content">
            {showList ? (
              <SettingsNav active={null} onSelect={onNavigate} />
            ) : active ? (
              <>
                {isPhone ? (
                  <button
                    type="button"
                    className="cz-settings-back cz-settings-back-section"
                    onClick={() => onNavigate(null)}
                  >
                    <span aria-hidden="true">←</span> Settings
                  </button>
                ) : null}
                {Body ? <Body /> : null}
              </>
            ) : null}
          </main>
        </div>
      </dialog>
    </SettingsContext.Provider>
  );
}
