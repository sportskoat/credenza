// Kyle 2026-08-03: "sometimes theirs buttons that dont mean what the error is.
// can you find any others?" The audit found six. This file pins the rule they
// all share: a message that names a problem must sit beside a button that can
// answer THAT problem. A message with no answerable button is the defect.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { signInErrorMessage } from "../src/auth.js";

afterEach(cleanup);

const read = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");
const app = read("../../credenza-fashion.jsx");

const { default: SharedLinksSheet } = await import("../../sheets/SharedLinksSheet.jsx");
const { default: SettingsContext } = await import("../../settings/SettingsContext.jsx");
const { default: AccountPlanSection } = await import("../../settings/AccountPlanSection.jsx");

const noop = () => {};

// The signed-in Free pane. It carries all four buttons that can fail, so one
// harness covers every row finding 5 touches.
function renderAccountPane(extra = {}) {
  return render(
    <SettingsContext.Provider
      value={{
        accountEnabled: true,
        accountSession: { user: { email: "kyle@example.com" } },
        accountPlan: { state: "free" },
        limits: { kind: "free", left: 18, cap: 20 },
        onSignIn: noop,
        onOpenUpgrade: noop,
        onPortal: noop,
        onSignOut: noop,
        onDeleteAccount: noop,
        onRestorePurchase: noop,
        ...extra,
      }}
    >
      <AccountPlanSection />
    </SettingsContext.Provider>
  );
}

// Walk up from a button to the row that holds it. A message belongs to a
// button only if it shares that row.
const rowOf = (el) => el.closest(".cz-plan-standing-row");

const { default: FirstSizeBlock } = await import("../../components/FirstSizeBlock.jsx");
const { parseSizeChart } = await import("../../credenza-fashion.jsx");

describe("finding 1 · a shared-links list that would not load", () => {
  it("offers a button that loads the list again", async () => {
    // The first call fails, the second one works. A person must be able to
    // reach the second one without closing and reopening the sheet.
    const onList = vi
      .fn()
      .mockRejectedValueOnce(new Error("Shared links are not answering right now."))
      .mockResolvedValueOnce([{ id: "abc", url: "https://c.fyi/abc", count: 2 }]);

    render(<SharedLinksSheet embedded onList={onList} onDelete={vi.fn()} onCopy={vi.fn()} />);

    expect(
      await screen.findByText("Shared links are not answering right now.")
    ).toBeInTheDocument();
    // The old screen said "No shared links yet" beside the error. A failed
    // load is not an empty list, and it must never read as one.
    expect(screen.queryByText(/No shared links yet/)).toBe(null);

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("A Credenza haul")).toBeInTheDocument();
    expect(onList).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: "Try again" })).toBe(null);
  });

  it("does not offer it for a failed delete, which keeps its own button", async () => {
    const onList = vi.fn().mockResolvedValue([{ id: "abc", url: "https://c.fyi/abc", count: 1 }]);
    const onDelete = vi.fn().mockRejectedValue(new Error("The link could not be deleted."));

    render(<SharedLinksSheet embedded onList={onList} onDelete={onDelete} onCopy={vi.fn()} />);
    await screen.findByText("A Credenza haul");

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Tap to confirm" }));

    expect(await screen.findByText("The link could not be deleted.")).toBeInTheDocument();
    // Delete failed, and the Delete button is still on the row. That IS the
    // answer, so a second "Try again" would be a second door to one room.
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument()
    );
    expect(screen.queryByRole("button", { name: "Try again" })).toBe(null);
  });
});

