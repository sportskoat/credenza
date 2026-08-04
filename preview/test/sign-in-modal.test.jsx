// Feature 2 · the sign-in modal.
// Sign-in handoff README, screen 2. Two hard rules the README names, plus the
// two-state flow, plus the return-intent that has to survive a page load.
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SignInModal from "../../sheets/SignInModal.jsx";
import { INTENT_KEY, readIntent } from "../../components/sign-in-intent.js";
import { PLAN_CAPS } from "../src/usage.js";

// ModalShell moves focus to the close button one frame after it opens, so the
// keyboard lands somewhere sensible. Wait for that frame before typing:
// otherwise the focus move arrives mid-word and the rest of the address goes
// nowhere. This is the shell working, not a defect.
async function open(props = {}) {
  const signIn = props.signIn || vi.fn().mockResolvedValue({ sent: true });
  const onClose = props.onClose || vi.fn();
  const utils = render(<SignInModal onClose={onClose} signIn={signIn} {...props} />);
  await waitFor(() =>
    expect(document.activeElement).toHaveClass("cz-icon-button"),
  );
  return { ...utils, signIn, onClose };
}

afterEach(cleanup);

beforeEach(() => {
  window.sessionStorage.clear();
});

describe("sign-in modal · state A", () => {
  // Kyle 2026-08-02: Apple is parked until Credenza has an Apple developer
  // account. The button led nowhere, so it leaves the sheet. The provider is
  // still wired in auth.js, so bringing it back is one line of JSX.
  // Kyle 2026-08-03: Discord joins Google as a live button.
  it("offers three ways in and no fourth", async () => {
    await open();
    expect(screen.getByRole("button", { name: "Email me a sign-in link." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue with Discord" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /apple/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /facebook/i })).toBeNull();
  });

  it("shows no price and no create-account tab", async () => {
    const { container } = await open();
    const text = container.textContent;
    expect(text).not.toMatch(/\$/);
    expect(text).not.toMatch(/create account/i);
    expect(text).not.toMatch(/sign up/i);
    // Sign-in is not the checkout. Pro belongs on its own route.
    expect(text).not.toMatch(/\bPro\b/);
  });

  it("promises the free cap the server actually gives", async () => {
    const { container } = await open();
    expect(container.textContent).toContain(String(PLAN_CAPS.free.resolveTotal));
    expect(container.textContent).not.toMatch(/unlimited/i);
  });

  it("keeps the send button disabled until the address has a shape", async () => {
    const user = userEvent.setup();
    await open();
    const send = screen.getByRole("button", { name: "Email me a sign-in link." });
    expect(send).toBeDisabled();
    await user.type(screen.getByLabelText("Email"), "kyle@");
    expect(send).toBeDisabled();
    await user.type(screen.getByLabelText("Email"), "example.com");
    expect(send).toBeEnabled();
  });

  it("never shows an inline error while the person types", async () => {
    const user = userEvent.setup();
    const { container } = await open();
    await user.type(screen.getByLabelText("Email"), "kyle@");
    expect(container.textContent).not.toMatch(/invalid|not a valid|Couldn't read/i);
  });
});

describe("sign-in modal · state B", () => {
  it("swaps to the sent state and names the address it used", async () => {
    const user = userEvent.setup();
    const signIn = vi.fn().mockResolvedValue({ sent: true });
    await open({ signIn });
    await user.type(screen.getByLabelText("Email"), "kyle@example.com");
    await user.click(screen.getByRole("button", { name: "Email me a sign-in link." }));

    await waitFor(() => expect(screen.getByText("LINK SENT")).toBeInTheDocument());
    expect(screen.getByRole("heading", { name: "Check your email." })).toBeInTheDocument();
    expect(screen.getByText("kyle@example.com")).toBeInTheDocument();
    expect(signIn).toHaveBeenCalledWith("email", { email: "kyle@example.com" });
    // The form is gone: there is one thing to do now, and it is not here.
    expect(screen.queryByLabelText("Email")).toBeNull();
  });

  it("returns to state A with an empty field", async () => {
    const user = userEvent.setup();
    await open();
    await user.type(screen.getByLabelText("Email"), "kyle@example.com");
    await user.click(screen.getByRole("button", { name: "Email me a sign-in link." }));
    await waitFor(() => expect(screen.getByText("LINK SENT")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Use another address" }));
    expect(screen.getByLabelText("Email")).toHaveValue("");
  });
});

describe("sign-in modal · methods", () => {
  it("hands an OAuth redirect to the browser instead of navigating itself", async () => {
    const user = userEvent.setup();
    const signIn = vi.fn().mockResolvedValue({ redirect: "https://example.test/authorize" });
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...original, assign },
    });

    await open({ signIn });
    // Was Apple; Apple is parked (Kyle 2026-08-02). Google takes the same path.
    await user.click(screen.getByRole("button", { name: "Continue with Google" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://example.test/authorize"));
    expect(signIn).toHaveBeenCalledWith("google", { email: "" });

    Object.defineProperty(window, "location", { configurable: true, value: original });
  });

  it("sends the Discord button through the same door", async () => {
    const user = userEvent.setup();
    const signIn = vi.fn().mockResolvedValue({ redirect: "https://example.test/authorize" });
    const assign = vi.fn();
    const original = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...original, assign },
    });

    await open({ signIn });
    await user.click(screen.getByRole("button", { name: "Continue with Discord" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://example.test/authorize"));
    expect(signIn).toHaveBeenCalledWith("discord", { email: "" });

    Object.defineProperty(window, "location", { configurable: true, value: original });
  });

  it("answers a keyless build with one flat line", async () => {
    const user = userEvent.setup();
    const signIn = vi
      .fn()
      .mockRejectedValue(new Error("Couldn't connect. Add provider keys in .env."));
    await open({ signIn });
    await user.click(screen.getByRole("button", { name: "Continue with Google" }));
    const line = await screen.findByText("Couldn't connect. Add provider keys in .env.");
    expect(line.textContent).not.toMatch(/!/);
    expect(line.textContent).not.toMatch(/—/);
  });

  it("says the address failed without blaming the person", async () => {
    const user = userEvent.setup();
    const signIn = vi.fn().mockRejectedValue(new Error("500"));
    await open({ signIn });
    await user.type(screen.getByLabelText("Email"), "kyle@example.com");
    await user.click(screen.getByRole("button", { name: "Email me a sign-in link." }));
    expect(await screen.findByText("Couldn't read that address.")).toBeInTheDocument();
  });
});

describe("sign-in modal · return intent", () => {
  it("records where the person came from before anything navigates", async () => {
    await open({ intent: { kind: "card", returnTo: "/", payload: { url: "https://shop.test/x" } } });
    const saved = readIntent();
    expect(saved).toEqual({
      kind: "card",
      returnTo: "/",
      payload: { url: "https://shop.test/x" },
    });
    expect(window.sessionStorage.getItem(INTENT_KEY)).toBeTruthy();
  });

  it("records nothing when it opens with no intent", async () => {
    await open();
    expect(readIntent()).toBeNull();
  });
});

describe("sign-in modal · voice", () => {
  it("uses no emoji, no exclamation mark and no em dash", async () => {
    const { container } = await open();
    const text = container.textContent;
    expect(text).not.toMatch(/!/);
    expect(text).not.toMatch(/—/);
    expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
  });
});
