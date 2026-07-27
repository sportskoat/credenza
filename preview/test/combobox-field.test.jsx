// ComboboxField clear control — X icon must resolve from lucide-react.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ComboboxField from "../../components/ComboboxField.jsx";

afterEach(cleanup);

describe("ComboboxField clear control", () => {
  it("renders the clear button without crashing and clears the value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onClear = vi.fn();
    const onCommit = vi.fn();

    render(
      <ComboboxField
        label="Haul"
        value="Summer haul"
        onChange={onChange}
        suggestions={["Summer haul", "Winter haul"]}
        clearLabel="Remove from haul"
        onClear={onClear}
        onCommit={onCommit}
      />
    );

    const clearBtn = screen.getByRole("button", { name: "Remove from haul" });
    expect(clearBtn).toBeInTheDocument();
    // Lucide X renders an SVG inside the clear control.
    expect(clearBtn.querySelector("svg")).toBeTruthy();

    await user.click(clearBtn);
    expect(onChange).toHaveBeenCalledWith("");
    expect(onClear).toHaveBeenCalled();
    expect(onCommit).toHaveBeenCalledWith("");
  });
});
