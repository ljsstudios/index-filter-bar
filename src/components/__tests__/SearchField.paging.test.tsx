import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FilterField, FilterValue } from "../../filters/types";
import { SearchField } from "../SearchField";

// Long value lists, a page at a time, as the admin's are: 25 of a list the
// page holds, more on scrolling to the end; a server list fetched by
// fetchMoreValues, with a loading row, searched 250ms after typing.

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
    help: "Type to search.",
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
    loading: "Loading",
  },
};

const typeValues = (count: number, from = 1): FilterValue[] =>
  Array.from({ length: count }, (_, i) => {
    const n = String(from + i).padStart(3, "0");
    return { value: `type-${n}`, label: `Type ${n}` };
  });

const OPERATORS = [
  { value: "is", label: "Is", chipLabel: "Product type is" },
  { value: "is_not", label: "Is not", chipLabel: "Product type is not" },
];

const valueOptions = () =>
  screen
    .queryAllByRole("option")
    .map((o) => o.textContent?.replace("Enter", ""))
    .filter((text) => text?.startsWith("Type"));

/** Scrolls the values' pane to its end. */
const scrollToEnd = () => {
  const pane = screen.getByRole("listbox", { name: "Product type values" })
    .parentElement as HTMLElement;
  Object.defineProperty(pane, "scrollHeight", { value: 1000, configurable: true });
  Object.defineProperty(pane, "clientHeight", { value: 292, configurable: true });
  pane.scrollTop = 708;
  fireEvent.scroll(pane);
};

const typeAfterUnit = (field: HTMLDivElement, text: string) => {
  const span = field.querySelector('[data-parity="filter-unit"]') as HTMLElement;
  span.nextSibling?.nodeType === Node.TEXT_NODE && span.nextSibling.remove();
  const node = document.createTextNode(text);
  span.after(node);
  const range = document.createRange();
  range.setStart(node, text.length);
  range.collapse(true);
  document.getSelection()?.removeAllRanges();
  document.getSelection()?.addRange(range);
  fireEvent.input(field);
};

const openValues = (field: HTMLDivElement) => {
  fireEvent.focus(field);
  fireEvent.click(screen.getByText("Product type"));
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("a long list the page holds", () => {
  const field: FilterField = {
    key: "type",
    name: "Product type",
    multi: true,
    values: typeValues(60),
    operators: OPERATORS,
  };
  const renderBar = () => {
    render(
      <SearchField
        value=""
        onChange={vi.fn()}
        fields={[field]}
        filters={[]}
        onFiltersChange={vi.fn()}
        labels={LABELS}
      />,
    );
    return screen.getByRole("combobox") as HTMLDivElement;
  };

  it("shows 25, then 25 more at each scroll to the end", () => {
    openValues(renderBar());
    expect(valueOptions()).toHaveLength(25);
    scrollToEnd();
    expect(valueOptions()).toHaveLength(50);
    scrollToEnd();
    expect(valueOptions()).toHaveLength(60);
  });

  it("typing searches the whole list, not just the shown page", () => {
    const combobox = renderBar();
    openValues(combobox);
    typeAfterUnit(combobox, "Type 05");
    expect(valueOptions()).toEqual([
      "Type 050",
      "Type 051",
      "Type 052",
      "Type 053",
      "Type 054",
      "Type 055",
      "Type 056",
      "Type 057",
      "Type 058",
      "Type 059",
    ]);
  });
});

/** A page that fetches 25 product types at a time, as an app's API would. */
const ServerBar = ({ fetch }: { fetch: (search: string) => void }) => {
  const [state, setState] = useState<{ values: FilterValue[]; search: string; more: boolean }>({
    values: [],
    search: "",
    more: false,
  });
  const field: FilterField = {
    key: "type",
    name: "Product type",
    multi: true,
    values: state.values,
    hasNextPage: state.more,
    operators: OPERATORS,
    fetchMoreValues: async (search) => {
      fetch(search);
      await Promise.resolve();
      setState((prev) => {
        const fresh = search !== prev.search;
        const from = fresh ? 1 : prev.values.length + 1;
        const page = typeValues(25, from);
        return { values: fresh ? page : [...prev.values, ...page], search, more: true };
      });
    },
  };
  return (
    <SearchField
      value=""
      onChange={vi.fn()}
      fields={[field]}
      filters={[]}
      onFiltersChange={vi.fn()}
      labels={LABELS}
    />
  );
};

describe("a list from a server", () => {
  it("fetches the first page on opening empty, with a loading row meanwhile", async () => {
    const fetch = vi.fn();
    render(<ServerBar fetch={fetch} />);
    const combobox = screen.getByRole("combobox") as HTMLDivElement;
    openValues(combobox);
    expect(fetch).toHaveBeenCalledWith("");
    expect(document.querySelector('[data-parity="picker-loading"]')).not.toBeNull();
    await act(async () => {});
    expect(valueOptions()).toHaveLength(25);
    expect(document.querySelector('[data-parity="picker-loading"]')).toBeNull();
  });

  it("fetches the next page at the end of the list while there is one", async () => {
    const fetch = vi.fn();
    render(<ServerBar fetch={fetch} />);
    openValues(screen.getByRole("combobox") as HTMLDivElement);
    await act(async () => {});
    scrollToEnd();
    await act(async () => {});
    expect(fetch).toHaveBeenLastCalledWith("");
    expect(valueOptions()).toHaveLength(50);
  });

  it("searches the server 250ms after the typing stops, without narrowing itself", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn();
    render(<ServerBar fetch={fetch} />);
    const combobox = screen.getByRole("combobox") as HTMLDivElement;
    openValues(combobox);
    await act(async () => {});
    typeAfterUnit(combobox, "mug");
    await act(async () => vi.advanceTimersByTime(200));
    expect(fetch).not.toHaveBeenCalledWith("mug");
    await act(async () => vi.advanceTimersByTime(50));
    expect(fetch).toHaveBeenLastCalledWith("mug");
    await act(async () => {});
    // The server's answer is shown as it is: no label holds "mug" here.
    expect(valueOptions()).toHaveLength(25);
  });
});
