import { act, cleanup, render, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FilterField } from "../filters/types";
import { IndexFilterBar } from "../IndexFilterBar";
import type { SavedView } from "../state/savedViews";
import { axeViolations } from "../test/axe";
import { type UseIndexFiltersOptions, useIndexFilters } from "../useIndexFilters";

const FIELDS: FilterField[] = [
  {
    key: "vendor",
    name: "Vendor",
    multi: true,
    values: [
      { value: "Acme", label: "Acme" },
      { value: "Nike, Inc", label: "Nike, Inc" },
    ],
    operators: [
      { value: "is", label: "Is", chipLabel: "Vendor is" },
      { value: "is_not", label: "Is not", chipLabel: "Vendor is not" },
    ],
  },
  {
    key: "status",
    name: "Status",
    multi: true,
    values: [
      { value: "active", label: "Active" },
      { value: "draft", label: "Draft" },
    ],
    operators: [{ value: "is", label: "Is", chipLabel: "Status is" }],
  },
  {
    key: "available",
    name: "Available",
    kind: "number",
    number: { minPrecision: 0, maxPrecision: 0 },
    multi: false,
    values: [],
    operators: [
      { value: "between", label: "Is between", chipLabel: "Available is between", range: true },
    ],
  },
];

const VIEWS: SavedView[] = [
  { title: "All", sort: "title asc", query: "", filters: [] },
  {
    title: "Drafts",
    sort: "title asc",
    query: "",
    filters: [{ field: "status", operator: "is", values: ["draft"] }],
  },
];

const OPTIONS: UseIndexFiltersOptions = {
  fields: FIELDS,
  sortOptions: [
    { field: "title", label: "Title", ascLabel: "A-Z", descLabel: "Z-A" },
    { field: "created", label: "Created", ascLabel: "Oldest first", descLabel: "Newest first" },
  ],
  columns: [
    { key: "title", label: "Title" },
    { key: "vendor", label: "Vendor" },
    { key: "sku", label: "SKU", hidden: true },
  ],
  views: VIEWS,
};

const setUrl = (search: string) => window.history.replaceState(null, "", `/products${search}`);
const search = () => new URLSearchParams(window.location.search);

