import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import Credenza from "../../credenza-v3.jsx";

// The app persists through window.storage (artifact/extension shim) when
// present; giving it an in-memory shim keeps tests hermetic and lets us seed
// broken payloads.
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

const STORE_KEY = "credenza-items-v3";

function seededItem(overrides = {}) {
  return {
    id: "seed-1",
    title: "Espresso grinder research",
    type: "link",
    url: "https://example.com/grinder",
    host: "example.com",
    createdAt: Date.now() - 864e5,
    updatedAt: Date.now() - 864e5,
    importance: "medium",
    ...overrides,
  };
}

beforeEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("first load", () => {
  it("renders the shelf from storage without writing back on load", async () => {
    const data = installShim({ [STORE_KEY]: JSON.stringify([seededItem()]) });
    const writes = vi.spyOn(window.storage, "set");
    render(<Credenza />);
    expect(await screen.findByText("Espresso grinder research")).toBeInTheDocument();
    // Prefs may persist on load; the shelf itself must not be rewritten.
    const shelfWrites = writes.mock.calls.filter(([key]) => key === STORE_KEY);
    expect(shelfWrites).toHaveLength(0);
    expect(data[STORE_KEY]).toContain("seed-1");
  });

  it("shows the recovery state on malformed storage and never auto-saves an empty shelf", async () => {
    const data = installShim({ [STORE_KEY]: "{corrupted" });
    render(<Credenza />);
    expect(await screen.findByText(/shelf needs recovery/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /download recovery data/i })).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 50));
    expect(data[STORE_KEY]).toBe("{corrupted");
  });
});

describe("core interactions", () => {
  it("search narrows the shelf with realistic multi-word queries", async () => {
    installShim({
      [STORE_KEY]: JSON.stringify([
        seededItem(),
        seededItem({ id: "seed-2", title: "Vinyl record gift for dad", type: "note", url: null, host: null }),
      ]),
    });
    const user = userEvent.setup();
    render(<Credenza />);
    await screen.findByText("Espresso grinder research");
    const search = screen.getByRole("searchbox");
    await user.type(search, "gift for dad");
    await waitFor(() => {
      expect(screen.queryByText("Espresso grinder research")).not.toBeInTheDocument();
      expect(screen.getByText("Vinyl record gift for dad")).toBeInTheDocument();
    });
  });

  it("delete is undoable and restores the exact item", async () => {
    installShim({ [STORE_KEY]: JSON.stringify([seededItem()]) });
    const user = userEvent.setup();
    render(<Credenza />);
    // The Remove pill lives on the expanded card face.
    await user.click(await screen.findByText("Espresso grinder research"));
    const deleteButton = await screen.findByRole("button", { name: /remove/i });
    await user.click(deleteButton);
    await waitFor(() =>
      expect(screen.queryByText("Espresso grinder research")).not.toBeInTheDocument()
    );
    await user.click(screen.getByRole("button", { name: /undo/i }));
    expect(await screen.findByText("Espresso grinder research")).toBeInTheDocument();
  });

  it("shows an actionable no-results state for a search with no matches", async () => {
    installShim({ [STORE_KEY]: JSON.stringify([seededItem()]) });
    const user = userEvent.setup();
    render(<Credenza />);
    await screen.findByText("Espresso grinder research");
    await user.type(screen.getByRole("searchbox"), "zzz nothing matches");
    expect(await screen.findByText(/no matches/i)).toBeInTheDocument();
  });
});

describe("accessibility", () => {
  it("populated shelf has no axe violations", async () => {
    installShim({ [STORE_KEY]: JSON.stringify([seededItem()]) });
    const { container } = render(<Credenza />);
    await screen.findByText("Espresso grinder research");
    expect(await axe(container)).toHaveNoViolations();
  }, 20000);

  it("empty shelf has no axe violations", async () => {
    installShim();
    const { container } = render(<Credenza />);
    await waitFor(() => expect(screen.queryByText(/opening shelf/i)).not.toBeInTheDocument());
    expect(await axe(container)).toHaveNoViolations();
  }, 20000);
});
