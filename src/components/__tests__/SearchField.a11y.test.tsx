import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FilterField } from "../../filters/types";
import { axeViolations } from "../../test/axe";
import { SearchField } from "../SearchField";

// What a screen reader is given (docs/research/index-filter-bar/accessibility.md,
// findings numbered there).

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

const isOps = (name: string) => [
  { value: "is", label: "Is", chipLabel: `${name} is` },
  { value: "is_not", label: "Is not", chipLabel: `${name} is not` },
];

const FIELDS: FilterField[] = [
  {
    key: "status",
    name: "Sync status",
    multi: true,
    values: [
      { value: "synced", label: "Synced" },
      { value: "unmatched", label: "Unmatched" },
    ],
    operators: isOps("Sync status"),
  },
  {
    key: "available",
    name: "Available",
    kind: "number",
    number: { minPrecision: 0, maxPrecision: 0 },
    multi: false,
    values: [],
    operators: [
      { value: "is", label: "Is", chipLabel: "Available is" },
      { value: "between", label: "Is between", chipLabel: "Available is between", range: true },
    ],
  },
  {
    key: "total",
    name: "Order total",
    kind: "number",
    number: { minPrecision: 0, maxPrecision: 2, prefix: "USD $" },
    multi: false,
    values: [],
    operators: [
      { value: "between", label: "Is between", chipLabel: "Order total is between", range: true },
    ],
  },
  {
    key: "date",
    name: "Date",
    kind: "date",
    multi: false,
    values: [{ value: "today", label: "Today" }],
    operators: isOps("Date"),
  },
  {
    key: "card",
    name: "Credit card (last 4 digits)",
    kind: "text",
    text: { placeholder: "xxxx", maxLength: 4 },
    multi: false,
    values: [],
    operators: isOps("Credit card (last 4 digits)"),
  },
];

type Filter = { field: string; operator: string; values: string[]; shape?: "date" | "range" };

const renderBar = (filters: Filter[] = []) => {
  const view = render(
    <SearchField
      value=""
      onChange={vi.fn()}
      fields={FIELDS}
      filters={filters}
      onFiltersChange={vi.fn()}
      labels={LABELS}
    />,
  );
  return { ...view, field: screen.getByRole("combobox") as HTMLDivElement };
};

const EVERY_TYPE: Filter[] = [
  { field: "status", operator: "is", values: ["synced"] },
  { field: "available", operator: "between", values: ["5", "20"] },
  { field: "total", operator: "between", values: ["25", "100"] },
  { field: "date", operator: "is", values: ["2026-11-03", "2026-11-12"], shape: "range" },
  { field: "card", operator: "is", values: ["1234"] },
];

afterEach(cleanup);

