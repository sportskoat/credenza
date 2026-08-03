import { useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import SignInForm from "./SignInForm.jsx";

// Dedicated full-screen (phone) / floating card (desktop) sign-in view.
// Kyle 2026-08-03: sign-in must not live buried in Settings → Account/Plan.
// Same two auth methods as Part 7e (Google + magic link). No password path.
// Shell mirrors SettingsPage (native <dialog>, same masthead/back pattern).

export default function SignInPage({
  accountEnabled = true,
  onMagicLink,
  onGoogle,
  onClose,
}) {
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

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdrop click-to-close; Escape closes via key handler
    <dialog
      ref={dialogRef}
      className="cz-settings-page cz-signin-page"
      aria-label="Sign in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <header className="cz-settings-page-masthead">
        <button type="button" className="cz-settings-back" onClick={onClose}>
          <ArrowLeft size={15} strokeWidth={2.2} aria-hidden="true" />
          Back to the shelf
        </button>
        <span className="cz-settings-page-wordmark">CREDENZA</span>
        <span className="cz-settings-page-title">Sign in</span>
      </header>
      <div className="cz-signin-page-body">
        <div className="cz-signin-page-card">
          <h1 className="cz-signin-page-heading">Welcome back</h1>
          <p className="cz-signin-page-lead">
            Sign in or create an account. Same screen either way — no password
            to set.
          </p>
          <SignInForm
            accountEnabled={accountEnabled}
            onMagicLink={onMagicLink}
            onGoogle={onGoogle}
          />
        </div>
      </div>
    </dialog>
  );
}
