// Lane A — import UX around the free allowance (2026-08-04 audit).
//
//   A1  A haul paste bigger than the visitor's remaining free allowance says
//       so ONCE, up front ("This post has N items. You can do M free."),
//       before enrichment walks the queue.
//   A2  Dismissing the limits sheet with "Not now" stays dismissed for the
//       rest of that enrichment run. Before the fix every subsequently
//       refused card re-fired setLimitsOpen and the sheet sprang back ~1.5s
//       later — on a 25-card haul, forever.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Credenza from "../../credenza-fashion.jsx";

const STORE_KEY = "credenza-fashion-items-v1";

function installShim(initial = {}) {
  const data = { ...initial };
  window.storage = {
    get: async (key) => (key in data ? { value: data[key] } : null),
    set: async (key, value) => {
      data[key] = value;
    },
  };
  return data;
}

// Seven distinct, well-formed Weidian links — two over the signed-out cap.
const SEVEN_LINKS = [7817684613, 7484518956, 7735105240, 7801557221, 7455044038, 7810325724, 7812201399]
  .map((id) => "https://weidian.com/item.html?itemID=" + id)
  .join("\n");

async function pasteIntoImportSheet(text) {
  fireEvent.click(await screen.findByRole("button", { name: "Sign in" }));
  fireEvent.click(await screen.findByRole("button", { name: /All settings/ }));
  fireEvent.click(await screen.findByRole("button", { name: /Your data/ }));
  const box = await screen.findByLabelText(/Paste haul links/);
  fireEvent.change(box, { target: { value: text } });
  fireEvent.click(await screen.findByRole("button", { name: "Import 7" }));
}

beforeEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("A1: the upfront count line", () => {
  it("warns once, before enrichment, when the paste beats the free allowance", async () => {
    installShim({ [STORE_KEY]: JSON.stringify([]) });
    render(<Credenza />);
    await pasteIntoImportSheet(SEVEN_LINKS);
    const hits = await screen.findAllByText("This post has 7 items. You can do 5 free.");
    expect(hits).toHaveLength(1);
  });

  it("stays silent when the paste fits the allowance", async () => {
    installShim({ [STORE_KEY]: JSON.stringify([]) });
    render(<Credenza />);
    fireEvent.click(await screen.findByRole("button", { name: "Sign in" }));
    fireEvent.click(await screen.findByRole("button", { name: /All settings/ }));
    fireEvent.click(await screen.findByRole("button", { name: /Your data/ }));
    const box = await screen.findByLabelText(/Paste haul links/);
    fireEvent.change(box, {
      target: {
        value:
          "https://weidian.com/item.html?itemID=7817684613\nhttps://weidian.com/item.html?itemID=7484518956",
      },
    });
    fireEvent.click(await screen.findByRole("button", { name: "Import 2" }));
    await screen.findByText(/Imported 2 things/);
    expect(screen.queryByText(/This post has \d+ items\./)).toBe(null);
  });
});

describe("A2: a dismissed limits sheet stays dismissed for the run", () => {
  it("never re-opens the sheet the visitor just closed", async () => {
    installShim({ [STORE_KEY]: JSON.stringify([]) });
    // Every resolve read refuses as the server does at the anon wall: 401
    // with the sign_in_required code. The refusal is DELAYED so the queue's
    // later cards are still being refused after the visitor dismisses the
    // sheet — without the stagger every refusal lands before the click and
    // the test cannot tell a sticky dismissal from a finished queue.
    // Anything else fails quietly, the way an offline preview relay does.
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url) => {
        if (String(url).includes("/resolve")) {
          await new Promise((resolve) => setTimeout(resolve, 300));
          return new Response(JSON.stringify({ code: "sign_in_required" }), { status: 401 });
        }
        throw new Error("offline in test");
      })
    );
    render(<Credenza />);
    await pasteIntoImportSheet(SEVEN_LINKS);

    // The wall arrives while enrichment walks the queue.
    const notNow = await screen.findByRole("button", { name: "Not now" });
    fireEvent.click(notNow);
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Not now" })).toBe(null)
    );

    // The rest of the queue is still being refused behind the sheet. Give
    // the spring-back bug its full window (~1.5s live) — the sheet must not
    // return.
    await new Promise((resolve) => setTimeout(resolve, 2500));
    expect(screen.queryByRole("button", { name: "Not now" })).toBe(null);
    expect(screen.queryByText("That is your fifth free card.")).toBe(null);
    // The honest wall state remains: the persistent notice owns the held work.
    expect(screen.getByText("Sign in to read this link.")).toBeTruthy();
  });
});
