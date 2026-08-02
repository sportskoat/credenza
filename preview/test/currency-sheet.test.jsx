import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";

import CurrencySheet from "../../sheets/CurrencySheet.jsx";
import { PRICE_PRIMARIES } from "../../credenza-fashion.jsx";

// Top-8 currency picker (lane 2, 2026-08-02). One list, pick and close.

afterEach(cleanup);

describe("CurrencySheet", () => {
  it("lists the top-8 codes in picker order", () => {
    const { container } = render(
      <CurrencySheet pricePrimary="USD" onSelectCurrency={() => {}} onClose={() => {}} />
    );
    const radios = within(container).getAllByRole("radio");
    expect(radios).toHaveLength(8);
    expect(radios.map((r) => r.querySelector(".cz-currency-code")?.textContent)).toEqual(
      PRICE_PRIMARIES
    );
  });

  it("marks the active currency and reports a pick", () => {
    const onSelectCurrency = vi.fn();
    const { container } = render(
      <CurrencySheet pricePrimary="EUR" onSelectCurrency={onSelectCurrency} onClose={() => {}} />
    );
    const eur = within(container).getByRole("radio", { name: /EUR/i });
    expect(eur.getAttribute("aria-checked")).toBe("true");
    fireEvent.click(within(container).getByRole("radio", { name: /GBP/i }));
    expect(onSelectCurrency).toHaveBeenCalledWith("GBP");
  });

  it("shows a sample amount with the right symbol for each code", () => {
    const { container } = render(
      <CurrencySheet pricePrimary="USD" onSelectCurrency={() => {}} onClose={() => {}} />
    );
    expect(within(container).getByText("$100")).toBeTruthy();
    expect(within(container).getByText("€100")).toBeTruthy();
    expect(within(container).getByText("£100")).toBeTruthy();
    expect(within(container).getByText("₩100")).toBeTruthy();
  });
});
