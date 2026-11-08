import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchField } from "../SearchField";

const LABELS = {
  placeholder: "Search and filter",
  clear: "Clear",
  removeFilter: "Remove filter",
  enter: "Enter",
  fieldList: "Filters",
  more: (count: number) => ` + ${count} more`,
  is: "Is",
  isNot: "Is not",
  noOptions: "No options available",
  addFilter: "Add new filter",
  customDate: "Custom date",
  customRange: "Custom range",
  starting: "Starting",
  ending: "Ending",
  a11y: {
    help: "Type to search. Arrow keys move between filters. Backspace removes a filter.",
    remove: (chip: string) => `Remove ${chip}`,
    values: (field: string) => `${field} values`,
    condition: (field: string) => `${field} condition`,
    minimum: "minimum",
    maximum: "maximum",
    year: "year",
    month: "month",
    day: "day",
    added: (chip: string) => `Filter added: ${chip}`,
    changed: (chip: string) => `Filter changed: ${chip}`,
    removed: (chip: string) => `Filter removed: ${chip}`,
    chipHint: (chip: string) => `${chip}. Backspace removes it.`,
  },
};

// Behaviour numbers are docs/research/index-filter-bar/behaviour.md, logic.md
// rules are prefixed "logic".

afterEach(cleanup);

const renderField = (value = "") => {
  const onChange = vi.fn();
  const view = render(<SearchField value={value} onChange={onChange} labels={LABELS} />);
  const field = screen.getByRole("combobox") as HTMLDivElement;
  return { ...view, field, onChange };
};

