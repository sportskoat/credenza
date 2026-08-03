// Feature 2 · one door into sign-in.
// Sign-in handoff README, "2 · Sign-in modal": three methods, and no fourth.
// Every surface calls signInWith, so no surface can invent a provider that
// has no button.
import { describe, it, expect } from "vitest";
import {
  AUTH_ENABLED,
  AUTH_MISSING_MESSAGE,
  OAUTH_PROVIDERS,
  googleAuthUrl,
  oauthAuthUrl,
  signInWith,
} from "../src/auth.js";

const HOME = "https://credenzafashion.com";

describe("sign-in methods", () => {
  it("offers Google and Apple, and nothing else", () => {
    expect(OAUTH_PROVIDERS).toEqual(["google", "apple"]);
  });

  it("builds one authorize URL per provider", () => {
    expect(oauthAuthUrl("google", { redirectTo: HOME })).toContain(
      "/auth/v1/authorize?provider=google"
    );
    expect(oauthAuthUrl("apple", { redirectTo: HOME })).toContain(
      "/auth/v1/authorize?provider=apple"
    );
    expect(oauthAuthUrl("apple", { redirectTo: HOME })).toContain(
      "redirect_to=" + encodeURIComponent(HOME)
    );
  });

  it("keeps googleAuthUrl as the same URL it always was", () => {
    expect(googleAuthUrl({ redirectTo: HOME })).toBe(
      oauthAuthUrl("google", { redirectTo: HOME })
    );
  });

  it("refuses a provider that has no button", () => {
    expect(() => oauthAuthUrl("discord", { redirectTo: HOME })).toThrow(
      "Unknown sign-in method."
    );
    expect(signInWith("discord", { redirectTo: HOME })).rejects.toThrow(
      "Unknown sign-in method."
    );
  });

  it("hands an OAuth caller a redirect instead of navigating for it", async () => {
    const out = await signInWith("apple", { redirectTo: HOME });
    expect(out.redirect).toContain("provider=apple");
    expect(out.sent).toBe(undefined);
  });

  it("posts the email through the one door and reports it sent", async () => {
    const seen = [];
    const fetchImpl = async (url, opts) => {
      seen.push({ url, body: JSON.parse(opts.body) });
      return { ok: true, status: 200, json: async () => ({}) };
    };
    const out = await signInWith("email", {
      email: "u@example.com",
      redirectTo: HOME,
      fetchImpl,
    });
    expect(out.sent).toBe(true);
    expect(seen[0].url).toContain("/auth/v1/otp");
    expect(seen[0].body.email).toBe("u@example.com");
  });

  it("carries one flat line for a build with no keys", () => {
    // The modal still renders without keys, because hiding it would read as a
    // missing feature. This line is the whole apology.
    expect(AUTH_MISSING_MESSAGE).toBe("Couldn't connect. Add provider keys in .env.");
    expect(AUTH_MISSING_MESSAGE).not.toMatch(/!/);
    expect(AUTH_MISSING_MESSAGE).not.toMatch(/—/);
  });

  it("answers with that line, and never with a stack trace, when keys are absent", async () => {
    if (AUTH_ENABLED) return; // a keyed build cannot reach this branch
    await expect(signInWith("google")).rejects.toThrow(AUTH_MISSING_MESSAGE);
  });
});
