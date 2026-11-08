import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { columnsToStore, reconcileColumns } from "../../state/columns";
import { axeViolations } from "../../test/axe";
import { ColumnsPopover } from "../ColumnsPopover";

afterEach(cleanup);

const renderPopover = (sort = "title asc") => {
  const handlers = { onSortChange: vi.fn(), onReorder: vi.fn(), onToggle: vi.fn() };
  const view = render(
    <ColumnsPopover
      popoverId="test-display"
      sortOptions={[
        { field: "title", label: "Product", ascLabel: "A-Z", descLabel: "Z-A" },
        { field: "sku", label: "SKU", ascLabel: "A-Z", descLabel: "Z-A" },
      ]}
      sort={sort}
      columns={[
        { key: "sku", label: "SKU", visible: true },
        { key: "barcode", label: "Barcode", visible: false },
      ]}
      {...handlers}
    />,
  );
  return { ...view, ...handlers };
};

describe("ColumnsPopover", () => {
  it("opens from a labelled 28px button", () => {
    const { container } = renderPopover();
    const button = screen.getByLabelText("Display options");
    expect(button.getAttribute("commandfor")).toBe("test-display");
    expect(container.querySelectorAll("s-popover")).toHaveLength(1);
  });

  it("shows the current sort and the columns, hidden ones with Show", () => {
    renderPopover("sku desc");
    expect(screen.getByText("SKU", { selector: "button" })).toBeTruthy();
    expect(screen.getByLabelText("Hide SKU")).toBeTruthy();
    expect(screen.getByLabelText("Show Barcode")).toBeTruthy();
  });

  it("toggles a column from its eye", () => {
    const { onToggle } = renderPopover();
    fireEvent.click(screen.getByLabelText("Show Barcode"));
    expect(onToggle).toHaveBeenCalledWith("barcode");
  });

  it("swaps to a sort panel with a Back row, in the same popover", () => {
    const { container, onSortChange } = renderPopover("title asc");
    fireEvent.click(container.querySelector('[data-parity="sort-button"]') as HTMLElement);
    const radios = screen.getAllByRole("menuitemradio");
    expect(radios.map((r) => [r.textContent, r.getAttribute("aria-checked")])).toEqual([
      ["Product", "true"],
      ["SKU", "false"],
      ["A-Z", "true"],
      ["Z-A", "false"],
    ]);
    fireEvent.click(radios[1] as HTMLElement);
    expect(onSortChange).toHaveBeenCalledWith("sku asc");
    fireEvent.click(radios[3] as HTMLElement);
    expect(onSortChange).toHaveBeenCalledWith("title desc");
    fireEvent.click(screen.getByText("Sort by"));
    expect(screen.queryAllByRole("menuitemradio")).toHaveLength(0);
  });
});

describe("columns", () => {
  const keys = ["sku", "barcode", "status"] as const;

  it("reads a stored layout against today's columns", () => {
    expect(reconcileColumns(undefined, keys)).toEqual({ order: [...keys], hidden: [] });
    expect(reconcileColumns({ order: ["status", "gone", "sku"], hidden: ["gone"] }, keys)).toEqual({
      order: ["barcode", "status", "sku"],
      hidden: [],
    });
  });

  it("stores nothing while the layout is the default", () => {
    expect(columnsToStore({ order: [...keys], hidden: [] }, keys)).toBeUndefined();
    expect(columnsToStore({ order: [...keys], hidden: ["sku"] }, keys)).toEqual({
      order: [...keys],
      hidden: ["sku"],
    });
  });
});

describe("ColumnsPopover accessibility", () => {
  it("a11y 9: each row has a reorder handle and an eye, neither inside the other", async () => {
    const { container } = renderPopover();
    const handles = container.querySelectorAll('[data-parity="column-handle"]');
    expect([...handles].map((h) => h.getAttribute("aria-label"))).toEqual([
      "Reorder SKU",
      "Reorder Barcode",
    ]);
    const row = container.querySelector('[data-parity="column-row"]') as HTMLElement;
    expect(row.getAttribute("role")).toBeNull();
    expect(row.getAttribute("tabindex")).toBeNull();
    expect(await axeViolations(container)).toEqual([]);
  });

  it("a11y 12: the sort button names what it sorts by", () => {
    renderPopover();
    expect(screen.getByRole("button", { name: "Sort by Product" })).toBeTruthy();
  });
});
