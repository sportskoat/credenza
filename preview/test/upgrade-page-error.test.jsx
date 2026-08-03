// Design review 2 · change 4.
// Kyle 2026-08-02: "if you are signed in and click 'start 3 days free' it does
// not go to any link? we need to diagnose and fix that." The press had no
// catch, so a failed checkout un-busied the button and said nothing. A person
// cannot tell a dead button from a slow one. These tests hold the line that
// now names the reason.
import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UpgradePage from "../../components/UpgradePage.jsx";
import { safeErrorMessage } from "../src/account.js";

// This suite does not auto-clean: vitest.config.js sets no globals.
afterEach(cleanup);

function open(onStart) {
  render(<UpgradePage signedIn onStart={onStart} onClose={vi.fn()} />);
  return screen.getByRole("button", { name: /Start|Upgrade to Pro/ });
}

describe("upgrade route · a failed press", () => {
  it("prints the reason under the button", async () => {
    const user = userEvent.setup();
    const button = open(vi.fn().mockRejectedValue(new Error("Billing is not answering right now. Try again in a minute.")));

    await user.click(button);

    const line = await screen.findByRole("alert");
    expect(line).toHaveTextContent("Billing is not answering right now.");
    expect(line).toHaveClass("cz-upgrade-error");
  });

  it("says something even when the failure carries no words", async () => {
    const user = userEvent.setup();
    const button = open(vi.fn().mockRejectedValue(new Error("")));

    await user.click(button);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong. Try again.",
    );
  });

  it("leaves the button pressable, so a second try is possible", async () => {
    const user = userEvent.setup();
    const button = open(vi.fn().mockRejectedValue(new Error("Nope")));

    await user.click(button);
    await screen.findByRole("alert");

    expect(button).not.toBeDisabled();
  });

  it("clears the last reason on the next press", async () => {
    const user = userEvent.setup();
    const onStart = vi
      .fn()
      .mockRejectedValueOnce(new Error("Nope"))
      .mockResolvedValueOnce(undefined);
    const button = open(onStart);

    await user.click(button);
    await screen.findByRole("alert");

    await user.click(button);
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(onStart).toHaveBeenCalledTimes(2);
  });

  it("shows no line at all when checkout works", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn().mockResolvedValue(undefined);
    const button = open(onStart);

    await user.click(button);
    await waitFor(() => expect(onStart).toHaveBeenCalled());
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("upgrade route · the words a person reads", () => {
  // The Pro page prints whatever reaches it. Every message on the checkout
  // path goes through the same sanitiser, so none of them is a note to a
  // developer.
  it("turns a server fault into one plain sentence", () => {
    expect(safeErrorMessage(500, null)).toBe(
      "Billing is not answering right now. Try again in a minute.",
    );
  });

  it("keeps a lost sign-in readable", () => {
    expect(safeErrorMessage(401, "Unauthorized")).toBe(
      "Your sign-in expired. Sign in again first.",
    );
  });
});
