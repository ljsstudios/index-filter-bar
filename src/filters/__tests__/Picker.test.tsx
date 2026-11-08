import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Picker } from "../Picker";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const LONG = "A value far too long to fit in the three hundred pixel picker";

const renderPicker = () =>
  render(
    <Picker
      id="test-picker"
      label="Values"
      rows={[
        { id: "short", label: "Short" },
        { id: "long", label: LONG },
      ]}
      activeIndex={-1}
      anchor={{ left: 0, top: 0 }}
      enterLabel="Enter"
      loadingLabel="Loading"
      onActiveChange={vi.fn()}
      onPick={vi.fn()}
    />,
  );

describe("Picker labels", () => {
  it("keeps the Enter keycap's room on every row", () => {
    const { container } = renderPicker();
    const popover = container.querySelector('[data-parity="picker"]') as HTMLElement;
    expect(popover.style.getPropertyValue("--picker-row-hint-width")).toMatch(/px$/);
  });

  it("a clipped label shows its whole text on hover, as the admin's does", () => {
    // happy-dom has no layout: the long label reports more text than room.
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.dataset.rowId === "long" ? 400 : 0;
    });
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(200);
    renderPicker();
    const long = screen.getByText(LONG);
    fireEvent.pointerEnter(long.parentElement as HTMLElement);
    const tooltip = document.querySelector('[data-parity="tooltip"]');
    expect(tooltip?.textContent).toBe(LONG);
    fireEvent.pointerEnter(screen.getByText("Short").parentElement as HTMLElement);
    expect(document.querySelectorAll('[data-parity="tooltip"]')).toHaveLength(1);
  });
});
