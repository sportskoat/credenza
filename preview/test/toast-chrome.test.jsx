// Toast chrome (Kyle 2026-07-31, option A): small-rounded card + tone icon.
// Bottom-center position, rise/fade entrance, and the action button stay as-is.
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Credenza from "../../credenza-fashion.jsx";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const CSS = readFileSync(join(ROOT, "credenza-fashion.css"), "utf8");
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

afterEach(cleanup);

describe("toast card shape (source pin)", () => {
  it("uses a 14px card radius, not a full pill", () => {
    const block = CSS.slice(
      CSS.indexOf(".cz-app[data-fashion=\"true\"] .cz-toast {"),
      CSS.indexOf(".cz-app[data-fashion=\"true\"] .cz-toast-icon"),
    );
    expect(block).toMatch(/border-radius:\s*14px/);
    expect(block).not.toMatch(/border-radius:\s*999px/);
  });
});

describe("toast tone icons", () => {
  it("shows a check icon on a normal success toast", async () => {
    installShim({ [STORE_KEY]: JSON.stringify([]) });
    const user = userEvent.setup();
    render(<Credenza />);

    await user.click(await screen.findByRole("button", { name: "Stash a link or note" }));
    const box = await screen.findByPlaceholderText(/Paste a link, or a whole/);
    fireEvent.change(box, { target: { value: "plain note for the shelf" } });
    fireEvent.keyDown(box, { key: "Enter" });

    expect(await screen.findByText(/^Stashed · /)).toBeInTheDocument();
    const toast = document.querySelector(".cz-toast");
    expect(toast).not.toBe(null);
    const icon = toast.querySelector(".cz-toast-icon");
    expect(icon).not.toBe(null);
    expect(icon.getAttribute("data-icon")).toBe("ok");
    expect(icon.getAttribute("aria-hidden")).toBe("true");
    expect(icon.querySelector("svg")).not.toBe(null);
  });

  it("shows an X icon on an error toast", async () => {
    // Persistent save failure is the reliable data-tone="error" path in tests
    // (flashImportResult(..., true) → tone error). Reddit/reader paths need a
    // secret and are flaky without it.
    const data = installShim({ [STORE_KEY]: JSON.stringify([]) });
    window.storage.set = async () => {
      throw new Error("disk full");
    };
    const user = userEvent.setup();
    render(<Credenza />);

    await user.click(await screen.findByRole("button", { name: "Stash a link or note" }));
    const box = await screen.findByPlaceholderText(/Paste a link, or a whole/);
    fireEvent.change(box, { target: { value: "note that will fail to save" } });
    fireEvent.keyDown(box, { key: "Enter" });

    expect(
      await screen.findByText(/Changes aren't saved/, {}, { timeout: 4000 }),
    ).toBeInTheDocument();
    const toast = document.querySelector(".cz-toast");
    expect(toast).not.toBe(null);
    expect(toast.getAttribute("data-tone")).toBe("error");
    const icon = toast.querySelector(".cz-toast-icon");
    expect(icon).not.toBe(null);
    expect(icon.getAttribute("data-icon")).toBe("error");
    expect(icon.querySelector("svg")).not.toBe(null);
    // Silence unused-data lint if the shim stays for clarity.
    void data;
  });
});