describe("SearchField accessibility", () => {
  it("a11y 1: every typed input is a named textbox with its hint", () => {
    const { container } = renderBar(EVERY_TYPE);
    const inputs = [...container.querySelectorAll("[data-input]")].map((input) => [
      input.getAttribute("role"),
      input.getAttribute("aria-label"),
      input.getAttribute("aria-placeholder"),
    ]);
    expect(inputs).toEqual([
      ["textbox", "Available, minimum", "0"],
      ["textbox", "Available, maximum", "0"],
      ["textbox", "Order total (USD $), minimum", expect.any(String)],
      ["textbox", "Order total (USD $), maximum", expect.any(String)],
      ["textbox", "Date, Starting year", "YYYY"],
      ["textbox", "Date, Starting month", "MM"],
      ["textbox", "Date, Starting day", "DD"],
      ["textbox", "Date, Ending year", "YYYY"],
      ["textbox", "Date, Ending month", "MM"],
      ["textbox", "Date, Ending day", "DD"],
      ["textbox", "Credit card (last 4 digits)", "xxxx"],
    ]);
  });

  it("a11y 4: each ✕ names the filter it removes", () => {
    const { container } = renderBar(EVERY_TYPE);
    const names = [...container.querySelectorAll("[data-part='remove']")].map((button) =>
      button.getAttribute("aria-label"),
    );
    expect(names).toEqual([
      "Remove Sync status is Synced",
      "Remove Available is between 5 – 20",
      "Remove Order total is between USD $25 – USD $100",
      "Remove Date is Starting 2026-11-03 – Ending 2026-11-12",
      "Remove Credit card (last 4 digits) is 1234",
    ]);
  });

  it("a11y 6: the field describes how chips are reached and removed", () => {
    const { field } = renderBar();
    const help = document.getElementById(field.getAttribute("aria-describedby") ?? "");
    expect(help?.textContent).toBe(LABELS.a11y.help);
  });

  it("a11y 2: the field list is 'Filters', a value list and its conditions are named for the field", () => {
    const { field, container } = renderBar([
      { field: "status", operator: "is", values: ["synced"] },
    ]);
    fireEvent.focus(field);
    expect(screen.getByRole("listbox").getAttribute("aria-label")).toBe("Filters");

    fireEvent.pointerDown(container.querySelector('[data-parity="value-chip"]') as HTMLElement);
    const [values, conditions] = screen.getAllByRole("listbox");
    expect(values?.getAttribute("aria-label")).toBe("Sync status values");
    expect(conditions?.getAttribute("aria-label")).toBe("Sync status condition");
    expect(field.getAttribute("aria-controls")?.split(" ")).toEqual([values?.id, conditions?.id]);

    fireEvent.pointerDown(container.querySelector('[data-parity="param-chip"]') as HTMLElement);
    expect(screen.getByRole("listbox").getAttribute("aria-label")).toBe("Sync status condition");
  });

  it("a11y 3: a multi-pick list is multiselectable, ticks are aria-selected, checkboxes only drawn", () => {
    const { field, container } = renderBar([
      { field: "status", operator: "is", values: ["synced"] },
    ]);
    fireEvent.focus(field);
    fireEvent.pointerDown(container.querySelector('[data-parity="value-chip"]') as HTMLElement);
    const values = screen.getAllByRole("listbox")[0] as HTMLElement;
    expect(values.getAttribute("aria-multiselectable")).toBe("true");
    const rows = [...values.querySelectorAll("[role=option]")].map((option) => [
      option.textContent?.replace("Enter", ""),
      option.getAttribute("aria-selected"),
      option.querySelector("s-checkbox")?.parentElement?.getAttribute("aria-hidden"),
    ]);
    expect(rows).toEqual([
      ["Synced", "true", "true"],
      ["Unmatched", "false", "true"],
    ]);
  });

  it("a11y: axe finds nothing with every filter type in the field", async () => {
    const { container } = renderBar(EVERY_TYPE);
    expect(await axeViolations(container)).toEqual([]);
  });

  it("a11y: axe finds nothing with the field list open", async () => {
    const { field } = renderBar();
    fireEvent.focus(field);
    expect(await axeViolations(document.body)).toEqual([]);
  });

  it("a11y: axe finds nothing with a value list and its conditions open", async () => {
    const { field, container } = renderBar([
      { field: "status", operator: "is", values: ["synced"] },
    ]);
    fireEvent.focus(field);
    fireEvent.pointerDown(container.querySelector('[data-parity="value-chip"]') as HTMLElement);
    expect(await axeViolations(document.body)).toEqual([]);
  });
});

describe("SearchField announcements (a11y 5)", () => {
  const said = (container: HTMLElement) =>
    container.querySelector('[data-parity="announcer"]')?.textContent ?? "";

  it("is a polite live region, silent for the page's own filters", () => {
    const { container } = renderBar([{ field: "status", operator: "is", values: ["synced"] }]);
    const region = container.querySelector('[data-parity="announcer"]');
    expect(region?.getAttribute("aria-live")).toBe("polite");
    expect(said(container)).toBe("");
  });

  it("says a filter added, then changed", async () => {
    const { field, container } = renderBar();
    fireEvent.focus(field);
    fireEvent.click(screen.getByRole("option", { name: "Sync status" }));
    fireEvent.click(screen.getByRole("option", { name: "Synced" }));
    await waitFor(() => expect(said(container)).toBe("Filter added: Sync status is Synced"));
    fireEvent.click(screen.getByRole("option", { name: "Unmatched" }));
    await waitFor(() =>
      expect(said(container)).toBe("Filter changed: Sync status is Synced, Unmatched"),
    );
  });

  it("says a filter removed", async () => {
    const { container } = renderBar([{ field: "status", operator: "is", values: ["synced"] }]);
    fireEvent.click(container.querySelector('[data-parity="chip-remove"]') as HTMLElement);
    await waitFor(() => expect(said(container)).toBe("Filter removed: Sync status is Synced"));
  });

  it("says a chip's words and how to remove it when it becomes active", async () => {
    const { field, container } = renderBar([
      { field: "status", operator: "is", values: ["synced"] },
    ]);
    fireEvent.focus(field);
    fireEvent.pointerDown(container.querySelector('[data-parity="value-chip"]') as HTMLElement);
    await waitFor(() =>
      expect(said(container)).toBe("Sync status is Synced. Backspace removes it."),
    );
  });
});