describe("SearchField", () => {
  it("b1: an empty field named and placeheld 'Search and filter', no spellcheck", () => {
    const { field } = renderField();
    expect(field.getAttribute("aria-label")).toBe("Search and filter");
    expect(field.getAttribute("data-placeholder")).toBe("Search and filter");
    expect(field.getAttribute("contenteditable")).toBe("true");
    expect(field.getAttribute("spellcheck")).toBe("false");
    expect(field.textContent).toBe("");
  });

  it("b5: typing reports the text", () => {
    const { field, onChange } = renderField();
    field.textContent = "snow";
    fireEvent.input(field);
    expect(onChange).toHaveBeenCalledWith("snow");
  });

  it("puts an outside change in the field (a view loaded, Reset)", () => {
    const { field, rerender } = renderField("snow");
    expect(field.textContent).toBe("snow");
    rerender(<SearchField value="" onChange={vi.fn()} labels={LABELS} />);
    expect(field.textContent).toBe("");
  });

  it("keeps to one line: Enter does not break it", () => {
    const { field } = renderField();
    const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    field.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("logic 86: pastes plain text on one line, trimmed", () => {
    const exec = vi.fn();
    Object.defineProperty(document, "execCommand", { value: exec, configurable: true });
    const { field } = renderField();
    fireEvent.paste(field, {
      clipboardData: { getData: () => "  snow\nboard \r\n wax  " },
    });
    expect(exec).toHaveBeenCalledWith("insertText", false, "snow board wax");
  });

  it("b50: the clear button is there only with text, and empties the field", () => {
    expect(renderField().container.querySelector('[data-parity="search-clear"]')).toBeNull();
    cleanup();
    const { field, onChange } = renderField("snow");
    fireEvent.click(screen.getByLabelText("Clear"));
    expect(field.textContent).toBe("");
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("logic 72: leaving the field scrolls it back to the start", () => {
    const { field } = renderField("a long search");
    field.scrollLeft = 40;
    fireEvent.blur(field);
    expect(field.scrollLeft).toBe(0);
  });
});

describe("SearchField filters", () => {
  const fields = [
    {
      key: "status",
      name: "Sync status",
      multi: true,
      values: [
        { value: "synced", label: "Synced" },
        { value: "unmatched", label: "Unmatched" },
      ],
      operators: [
        { value: "is", label: "Is", chipLabel: "Sync status is" },
        { value: "is_not", label: "Is not", chipLabel: "Sync status is not" },
      ],
    },
  ];

  const renderBar = (filters: { field: string; operator: string; values: string[] }[] = []) => {
    const onFiltersChange = vi.fn();
    const view = render(
      <SearchField
        value=""
        onChange={vi.fn()}
        fields={fields}
        filters={filters}
        onFiltersChange={onFiltersChange}
        labels={LABELS}
      />,
    );
    const field = screen.getByRole("combobox") as HTMLDivElement;
    return { ...view, field, onFiltersChange };
  };

  const options = () =>
    screen.queryAllByRole("option").map((o) => o.textContent?.replace("Enter", ""));

  it("b1: focus opens the field list, nothing highlighted", () => {
    const { field } = renderBar();
    fireEvent.focus(field);
    expect(options()).toEqual(["Sync status"]);
    expect(field.getAttribute("aria-expanded")).toBe("true");
    expect(field.getAttribute("aria-activedescendant")).toBeNull();
  });

  it("b10-b12: a field becomes a chip with its values open; ticking one commits it", () => {
    const { field, container, onFiltersChange } = renderBar();
    fireEvent.focus(field);
    fireEvent.click(screen.getByText("Sync status"));
    expect(container.querySelector('[data-parity="param-chip"]')?.textContent).toBe(
      "Sync status is",
    );
    expect(options()).toEqual(["Synced", "Unmatched", "Is", "Is not"]);
    fireEvent.click(screen.getByText("Synced"));
    expect(onFiltersChange).toHaveBeenLastCalledWith([
      { field: "status", operator: "is", values: ["synced"] },
    ]);
    expect(container.querySelector('[data-parity="value-chip"]')?.textContent).toContain("Synced");
  });

  it("b14: Is not from the values' conditions changes the chip and keeps the values open", () => {
    const { field, container, onFiltersChange } = renderBar();
    fireEvent.focus(field);
    fireEvent.click(screen.getByText("Sync status"));
    fireEvent.click(screen.getByText("Synced"));
    fireEvent.click(screen.getByText("Is not"));
    expect(container.querySelector('[data-parity="param-chip"]')?.textContent).toBe(
      "Sync status is not",
    );
    expect(onFiltersChange).toHaveBeenLastCalledWith([
      { field: "status", operator: "is_not", values: ["synced"] },
    ]);
    expect(options()).toContain("Synced");
  });

  it("b33: the param chip opens Is / Is not; picking one moves on to the values", () => {
    const { field, container } = renderBar([
      { field: "status", operator: "is", values: ["synced"] },
    ]);
    fireEvent.focus(field);
    const param = container.querySelector('[data-parity="param-chip"]') as HTMLElement;
    fireEvent.pointerDown(param);
    expect(options()).toEqual(["Is", "Is not"]);
    fireEvent.click(screen.getByText("Is not"));
    expect(options()).toEqual(["Synced", "Unmatched", "Is", "Is not"]);
  });

  it("draws the page's filters as chips, and removing one commits none", () => {
    const { container, onFiltersChange } = renderBar([
      { field: "status", operator: "is", values: ["synced", "unmatched"] },
    ]);
    expect(container.querySelector('[data-parity="value-chip"]')?.textContent).toContain(
      "Synced, Unmatched",
    );
    const remove = container.querySelector('[data-parity="chip-remove"]') as HTMLElement;
    fireEvent.pointerDown(remove);
    expect(onFiltersChange).not.toHaveBeenCalled();
    fireEvent.click(remove);
    expect(onFiltersChange).toHaveBeenLastCalledWith([]);
    expect(container.querySelector('[data-parity="filter-unit"]')).toBeNull();
  });

  it("logic 62: focus without a click puts the caret at the end", () => {
    const { field } = renderBar([{ field: "status", operator: "is", values: ["synced"] }]);
    fireEvent.focus(field);
    const range = document.getSelection()?.getRangeAt(0);
    expect(range?.startContainer).toBe(field);
    expect(range?.startOffset).toBe(field.childNodes.length);
  });
  // Types at the caret as the browser would: into the text node after the unit.
  const typeAfterUnit = (field: HTMLDivElement, text: string) => {
    const span = field.querySelector('[data-parity="filter-unit"]') as HTMLElement;
    const node = document.createTextNode(text);
    span.after(node);
    const range = document.createRange();
    range.setStart(node, text.length);
    range.collapse(true);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    fireEvent.input(field);
  };

  it("handler-diff 24: a new unit keeps the caret touching it, no space after", () => {
    const { field } = renderBar();
    fireEvent.focus(field);
    fireEvent.click(screen.getByText("Sync status"));
    const span = field.querySelector('[data-parity="filter-unit"]');
    expect(span?.nextSibling).toBeNull();
    const range = document.getSelection()?.getRangeAt(0);
    expect(range?.startContainer).toBe(field);
    expect(field.childNodes[(range?.startOffset ?? 0) - 1]).toBe(span);
  });

  it("handler-diff 26: typing after a new unit filters its values, not the search", () => {
    const onChange = vi.fn();
    render(
      <SearchField
        value=""
        onChange={onChange}
        fields={fields}
        filters={[]}
        onFiltersChange={vi.fn()}
        labels={LABELS}
      />,
    );
    const field = screen.getByRole("combobox") as HTMLDivElement;
    fireEvent.focus(field);
    fireEvent.click(screen.getByText("Sync status"));
    typeAfterUnit(field, "unm");
    expect(options()).toEqual(["Unmatched", "Is", "Is not"]);
    expect(onChange).toHaveBeenLastCalledWith("");
    typeAfterUnit(field, "zz");
    expect(options()).toEqual(["No options available"]);
  });

  it("handler-diff 26: picking a value takes the typed text out", () => {
    const { field, onFiltersChange } = renderBar();
    fireEvent.focus(field);
    fireEvent.click(screen.getByText("Sync status"));
    typeAfterUnit(field, "unm");
    fireEvent.click(screen.getByText("Unmatched"));
    expect(onFiltersChange).toHaveBeenLastCalledWith([
      { field: "status", operator: "is", values: ["unmatched"] },
    ]);
    expect(field.textContent).not.toContain("unm");
    expect(options()).toEqual(["Synced", "Unmatched", "Is", "Is not"]);
  });

  it("handler-diff 14: a click in the text releases an open chip", () => {
    const { field, container } = renderBar([
      { field: "status", operator: "is", values: ["synced"] },
    ]);
    fireEvent.focus(field);
    fireEvent.pointerDown(container.querySelector('[data-parity="param-chip"]') as HTMLElement);
    expect(options()).toEqual(["Is", "Is not"]);
    const space = field.lastChild as Text;
    const range = document.createRange();
    range.setStart(space, space.length);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    fireEvent.click(field);
    expect(options()).toEqual([]);
    expect(container.querySelector('[data-parity="param-chip"]')?.className).not.toMatch(/active/);
  });

  it("handler-diff 45: Up and Down never move the caret", () => {
    const { field } = renderBar();
    fireEvent.focus(field);
    fireEvent.keyDown(field, { key: "Escape" });
    const event = new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true });
    field.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("handler-diff 38: Escape twice on a chip leaves it without opening the field list", () => {
    const { field, container } = renderBar([
      { field: "status", operator: "is", values: ["synced"] },
    ]);
    fireEvent.focus(field);
    fireEvent.pointerDown(container.querySelector('[data-parity="value-chip"]') as HTMLElement);
    expect(options()).toContain("Synced");
    fireEvent.keyDown(field, { key: "Escape" });
    fireEvent.keyDown(field, { key: "Escape" });
    expect(options()).toEqual([]);
    expect(container.querySelector('[data-parity="value-chip"]')?.className).not.toMatch(/active/);
  });
  it("logic 62: back on the tab after a click on a chip, the caret goes to the end", () => {
    const { field, container } = renderBar([
      { field: "status", operator: "is", values: ["synced"] },
    ]);
    const now = vi.spyOn(performance, "now").mockReturnValue(1000);
    const param = container.querySelector('[data-parity="param-chip"]') as HTMLElement;
    fireEvent.pointerDown(param);
    fireEvent.blur(field);
    // Back on the tab a while later: no click, so focus is not from the pointer.
    now.mockReturnValue(10_000);
    fireEvent.focus(field);
    const range = document.getSelection()?.getRangeAt(0);
    expect(range?.startContainer).toBe(field);
    expect(range?.startOffset).toBe(field.childNodes.length);
    now.mockRestore();
  });

  it("handler-diff 48: Left from before a unit opens the unit before it, caret kept", () => {
    const { field } = renderBar([{ field: "status", operator: "is", values: ["synced"] }]);
    fireEvent.focus(field);
    // Caret at the end, past the unit's space.
    fireEvent.keyDown(field, { key: "ArrowLeft" });
    expect(options()).toEqual(["Synced", "Unmatched", "Is", "Is not"]);
    expect(document.getSelection()?.rangeCount).toBe(1);
  });
  const addButton = () => screen.queryByRole("button", { name: "Add new filter" });

  it("the + shows after a value is ticked, stays on Enter, goes on other keys", () => {
    const { field } = renderBar();
    fireEvent.focus(field);
    fireEvent.click(screen.getByText("Sync status"));
    expect(addButton()).toBeNull();
    fireEvent.keyDown(field, { key: "Enter" });
    expect(addButton()).not.toBeNull();
    fireEvent.keyDown(field, { key: "ArrowDown" });
    expect(addButton()).not.toBeNull();
    fireEvent.keyDown(field, { key: "Escape" });
    expect(addButton()).toBeNull();
  });

  it("the + comes back a second after typing stops", () => {
    vi.useFakeTimers();
    try {
      const { field } = renderBar([{ field: "status", operator: "is", values: ["synced"] }]);
      fireEvent.focus(field);
      expect(addButton()).toBeNull();
      fireEvent.input(field);
      act(() => vi.advanceTimersByTime(999));
      expect(addButton()).toBeNull();
      act(() => vi.advanceTimersByTime(1));
      expect(addButton()).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("the + opens the field list at the end; its tooltip shows after 400ms", async () => {
    vi.useFakeTimers();
    try {
      const { field } = renderBar([{ field: "status", operator: "is", values: ["synced"] }]);
      fireEvent.focus(field);
      fireEvent.input(field);
      act(() => vi.advanceTimersByTime(1000));
      const button = addButton() as HTMLElement;
      fireEvent.mouseEnter(button);
      act(() => vi.advanceTimersByTime(399));
      expect(screen.queryByRole("tooltip")).toBeNull();
      act(() => vi.advanceTimersByTime(1));
      expect(screen.getByRole("tooltip").textContent).toBe("Add new filter");
      fireEvent.click(button);
      expect(screen.queryByRole("tooltip")).toBeNull();
      expect(addButton()).toBeNull();
      vi.useRealTimers();
      await act(() => new Promise((resolve) => requestAnimationFrame(resolve)));
      // The only field is in use, so the list is empty; the caret is at the end.
      const range = document.getSelection()?.getRangeAt(0);
      expect(range?.startContainer).toBe(field);
      expect(range?.startOffset).toBe(field.childNodes.length);
    } finally {
      vi.useRealTimers();
    }
  });
  it("logic 41: Backspace with the caret touching a unit removes it", () => {
    const { field, onFiltersChange } = renderBar([
      { field: "status", operator: "is", values: ["synced"] },
    ]);
    fireEvent.focus(field);
    fireEvent.keyDown(field, { key: "Backspace" });
    expect(options()).toEqual(["Synced", "Unmatched", "Is", "Is not"]);
    fireEvent.keyDown(field, { key: "Backspace" });
    expect(onFiltersChange).toHaveBeenLastCalledWith([]);
    expect(field.querySelector('[data-parity="filter-unit"]')).toBeNull();
  });

  it("logic 44: Left walks values, condition, then out before the unit", () => {
    const { field, container } = renderBar([
      { field: "status", operator: "is", values: ["synced"] },
    ]);
    fireEvent.focus(field);
    fireEvent.keyDown(field, { key: "ArrowLeft" });
    expect(options()).toEqual(["Synced", "Unmatched", "Is", "Is not"]);
    fireEvent.keyDown(field, { key: "ArrowLeft" });
    expect(options()).toEqual(["Is", "Is not"]);
    expect(container.querySelector('[data-parity="param-chip"]')?.className).toMatch(/active/);
    fireEvent.keyDown(field, { key: "ArrowLeft" });
    const range = document.getSelection()?.getRangeAt(0);
    expect(range?.startContainer).toBe(field);
    expect(range?.startOffset).toBe(0);
  });

  it("logic 85: copy writes the units as words", () => {
    const { field } = renderBar([{ field: "status", operator: "is_not", values: ["synced"] }]);
    const setData = vi.fn();
    fireEvent.copy(field, { clipboardData: { setData } });
    expect(setData).toHaveBeenCalledWith("text/plain", "Sync status is not Synced");
  });
});

describe("SearchField number filters (number-filters.md)", () => {
  const available = {
    key: "available",
    name: "Available",
    kind: "number" as const,
    number: { minPrecision: 0, maxPrecision: 0 },
    multi: false,
    values: [],
    operators: [
      { value: "is", label: "Is", chipLabel: "Available is" },
      { value: "between", label: "Is between", chipLabel: "Available is between", range: true },
      { value: "gt", label: "Is greater than", chipLabel: "Available is greater than" },
      { value: "lt", label: "Is less than", chipLabel: "Available is less than" },
      { value: "is_not", label: "Is not", chipLabel: "Available is not" },
    ],
  };

  const renderBar = (filters: { field: string; operator: string; values: string[] }[] = []) => {
    const onFiltersChange = vi.fn();
    const view = render(
      <SearchField
        value=""
        onChange={vi.fn()}
        fields={[available]}
        filters={filters}
        onFiltersChange={onFiltersChange}
        labels={LABELS}
      />,
    );
    const field = screen.getByRole("combobox") as HTMLDivElement;
    return { ...view, field, onFiltersChange };
  };
  const inputs = (field: HTMLElement) => [...field.querySelectorAll<HTMLElement>("[data-input]")];
  const options = () =>
    screen.queryAllByRole("option").map((o) => o.textContent?.replace("Enter", ""));
  const type = (input: HTMLElement, text: string) => {
    input.textContent = text;
    fireEvent.input(input);
  };
  const create = () => {
    const view = renderBar();
    fireEvent.focus(view.field);
    fireEvent.click(screen.getByText("Available"));
    return view;
  };

  it("22-23: picking the field focuses its number, with no popover", () => {
    const { field } = create();
    expect(document.activeElement).toBe(inputs(field)[0]);
    expect(options()).toEqual([]);
  });

  it("36, 42: typing applies nothing; Enter applies the number and leaves the bar", () => {
    const { field, onFiltersChange } = create();
    const [input] = inputs(field) as [HTMLElement];
    type(input, "5");
    expect(onFiltersChange).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onFiltersChange).toHaveBeenLastCalledWith([
      { field: "available", operator: "is", values: ["5"] },
    ]);
    expect(document.activeElement).not.toBe(input);
  });

  it("28: letters are blocked in a number", () => {
    const { field } = create();
    const [input] = inputs(field) as [HTMLElement];
    const event = new KeyboardEvent("keydown", { key: "a", bubbles: true, cancelable: true });
    input.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("48: Backspace at the start of the number removes the filter", () => {
    const { field } = create();
    const [input] = inputs(field) as [HTMLElement];
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(field.querySelector('[data-parity="filter-unit"]')).toBeNull();
  });

  it("55-56: Is between keeps the number as the first, applies, and selects it", () => {
    const { field, container, onFiltersChange } = renderBar([
      { field: "available", operator: "is", values: ["5"] },
    ]);
    fireEvent.focus(field);
    fireEvent.pointerDown(container.querySelector('[data-parity="param-chip"]') as HTMLElement);
    expect(options()).toEqual(["Is", "Is between", "Is greater than", "Is less than", "Is not"]);
    fireEvent.click(screen.getByText("Is between"));
    expect(onFiltersChange).toHaveBeenLastCalledWith([
      { field: "available", operator: "between", values: ["5", ""] },
    ]);
    const [first, second] = inputs(field);
    expect(first?.textContent).toBe("5");
    expect(second?.textContent).toBe("");
    expect(document.activeElement).toBe(first);
  });

  it("37, 43: Tab and Enter go from the first number to the second without applying", () => {
    const { field, onFiltersChange } = renderBar([
      { field: "available", operator: "between", values: ["5", ""] },
    ]);
    fireEvent.focus(field);
    const [first, second] = inputs(field) as [HTMLElement, HTMLElement];
    first.focus();
    fireEvent.keyDown(first, { key: "Tab" });
    expect(document.activeElement).toBe(second);
    first.focus();
    fireEvent.keyDown(first, { key: "Enter" });
    expect(document.activeElement).toBe(second);
    expect(onFiltersChange).not.toHaveBeenCalled();
    type(second, "20");
    fireEvent.keyDown(second, { key: "Enter" });
    expect(onFiltersChange).toHaveBeenLastCalledWith([
      { field: "available", operator: "between", values: ["5", "20"] },
    ]);
  });

  it("39: a half range applies its one end", () => {
    const { field, onFiltersChange } = renderBar([
      { field: "available", operator: "between", values: ["5", ""] },
    ]);
    fireEvent.focus(field);
    const [first, second] = inputs(field) as [HTMLElement, HTMLElement];
    second.focus();
    type(first, "");
    type(second, "9");
    fireEvent.keyDown(second, { key: "Enter" });
    expect(onFiltersChange).toHaveBeenLastCalledWith([
      { field: "available", operator: "between", values: ["", "9"] },
    ]);
  });

  it("64: leaving the bar drops a number filter with nothing typed", () => {
    const { field, onFiltersChange } = create();
    const [input] = inputs(field) as [HTMLElement];
    fireEvent.blur(input, { relatedTarget: null });
    expect(field.querySelector('[data-parity="filter-unit"]')).toBeNull();
    expect(onFiltersChange).toHaveBeenLastCalledWith([]);
  });

  it("copy writes a range as words", () => {
    const { field } = renderBar([{ field: "available", operator: "between", values: ["5", "20"] }]);
    const setData = vi.fn();
    fireEvent.copy(field, { clipboardData: { setData } });
    expect(setData).toHaveBeenCalledWith("text/plain", "Available is between 5 – 20");
  });
});

describe("SearchField date filters (date-filters.md)", () => {
  const dateField = {
    key: "date",
    name: "Date",
    kind: "date" as const,
    multi: false,
    values: [
      { value: "today", label: "Today" },
      { value: "past_week", label: "Last 7 days" },
    ],
    operators: [
      { value: "is", label: "Is", chipLabel: "Date is" },
      { value: "is_not", label: "Is not", chipLabel: "Date is not" },
    ],
  };
  type Filter = { field: string; operator: string; values: string[]; shape?: "date" | "range" };

  const renderBar = (filters: Filter[] = []) => {
    const onFiltersChange = vi.fn();
    const view = render(
      <SearchField
        value=""
        onChange={vi.fn()}
        fields={[dateField]}
        filters={filters}
        onFiltersChange={onFiltersChange}
        labels={LABELS}
      />,
    );
    const field = screen.getByRole("combobox") as HTMLDivElement;
    return { ...view, field, onFiltersChange };
  };
  const options = () =>
    screen.queryAllByRole("option").map((o) => o.textContent?.replace("Enter", ""));
  const parts = (field: HTMLElement) => [
    ...field.querySelectorAll<HTMLElement>("[data-date-part]"),
  ];
  const type = (part: HTMLElement, text: string) => {
    part.textContent = text;
    fireEvent.input(part);
  };
  const pickCustom = (label: "Custom date" | "Custom range") => {
    const view = renderBar();
    fireEvent.focus(view.field);
    fireEvent.click(screen.getByText("Date"));
    fireEvent.click(screen.getByText(label));
    return view;
  };

  it("2, 23: the values list presets, then Custom date and Custom range; a preset applies as a list value", () => {
    const { field, onFiltersChange } = renderBar();
    fireEvent.focus(field);
    fireEvent.click(screen.getByText("Date"));
    expect(options()).toEqual([
      "Today",
      "Last 7 days",
      "Custom date",
      "Custom range",
      "Is",
      "Is not",
    ]);
    fireEvent.click(screen.getByText("Last 7 days"));
    expect(onFiltersChange).toHaveBeenLastCalledWith([
      { field: "date", operator: "is", values: ["past_week"] },
    ]);
  });

  it("24-26: Custom date turns the chip into YYYY-MM-DD and focuses the year, no list", () => {
    const { field } = pickCustom("Custom date");
    const [year, month, day] = parts(field);
    expect([year, month, day].map((p) => p?.dataset.placeholder)).toEqual(["YYYY", "MM", "DD"]);
    expect(document.activeElement).toBe(year);
    expect(options()).toEqual([]);
  });

  it("50, 53: typing applies nothing; Enter on a real date applies it and leaves", () => {
    const { field, onFiltersChange } = pickCustom("Custom date");
    const [year, month, day] = parts(field) as [HTMLElement, HTMLElement, HTMLElement];
    type(year, "2026");
    type(month, "11");
    type(day, "3");
    expect(onFiltersChange).toHaveBeenCalledTimes(1);
    day.focus();
    fireEvent.keyDown(day, { key: "Enter" });
    expect(onFiltersChange).toHaveBeenLastCalledWith([
      { field: "date", operator: "is", values: ["2026-11-03"], shape: "date" },
    ]);
    expect(day.textContent).toBe("03");
    expect(document.activeElement).not.toBe(day);
  });

  it("47: a date that is not real does not apply", () => {
    const { field, onFiltersChange } = pickCustom("Custom date");
    const [year, month, day] = parts(field) as [HTMLElement, HTMLElement, HTMLElement];
    type(year, "2026");
    type(month, "02");
    type(day, "31");
    day.focus();
    fireEvent.keyDown(day, { key: "Enter" });
    expect(onFiltersChange).toHaveBeenLastCalledWith([]);
  });

  it("56: Backspace at the start of the month goes back to the year; at the year it removes the filter", () => {
    const { field } = pickCustom("Custom date");
    const [year, month] = parts(field) as [HTMLElement, HTMLElement];
    month.focus();
    fireEvent.keyDown(month, { key: "Backspace" });
    expect(document.activeElement).toBe(year);
    fireEvent.keyDown(year, { key: "Backspace" });
    expect(field.querySelector('[data-parity="filter-unit"]')).toBeNull();
  });

  it("37, 51: a range applies its start as a half range, and both once Ending is set", () => {
    const { field, onFiltersChange } = pickCustom("Custom range");
    expect(field.textContent).toContain("Starting");
    expect(field.textContent).toContain("Ending");
    const all = parts(field) as HTMLElement[];
    type(all[0] as HTMLElement, "2026");
    type(all[1] as HTMLElement, "11");
    type(all[2] as HTMLElement, "10");
    (all[2] as HTMLElement).focus();
    fireEvent.keyDown(all[2] as HTMLElement, { key: "Enter" });
    expect(document.activeElement).toBe(all[3]);
    expect(onFiltersChange).toHaveBeenLastCalledWith([
      { field: "date", operator: "is", values: ["2026-11-10", ""], shape: "range" },
    ]);
    type(all[3] as HTMLElement, "2026");
    type(all[4] as HTMLElement, "11");
    type(all[5] as HTMLElement, "20");
    (all[5] as HTMLElement).focus();
    fireEvent.keyDown(all[5] as HTMLElement, { key: "Enter" });
    expect(onFiltersChange).toHaveBeenLastCalledWith([
      { field: "date", operator: "is", values: ["2026-11-10", "2026-11-20"], shape: "range" },
    ]);
  });

  it("60: Is not on a range keeps its start as one date and applies", () => {
    const { field, container, onFiltersChange } = renderBar([
      { field: "date", operator: "is", values: ["2026-11-10", "2026-11-20"], shape: "range" },
    ]);
    fireEvent.focus(field);
    fireEvent.pointerDown(container.querySelector('[data-parity="param-chip"]') as HTMLElement);
    fireEvent.click(screen.getByText("Is not"));
    expect(onFiltersChange).toHaveBeenLastCalledWith([
      { field: "date", operator: "is_not", values: ["2026-11-10"], shape: "date" },
    ]);
    expect(parts(field)).toHaveLength(3);
  });

  it("the calendar's own buttons taking focus keep the filter and hand focus back", async () => {
    const { field, container } = pickCustom("Custom date");
    const [year] = parts(field) as [HTMLElement];
    const calendar = container.querySelector('[data-parity="date-calendar"]') as HTMLElement;
    expect(calendar).not.toBeNull();
    fireEvent.blur(year, { relatedTarget: calendar });
    expect(field.querySelector('[data-parity="filter-unit"]')).not.toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(document.activeElement).toBe(year);
  });

  it("59: on a range neither Is nor Is not is ticked", () => {
    const { field, container } = renderBar([
      { field: "date", operator: "is", values: ["2026-11-10", ""], shape: "range" },
    ]);
    fireEvent.focus(field);
    fireEvent.pointerDown(container.querySelector('[data-parity="param-chip"]') as HTMLElement);
    const ticked = screen
      .getAllByRole("option")
      .filter((o) => o.getAttribute("aria-selected") === "true");
    expect(ticked).toEqual([]);
  });

  it("70: leaving the bar drops a date with nothing typed", () => {
    const { field, onFiltersChange } = pickCustom("Custom date");
    const [year] = parts(field) as [HTMLElement];
    fireEvent.blur(year, { relatedTarget: null });
    expect(field.querySelector('[data-parity="filter-unit"]')).toBeNull();
    expect(onFiltersChange).toHaveBeenLastCalledWith([]);
  });

  it("copy writes a range as words", () => {
    const { field } = renderBar([
      { field: "date", operator: "is", values: ["2026-11-10", "2026-11-20"], shape: "range" },
    ]);
    const setData = vi.fn();
    fireEvent.copy(field, { clipboardData: { setData } });
    expect(setData).toHaveBeenCalledWith(
      "text/plain",
      "Date is Starting 2026-11-10 – Ending 2026-11-20",
    );
  });
});

describe("SearchField text filters (text-filters.md)", () => {
  const card = {
    key: "credit_card_last4",
    name: "Credit card (last 4 digits)",
    kind: "text" as const,
    text: { placeholder: "xxxx", maxLength: 4 },
    multi: false,
    values: [],
    operators: [
      { value: "is", label: "Is", chipLabel: "Credit card (last 4 digits) is" },
      { value: "is_not", label: "Is not", chipLabel: "Credit card (last 4 digits) is not" },
    ],
  };
  const renderBar = (filters: { field: string; operator: string; values: string[] }[] = []) => {
    const onFiltersChange = vi.fn();
    const view = render(
      <SearchField
        value=""
        onChange={vi.fn()}
        fields={[card]}
        filters={filters}
        onFiltersChange={onFiltersChange}
        labels={LABELS}
      />,
    );
    const field = screen.getByRole("combobox") as HTMLDivElement;
    return { ...view, field, onFiltersChange };
  };
  const textInput = (field: HTMLElement) =>
    field.querySelector<HTMLElement>("[data-input]") as HTMLElement;
  const create = () => {
    const view = renderBar();
    fireEvent.focus(view.field);
    fireEvent.click(screen.getByText("Credit card (last 4 digits)"));
    return view;
  };
  const type = (input: HTMLElement, text: string) => {
    input.textContent = text;
    fireEvent.input(input);
  };

  it("20-21: picking the field focuses its text, with the field's placeholder, no popover", () => {
    const { field } = create();
    const input = textInput(field);
    expect(document.activeElement).toBe(input);
    expect(input.dataset.placeholder).toBe("xxxx");
    expect(screen.queryAllByRole("option")).toEqual([]);
  });

  it("22-23: letters are typed; the length stops more", () => {
    const { field } = create();
    const input = textInput(field);
    const letter = new KeyboardEvent("keydown", { key: "a", bubbles: true, cancelable: true });
    input.dispatchEvent(letter);
    expect(letter.defaultPrevented).toBe(false);
    type(input, "12ab");
    const fifth = new KeyboardEvent("keydown", { key: "5", bubbles: true, cancelable: true });
    input.dispatchEvent(fifth);
    expect(fifth.defaultPrevented).toBe(true);
  });

  it("33, 36: typing applies nothing; Enter applies the trimmed text and leaves", () => {
    const { field, onFiltersChange } = create();
    const input = textInput(field);
    type(input, " 12ab ");
    expect(onFiltersChange).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onFiltersChange).toHaveBeenLastCalledWith([
      { field: "credit_card_last4", operator: "is", values: ["12ab"] },
    ]);
    expect(document.activeElement).not.toBe(input);
  });

  it("46-47: Is not keeps the text, applies, and puts focus back in it", () => {
    const { field, container, onFiltersChange } = renderBar([
      { field: "credit_card_last4", operator: "is", values: ["12ab"] },
    ]);
    fireEvent.focus(field);
    fireEvent.pointerDown(container.querySelector('[data-parity="param-chip"]') as HTMLElement);
    fireEvent.click(screen.getByText("Is not"));
    expect(onFiltersChange).toHaveBeenLastCalledWith([
      { field: "credit_card_last4", operator: "is_not", values: ["12ab"] },
    ]);
    expect(document.activeElement).toBe(textInput(field));
  });

  it("40: Backspace at the start of an empty text removes it", () => {
    const { field } = create();
    fireEvent.keyDown(textInput(field), { key: "Backspace" });
    expect(field.querySelector('[data-parity="filter-unit"]')).toBeNull();
  });

  it("40: Backspace at the start of a filled text steps out, keeping it (ours)", () => {
    const filled = renderBar([{ field: "credit_card_last4", operator: "is", values: ["12ab"] }]);
    fireEvent.focus(filled.field);
    const input = textInput(filled.field);
    input.focus();
    const range = document.createRange();
    range.setStart(input.firstChild as Node, 0);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(filled.field.querySelector('[data-parity="filter-unit"]')).not.toBeNull();
    expect(document.activeElement).toBe(filled.field);
  });

  it("54: leaving the bar drops an empty text filter", () => {
    const { field, onFiltersChange } = create();
    fireEvent.blur(textInput(field), { relatedTarget: null });
    expect(field.querySelector('[data-parity="filter-unit"]')).toBeNull();
    expect(onFiltersChange).toHaveBeenLastCalledWith([]);
  });

  it("copy writes the text filter as words", () => {
    const { field } = renderBar([
      { field: "credit_card_last4", operator: "is_not", values: ["12ab"] },
    ]);
    const setData = vi.fn();
    fireEvent.copy(field, { clipboardData: { setData } });
    expect(setData).toHaveBeenCalledWith("text/plain", "Credit card (last 4 digits) is not 12ab");
  });
});

describe("SearchField currency filters (currency-filters.md)", () => {
  const orderTotal = {
    key: "order_total",
    name: "Order total",
    kind: "number" as const,
    number: { minPrecision: 0, maxPrecision: 2, prefix: "USD $" },
    multi: false,
    values: [],
    operators: [
      { value: "between", label: "Is between", chipLabel: "Order total is between", range: true },
      { value: "gt", label: "Is greater than", chipLabel: "Order total is greater than" },
      { value: "lt", label: "Is less than", chipLabel: "Order total is less than" },
      { value: "is", label: "Is", chipLabel: "Order total is" },
      { value: "is_not", label: "Is not", chipLabel: "Order total is not" },
    ],
  };
  const renderBar = (filters: { field: string; operator: string; values: string[] }[] = []) => {
    const onFiltersChange = vi.fn();
    const view = render(
      <SearchField
        value=""
        onChange={vi.fn()}
        fields={[orderTotal]}
        filters={filters}
        onFiltersChange={onFiltersChange}
        labels={LABELS}
      />,
    );
    const field = screen.getByRole("combobox") as HTMLDivElement;
    return { ...view, field, onFiltersChange };
  };
  const inputs = (field: HTMLElement) => [...field.querySelectorAll<HTMLElement>("[data-input]")];
  const type = (input: HTMLElement, text: string) => {
    input.textContent = text;
    fireEvent.input(input);
  };

  it("the field starts as Is between, each amount after USD $", () => {
    const { field } = renderBar();
    fireEvent.focus(field);
    fireEvent.click(screen.getByText("Order total"));
    expect(field.querySelector('[data-parity="param-chip"]')?.textContent).toBe(
      "Order total is between",
    );
    expect(
      [...field.querySelectorAll('[data-parity^="number-prefix"]')].map((p) => p.textContent),
    ).toEqual(["USD $", "USD $"]);
    expect(inputs(field).map((i) => i.dataset.placeholder)).toEqual(["0.0", "0.0"]);
    expect(document.activeElement).toBe(inputs(field)[0]);
  });

  it("amounts with decimals apply as a range on Enter", () => {
    const { field, onFiltersChange } = renderBar();
    fireEvent.focus(field);
    fireEvent.click(screen.getByText("Order total"));
    const [first, second] = inputs(field) as [HTMLElement, HTMLElement];
    const dot = new KeyboardEvent("keydown", { key: ".", bubbles: true, cancelable: true });
    first.dispatchEvent(dot);
    expect(dot.defaultPrevented).toBe(false);
    type(first, "25.5");
    fireEvent.keyDown(first, { key: "Tab" });
    type(second, "100");
    fireEvent.keyDown(second, { key: "Enter" });
    expect(onFiltersChange).toHaveBeenLastCalledWith([
      { field: "order_total", operator: "between", values: ["25.5", "100"] },
    ]);
  });

  it("a single amount's placeholder is 0.00", () => {
    const { field, container } = renderBar([
      { field: "order_total", operator: "between", values: ["5", ""] },
    ]);
    fireEvent.focus(field);
    fireEvent.pointerDown(container.querySelector('[data-parity="param-chip"]') as HTMLElement);
    fireEvent.click(screen.getByText("Is greater than"));
    expect(inputs(field).map((i) => i.dataset.placeholder)).toEqual(["0.00"]);
  });

  it("copy writes the amounts with their currency", () => {
    const { field } = renderBar([
      { field: "order_total", operator: "between", values: ["25.5", "100"] },
    ]);
    const setData = vi.fn();
    fireEvent.copy(field, { clipboardData: { setData } });
    expect(setData).toHaveBeenCalledWith(
      "text/plain",
      "Order total is between USD $25.5 – USD $100",
    );
  });
});

describe("SearchField measurement filters (measurement-filters.md)", () => {
  const weight = {
    key: "total_weight",
    name: "Total product weight",
    kind: "number" as const,
    number: { minPrecision: 0, maxPrecision: 4, suffix: "lb" },
    multi: false,
    values: [],
    operators: [
      {
        value: "between",
        label: "Is between",
        chipLabel: "Total product weight is between",
        range: true,
      },
      { value: "gt", label: "Is greater than", chipLabel: "Total product weight is greater than" },
      { value: "lt", label: "Is less than", chipLabel: "Total product weight is less than" },
      { value: "is", label: "Is", chipLabel: "Total product weight is" },
      { value: "is_not", label: "Is not", chipLabel: "Total product weight is not" },
    ],
  };
  const renderBar = (filters: { field: string; operator: string; values: string[] }[] = []) => {
    const onFiltersChange = vi.fn();
    const view = render(
      <SearchField
        value=""
        onChange={vi.fn()}
        fields={[weight]}
        filters={filters}
        onFiltersChange={onFiltersChange}
        labels={LABELS}
      />,
    );
    const field = screen.getByRole("combobox") as HTMLDivElement;
    return { ...view, field, onFiltersChange };
  };
  const inputs = (field: HTMLElement) => [...field.querySelectorAll<HTMLElement>("[data-input]")];
  const type = (input: HTMLElement, text: string) => {
    input.textContent = text;
    fireEvent.input(input);
  };

  it("the field starts as Is between, lb after each number", () => {
    const { field } = renderBar();
    fireEvent.focus(field);
    fireEvent.click(screen.getByText("Total product weight"));
    expect(
      [...field.querySelectorAll('[data-parity^="number-suffix"]')].map((p) => p.textContent),
    ).toEqual(["lb", "lb"]);
    expect(inputs(field).map((i) => i.dataset.placeholder)).toEqual(["0.0", "0.0"]);
  });

  it("weights apply as a range on Enter, with up to four decimals", () => {
    const { field, onFiltersChange } = renderBar();
    fireEvent.focus(field);
    fireEvent.click(screen.getByText("Total product weight"));
    const [first, second] = inputs(field) as [HTMLElement, HTMLElement];
    type(first, "2.5");
    type(second, "10.1234");
    const fifth = new KeyboardEvent("keydown", { key: "5", bubbles: true, cancelable: true });
    const range = document.createRange();
    range.selectNodeContents(second);
    range.collapse(false);
    second.focus();
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    second.dispatchEvent(fifth);
    expect(fifth.defaultPrevented).toBe(true);
    fireEvent.keyDown(second, { key: "Enter" });
    expect(onFiltersChange).toHaveBeenLastCalledWith([
      { field: "total_weight", operator: "between", values: ["2.5", "10.1234"] },
    ]);
  });

  it("copy writes the weights with their unit", () => {
    const { field } = renderBar([
      { field: "total_weight", operator: "between", values: ["2.5", "10"] },
    ]);
    const setData = vi.fn();
    fireEvent.copy(field, { clipboardData: { setData } });
    expect(setData).toHaveBeenCalledWith(
      "text/plain",
      "Total product weight is between 2.5 lb – 10 lb",
    );
  });
});

describe("SearchField read-only filters (readonly-filters.md)", () => {
  const variant = {
    key: "product_variant",
    name: "Product variant",
    readOnly: true,
    multi: false,
    values: [{ value: "1", label: "The Collection Snowboard: Hydrogen - Default Title" }],
    operators: [{ value: "is", label: "Is", chipLabel: "Product variant is" }],
  };
  const vendor = {
    key: "vendor",
    name: "Vendor",
    multi: true,
    values: [{ value: "acme", label: "Acme" }],
    operators: [{ value: "is", label: "Is", chipLabel: "Vendor is" }],
  };
  const PUT_IN = [{ field: "product_variant", operator: "is", values: ["1"] }];
  const renderBar = (filters = PUT_IN) => {
    const onFiltersChange = vi.fn();
    const view = render(
      <SearchField
        value=""
        onChange={vi.fn()}
        fields={[variant, vendor]}
        filters={filters}
        onFiltersChange={onFiltersChange}
        labels={LABELS}
      />,
    );
    const field = screen.getByRole("combobox") as HTMLDivElement;
    return { ...view, field, onFiltersChange };
  };
  const unit = (field: HTMLElement) => field.querySelector('[data-parity="filter-unit"]');
  const caretAtEnd = (field: HTMLElement) => {
    const range = document.createRange();
    range.selectNodeContents(field);
    range.collapse(false);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
  };

  it("is never offered in the field list", () => {
    const { field } = renderBar([]);
    fireEvent.focus(field);
    expect(screen.queryAllByRole("option").map((o) => o.textContent?.replace("Enter", ""))).toEqual(
      ["Vendor"],
    );
  });

  it("shows its whole label", () => {
    const { field } = renderBar();
    expect(unit(field)?.textContent).toContain(
      "The Collection Snowboard: Hydrogen - Default Title",
    );
  });

  it("a press on it opens nothing", () => {
    const { field, container } = renderBar();
    fireEvent.focus(field);
    fireEvent.pointerDown(container.querySelector('[data-parity="param-chip"]') as HTMLElement);
    fireEvent.pointerDown(container.querySelector('[data-parity="value-chip"]') as HTMLElement);
    expect(screen.queryAllByRole("option").map((o) => o.textContent?.replace("Enter", ""))).toEqual(
      ["Vendor"],
    );
  });

  it("Backspace reaches it, then removes it", () => {
    const { field, onFiltersChange } = renderBar();
    fireEvent.focus(field);
    caretAtEnd(field);
    fireEvent.keyDown(field, { key: "Backspace" });
    expect(unit(field)).not.toBeNull();
    fireEvent.keyDown(field, { key: "Backspace" });
    expect(unit(field)).toBeNull();
    expect(onFiltersChange).toHaveBeenLastCalledWith([]);
  });

  it("Delete right before it removes it", () => {
    const { field } = renderBar();
    fireEvent.focus(field);
    const range = document.createRange();
    range.setStart(field, 0);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
    fireEvent.keyDown(field, { key: "Delete" });
    expect(unit(field)).toBeNull();
  });

  it("the x removes it", () => {
    const { field, container, onFiltersChange } = renderBar();
    fireEvent.focus(field);
    const remove = container.querySelector('[data-parity="chip-remove"]') as HTMLElement;
    fireEvent.pointerDown(remove);
    fireEvent.click(remove);
    expect(unit(field)).toBeNull();
    expect(onFiltersChange).toHaveBeenLastCalledWith([]);
  });

  it("copy writes it as words", () => {
    const { field } = renderBar();
    const setData = vi.fn();
    fireEvent.copy(field, { clipboardData: { setData } });
    expect(setData).toHaveBeenCalledWith(
      "text/plain",
      "Product variant is The Collection Snowboard: Hydrogen - Default Title",
    );
  });
});