beforeEach(() => setUrl(""));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useIndexFilters", () => {
  it("sends the search 400ms after the last key, pending till then, and writes it to the URL", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useIndexFilters(OPTIONS));
    expect(result.current.pending).toBe(false);
    act(() => result.current.props.search.onChange("snow"));
    expect(result.current.query).toBe("");
    expect(result.current.pending).toBe(true);
    act(() => vi.advanceTimersByTime(400));
    expect(result.current.query).toBe("snow");
    expect(result.current.pending).toBe(false);
    expect(search().get("query")).toBe("snow");
  });

  it("round-trips filters through readable URL params, commas and all", () => {
    const { result, unmount } = renderHook(() => useIndexFilters(OPTIONS));
    act(() =>
      result.current.props.search.onFiltersChange([
        { field: "vendor", operator: "is", values: ["Acme", "Nike, Inc"] },
        { field: "vendor", operator: "is_not", values: ["Acme"] },
        { field: "available", operator: "between", values: ["", "20"] },
      ]),
    );
    expect(search().getAll("vendor")).toEqual(["Acme", "Nike, Inc"]);
    expect(search().getAll("vendor_not")).toEqual(["Acme"]);
    expect(search().getAll("available_between")).toEqual(["", "20"]);
    unmount();

    const again = renderHook(() => useIndexFilters(OPTIONS)).result;
    expect(again.current.filters).toEqual([
      { field: "vendor", operator: "is", values: ["Acme", "Nike, Inc"] },
      { field: "vendor", operator: "is_not", values: ["Acme"] },
      { field: "available", operator: "between", values: ["", "20"] },
    ]);
  });

  it("keeps params it doesn't own, and leaves the default sort out", () => {
    setUrl("?host=abc");
    const { result } = renderHook(() => useIndexFilters(OPTIONS));
    act(() => result.current.setSort("created desc"));
    expect(search().get("host")).toBe("abc");
    expect(search().get("sort")).toBe("created desc");
    act(() => result.current.setSort("title asc"));
    expect(search().get("sort")).toBeNull();
  });

  it("hides and reorders columns, which leaves the view unsaved until Reset", () => {
    const { result } = renderHook(() => useIndexFilters(OPTIONS));
    expect(result.current.visibleColumns).toEqual(["title", "vendor"]);
    act(() => result.current.props.columns?.onToggle("sku"));
    act(() => result.current.props.columns?.onReorder(["sku", "title", "vendor"]));
    expect(result.current.visibleColumns).toEqual(["sku", "title", "vendor"]);
    expect(result.current.view.dirty).toBe(true);
    act(() => result.current.props.save.onReset());
    expect(result.current.visibleColumns).toEqual(["title", "vendor"]);
    expect(result.current.view.dirty).toBe(false);
  });

  it("saves a new view through onViewsChange and selects it", async () => {
    const onViewsChange = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useIndexFilters({ ...OPTIONS, onViewsChange }));
    act(() =>
      result.current.props.search.onFiltersChange([
        { field: "vendor", operator: "is", values: ["Acme"] },
      ]),
    );
    await act(() => result.current.props.modals.onCreate("Acme"));
    const saved = onViewsChange.mock.calls[0]?.[0] as SavedView[];
    expect(saved.map((view) => view.title)).toEqual(["All", "Drafts", "Acme"]);
    expect(saved[2]?.filters).toEqual([{ field: "vendor", operator: "is", values: ["Acme"] }]);
    expect(result.current.view).toEqual({ index: 2, title: "Acme", dirty: false });
    expect(search().get("view")).toBe("Acme");
  });

  it("keeps the views as they were when saving fails", async () => {
    const onViewsChange = vi.fn().mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useIndexFilters({ ...OPTIONS, onViewsChange }));
    await act(async () => {
      await expect(result.current.props.modals.onCreate("Nope")).rejects.toThrow("offline");
    });
    expect(result.current.props.views.titles).toEqual(["All", "Drafts"]);
    expect(result.current.view.index).toBe(0);
  });

  it("renames, duplicates and deletes, landing on All after a delete", async () => {
    const { result } = renderHook(() => useIndexFilters(OPTIONS));
    await act(() => result.current.props.modals.onRename(1, "Draft products"));
    await act(() => result.current.props.modals.onDuplicate(1, "Copy of Draft products"));
    expect(result.current.view.title).toBe("Copy of Draft products");
    expect(result.current.filters).toEqual(VIEWS[1]?.filters);
    await act(() => result.current.props.modals.onDelete(2));
    expect(result.current.props.views.titles).toEqual(["All", "Draft products"]);
    expect(result.current.view.index).toBe(0);
    expect(result.current.filters).toEqual([]);
  });

  it("opens the view the URL names, with its filters hidden behind the eye", () => {
    setUrl("?view=Drafts");
    const { result } = renderHook(() => useIndexFilters(OPTIONS));
    expect(result.current.view.title).toBe("Drafts");
    expect(result.current.filters).toEqual(VIEWS[1]?.filters);
    expect(result.current.props.search.filters).toEqual([]);
    expect(result.current.props.search.usedFields).toEqual(["status"]);
    expect(result.current.props.viewFilters?.revealed).toBe(false);

    act(() => result.current.props.viewFilters?.onToggle());
    expect(result.current.props.search.filters).toEqual(VIEWS[1]?.filters);
    expect(result.current.view.dirty).toBe(false);
  });

  it("shows a filter added to a hidden view on its own, and applies both", () => {
    setUrl("?view=Drafts");
    const { result } = renderHook(() => useIndexFilters(OPTIONS));
    act(() =>
      result.current.props.search.onFiltersChange([
        { field: "vendor", operator: "is", values: ["Acme"] },
      ]),
    );
    expect(result.current.props.search.filters).toEqual([
      { field: "vendor", operator: "is", values: ["Acme"] },
    ]);
    expect(result.current.filters).toEqual([
      { field: "vendor", operator: "is", values: ["Acme"] },
      { field: "status", operator: "is", values: ["draft"] },
    ]);
    expect(result.current.props.viewFilters).not.toBeNull();
    expect(result.current.view.dirty).toBe(true);
  });

  it("All has no eye, and clear empties the search and filters", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useIndexFilters(OPTIONS));
    expect(result.current.props.viewFilters).toBeNull();
    act(() => {
      result.current.props.search.onChange("snow");
      result.current.props.search.onFiltersChange([
        { field: "vendor", operator: "is", values: ["Acme"] },
      ]);
    });
    expect(result.current.hasFilters).toBe(true);
    act(() => result.current.clear());
    expect(result.current.hasFilters).toBe(false);
    expect(result.current.query).toBe("");
  });

  it("leaves the URL alone with url: false", () => {
    const { result } = renderHook(() => useIndexFilters({ ...OPTIONS, url: false }));
    act(() => result.current.setSort("created desc"));
    expect(window.location.search).toBe("");
  });
});

const Page = () => {
  const bar = useIndexFilters(OPTIONS);
  return <IndexFilterBar {...bar.props} />;
};

describe("IndexFilterBar", () => {
  it("draws the whole bar, and axe finds nothing", async () => {
    setUrl("?view=Drafts");
    const { container, getByRole } = render(<Page />);
    expect(getByRole("button", { name: "Switch view" }).textContent).toContain("Drafts");
    expect(getByRole("combobox", { name: "Search and filter" })).toBeTruthy();
    expect(getByRole("button", { name: "Display options" })).toBeTruthy();
    expect(getByRole("button", { name: "Show view filters" })).toBeTruthy();
    expect(await axeViolations(container)).toEqual([]);
  });
});
