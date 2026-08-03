// Dedicated Sign-in page (Kyle 2026-08-03 / O build ask).
// Full-screen presentation, Google + magic link only, not nested in Settings.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import SignInPage from "../../settings/SignInPage.jsx";
import SignInForm from "../../settings/SignInForm.jsx";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const APP = readFileSync(join(ROOT, "credenza-fashion.jsx"), "utf8");
const ACCOUNT = readFileSync(join(ROOT, "settings/AccountPlanSection.jsx"), "utf8");

afterEach(() => {
  cleanup();
});

describe("SignInPage", () => {
  it("renders the full-screen dialog with both auth methods", () => {
    const onMagicLink = vi.fn();
    const onGoogle = vi.fn();
    const onClose = vi.fn();
    render(
      <SignInPage
        accountEnabled
        onMagicLink={onMagicLink}
        onGoogle={onGoogle}
        onClose={onClose}
      />
    );
    const dialog = screen.getByRole("dialog", { name: "Sign in" });
    expect(dialog).toBeTruthy();
    expect(dialog.classList.contains("cz-signin-page")).toBe(true);
    expect(within(dialog).getByText("Welcome back")).toBeTruthy();
    expect(within(dialog).getByLabelText("Email address")).toBeTruthy();
    expect(
      within(dialog).getByRole("button", { name: "Email me a sign-in link" })
    ).toBeTruthy();
    expect(
      within(dialog).getByRole("button", { name: "Continue with Google" })
    ).toBeTruthy();
    // No password field — product is Google + passwordless email only.
    expect(within(dialog).queryByLabelText(/password/i)).toBeNull();
  });

  it("sends a magic link and shows the check-email state", async () => {
    const onMagicLink = vi.fn().mockResolvedValue(true);
    render(
      <SignInPage
        accountEnabled
        onMagicLink={onMagicLink}
        onGoogle={vi.fn()}
        onClose={vi.fn()}
      />
    );
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "kyle@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Email me a sign-in link" }));
    await waitFor(() => expect(onMagicLink).toHaveBeenCalledWith("kyle@example.com"));
    expect(screen.getByRole("status").textContent).toMatch(/Check your email/i);
  });

  it("calls onGoogle for the Google button", async () => {
    const onGoogle = vi.fn().mockResolvedValue(undefined);
    render(
      <SignInPage
        accountEnabled
        onMagicLink={vi.fn()}
        onGoogle={onGoogle}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));
    await waitFor(() => expect(onGoogle).toHaveBeenCalledTimes(1));
  });

  it("closes via Back to the shelf", () => {
    const onClose = vi.fn();
    render(
      <SignInPage
        accountEnabled
        onMagicLink={vi.fn()}
        onGoogle={vi.fn()}
        onClose={onClose}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /Back to the shelf/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("SignInForm accounts-off", () => {
  it("says when accounts are off", () => {
    render(<SignInForm accountEnabled={false} onMagicLink={vi.fn()} onGoogle={vi.fn()} />);
    expect(screen.getByText("Accounts are off in this build")).toBeTruthy();
  });
});

describe("wiring: sign-in is not buried in Settings", () => {
  it("LimitsSheet onSignIn opens the dedicated page, not settings account", () => {
    // Source lock: the consumer must call openSignIn, not navigateSettings("account").
    const start = APP.indexOf("onSignIn={() => {");
    expect(start).toBeGreaterThan(-1);
    const block = APP.slice(start, start + 180);
    expect(block).toContain("openSignIn()");
    expect(block).not.toContain('navigateSettings("account")');
  });

  it("AccountPlanSection no longer embeds the magic-link form", () => {
    expect(ACCOUNT).toContain("Open sign-in");
    expect(ACCOUNT).toContain("onOpenSignIn");
    expect(ACCOUNT).not.toContain("Email me a sign-in link");
    expect(ACCOUNT).not.toContain("Continue with Google");
  });

  it("lazy-loads SignInPage from the app root", () => {
    expect(APP).toContain('import("./settings/SignInPage.jsx")');
    expect(APP).toContain("signInOpen");
  });
});