describe("finding 2 · a sign-in link that did not work", () => {
  it("writes a sentence instead of the server's own words", () => {
    // What Supabase actually sends back. None of it is for a person to read.
    expect(signInErrorMessage("unable to exchange external code: 401")).toBe(
      "Credenza could not finish that sign-in. Try again."
    );
    expect(signInErrorMessage("Email link is invalid or has expired")).toBe(
      "That sign-in link has expired. Ask for a new one."
    );
    expect(signInErrorMessage("access_denied")).toBe(
      "That sign-in was cancelled. Try again when you are ready."
    );
  });

  it("keeps our own sentence, which is already written for a person", () => {
    expect(signInErrorMessage("Sign-in link was incomplete. Request a new one.")).toBe(
      "Sign-in link was incomplete. Request a new one."
    );
  });

  it("answers a missing or odd value with the plain sentence", () => {
    expect(signInErrorMessage(undefined)).toBe("Credenza could not finish that sign-in. Try again.");
    expect(signInErrorMessage("")).toBe("Credenza could not finish that sign-in. Try again.");
  });

  it("puts a Sign in button on the toast that reports it", () => {
    // The old line read "Sign-in failed: " + the server's words, with nothing
    // to press. A person had to find the sign-in door on their own.
    expect(app).not.toContain('"Sign-in failed: "');
    expect(app).toMatch(
      /notify\(signInErrorMessage\(fromUrl\.error\), \{[\s\S]{0,220}?actionLabel: "Sign in",[\s\S]{0,120}?openSignIn\(/
    );
  });
});

describe("finding 3 · a sign-in that expired while you worked", () => {
  it("puts a Sign in button on the toast", () => {
    expect(app).toMatch(
      /const expiredSession = \([\s\S]{0,320}?actionLabel: "Sign in",[\s\S]{0,140}?openSignIn\(\{ kind: "shelf", returnTo \}\)/
    );
  });

  it("returns you to the screen you were on", () => {
    // Pro page back to the Pro page. Settings back to Settings.
    expect(app).toContain('throw expiredSession("/upgrade")');
    expect(app).toContain('throw expiredSession("/settings/account")');
  });

  it("leaves no copy of the sentence without a button", () => {
    // Delete account said the same words with a bare notify(). Only the one
    // definition inside expiredSession may hold the sentence now.
    const bare = app.match(/notify\("Your sign-in expired\. Sign in again first\."\)/g);
    expect(bare).toBe(null);
  });
});

describe("finding 4 · a browser that blocks copying", () => {
  it("stops saying only that copy is blocked", () => {
    // The old message named the problem and no way around it. Nothing to
    // press, and no sight of the text a person asked for. The sentence
    // survives in one comment, which explains why it left.
    expect(app).not.toContain('notify("Copy is blocked in this browser."');
  });

  it("shows the text so a person can select it by hand", () => {
    // Both arms of copyForHaul open the panel: no clipboard at all, and a
    // clipboard that refuses.
    const i = app.indexOf("const copyForHaul = useCallback(");
    expect(i).toBeGreaterThan(-1);
    const body = app.slice(i, i + 700);
    expect(body.match(/setCopyFallbackText\(text \|\| ""\)/g)).toHaveLength(2);
    expect(app).toContain('title="Copy this by hand"');
    expect(app).toMatch(/className="cz-copyfall-box"[\s\S]{0,220}?value=\{copyFallbackText\}/);
  });

  it("keeps one clipboard path for every haul surface", () => {
    // The QC overlay held a second copy of the same block. Two copies mean
    // two answers, and only one of them would ever get fixed.
    expect(app).toContain("onCopy={copyForHaul}");
    expect(app.match(/navigator\.clipboard\.writeText/g)).toHaveLength(2);
  });
});

describe("finding 5 · a failed button in the account pane", () => {
  it("puts a failed sign out under the Sign out button", async () => {
    const onSignOut = vi.fn().mockRejectedValue(new Error("Sign out did not go through."));
    const { container } = renderAccountPane({ onSignOut });

    const button = within(container).getByText("Sign out");
    fireEvent.click(button);

    const message = await within(container).findByText("Sign out did not go through.");
    // The old pane printed this at the foot of the whole pane, beside
    // "Delete account". Red words next to a delete button read as a threat.
    expect(rowOf(message)).toBe(rowOf(button));
  });

  it("keeps that message away from the delete row", async () => {
    const onSignOut = vi.fn().mockRejectedValue(new Error("Sign out did not go through."));
    const { container } = renderAccountPane({ onSignOut });

    fireEvent.click(within(container).getByText("Sign out"));
    const message = await within(container).findByText("Sign out did not go through.");

    const deleteRow = rowOf(within(container).getByText("Delete account"));
    expect(deleteRow.contains(message)).toBe(false);
  });

  it("puts a failed restore under the Restore purchase button", async () => {
    const onRestorePurchase = vi
      .fn()
      .mockRejectedValue(new Error("No purchase found on this account."));
    const { container } = renderAccountPane({ onRestorePurchase });

    const button = within(container).getByText("Restore purchase");
    fireEvent.click(button);

    const message = await within(container).findByText("No purchase found on this account.");
    expect(rowOf(message)).toBe(rowOf(button));
  });

  it("puts a failed delete under the delete button", async () => {
    const onDeleteAccount = vi.fn().mockRejectedValue(new Error("That did not go through."));
    const { container } = renderAccountPane({ onDeleteAccount });

    // Delete is two-tap. The second tap sends it.
    fireEvent.click(within(container).getByText("Delete account"));
    const armed = within(container).getByText("Tap again to delete your account");
    fireEvent.click(armed);

    const message = await within(container).findByText("That did not go through.");
    expect(rowOf(message)).toBe(rowOf(armed));
  });

  it("shows one failure at a time", async () => {
    const onSignOut = vi.fn().mockRejectedValue(new Error("Sign out did not go through."));
    const onRestorePurchase = vi.fn().mockResolvedValue(undefined);
    const { container } = renderAccountPane({ onSignOut, onRestorePurchase });

    fireEvent.click(within(container).getByText("Sign out"));
    await within(container).findByText("Sign out did not go through.");

    // A second button that works must clear the first one's message. A stale
    // failure beside a button that just worked is a lie.
    fireEvent.click(within(container).getByText("Restore purchase"));
    await waitFor(() =>
      expect(within(container).queryByText("Sign out did not go through.")).toBe(null)
    );
  });

  it("leaves no failure line at the foot of the pane", () => {
    const pane = read("../../settings/AccountPlanSection.jsx");
    // The single bottom-of-pane line is gone. Every message now rides a row.
    expect(pane).not.toContain('className="cz-profile-signin-error"');
    expect(pane).toContain('className="cz-plan-standing-error"');
    // The key of the button travels with the message. Without the key a row
    // cannot tell its own failure from another row's.
    expect(pane).toContain("setFailure({");
    expect(pane).toMatch(/const errorFor = \(key\) =>/);
    expect(pane.match(/error=\{errorFor\("(signout|portal|restore|delete)"\)\}/g)).toHaveLength(4);
  });
});

describe("finding 6 · a size question that names a field on another screen", () => {
  // A chart with no XXXL row, and a size run that offers XXXL anyway. Picking
  // it reaches step 2 and then fails, which is the state Kyle photographed.
  const CHART = parseSizeChart("S: chest 100\nM: chest 104\nL: chest 110\nXL: chest 116");
  const mountSize = (props = {}) =>
    render(
      <FirstSizeBlock
        item={{ id: "f6-shirt", category: "shirt", title: "Heavyweight boxy tee" }}
        chart={CHART}
        sizeRun={["S", "M", "L", "XXXL"]}
        units="cm"
        onSaveBodyProfile={() => {}}
        onSaveFitPref={() => {}}
        {...props}
      />
    );

  const reachTheFailure = () => {
    fireEvent.click(screen.getByRole("radio", { name: "XXXL" }));
    // Any ease answer will do. The failure comes from the chart, not the ease.
    fireEvent.click(screen.getAllByRole("radio")[0]);
    fireEvent.click(screen.getByRole("button", { name: "Show my size" }));
  };

  it("offers a button that opens the field the message names", async () => {
    mountSize();
    reachTheFailure();

    expect(await screen.findByText(/not on this seller/)).toBeInTheDocument();
    // The old step held only "Back" and "Skip for now". The message pointed at
    // a tape field on a screen a person had no way to reach from here.
    const link = screen.getByRole("button", { name: "I have a tape · enter chest" });
    fireEvent.click(link);

    // The chest field is now on screen, and the failure is cleared.
    expect(await screen.findByLabelText(/Chest, pit to pit, doubled/)).toBeInTheDocument();
    expect(screen.queryByText(/not on this seller/)).toBe(null);
  });

  it("names the waist on a card that asks for a waist", async () => {
    mountSize({ item: { id: "f6-pants", category: "pants", title: "Wide leg trouser" } });
    reachTheFailure();

    await screen.findByText(/not on this seller/);
    // A trouser card asks for a waist. The old sentence said "chest" on both.
    expect(screen.getByRole("button", { name: "I have a tape · enter waist" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /enter chest/ })).toBe(null);
  });

  it("offers it only when a message is on screen", () => {
    mountSize();
    fireEvent.click(screen.getByRole("radio", { name: "L" }));
    // Step 2 with nothing wrong. The tape offer belongs to step 1 here, and a
    // second copy on a working screen is one door too many.
    expect(screen.getByRole("button", { name: "Show my size" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /I have a tape/ })).toBe(null);
  });

  it("says the same thing for the other failure on that step", () => {
    // Two sentences reach that step: a size off the chart, and a pick that
    // would not score. Both send a person to the tape, so both need the door.
    const block = read("../../components/FirstSizeBlock.jsx");
    expect(block).toMatch(
      /Could not score a pick\. Enter your " \+ \(bottoms \? "waist" : "chest"\) \+ " instead\./
    );
    expect(block).toContain("cz-first-size-error-link");
  });
});
