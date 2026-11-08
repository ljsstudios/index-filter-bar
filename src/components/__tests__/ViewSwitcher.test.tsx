import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { axeViolations } from "../../test/axe";

import { ViewSwitcher } from "../ViewSwitcher";

// Behaviour numbers are docs/research/index-filter-bar/behaviour.md.

afterEach(cleanup);

const renderSwitcher = (selected = 0, readOnly = false) => {
  const onSelect = vi.fn();
  const onAction = vi.fn();
  const view = render(
    <ViewSwitcher
      popoverId="test-views"
      titles={["All", "Unmatched", "Snowboards"]}
      selected={selected}
      onSelect={onSelect}
      onAction={onAction}
      readOnly={readOnly}
    />,
  );
  return { ...view, onSelect, onAction };
};

describe("ViewSwitcher", () => {
  it("b44: the button names the current view and the menu ticks it", () => {
    const { container } = renderSwitcher(1);
    const button = container.querySelector('[data-parity="views-button"]') as HTMLElement;
    expect(button.textContent).toBe("Unmatched");
    expect(button.getAttribute("commandfor")).toBe("test-views");
    const rows = screen.getAllByRole("menuitemradio");
    expect(rows.map((r) => r.getAttribute("aria-checked"))).toEqual(["false", "true", "false"]);
    // All shows in the merchant's language, not as stored.
    expect(rows[0]?.textContent).toBe("All");
  });

  it("b44: choosing a view selects it and closes the menu", () => {
    const { onSelect } = renderSwitcher(0);
    const row = screen.getAllByRole("menuitemradio")[2] as HTMLElement;
    expect(row.getAttribute("command")).toBe("--hide");
    fireEvent.click(row);
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it("b45: only the current view has the actions button", () => {
    renderSwitcher(1);
    expect(screen.getAllByLabelText(/^Actions for/)).toHaveLength(1);
    expect(screen.getByLabelText("Actions for Unmatched")).toBeTruthy();
  });

  it("b45: All can only be duplicated", () => {
    renderSwitcher(0);
    fireEvent.click(screen.getByLabelText("Actions for All"));
    const items = screen.getAllByRole("menuitem").map((i) => i.textContent);
    expect(items).toEqual(["All", "Duplicate view"]);
  });

  it("b45, b59: a saved view's actions replace the list, with a Back row, in one popover", () => {
    const { container, onAction } = renderSwitcher(1);
    fireEvent.click(screen.getByLabelText("Actions for Unmatched"));
    expect(screen.queryAllByRole("menuitemradio")).toHaveLength(0);
    expect(screen.getAllByRole("menuitem").map((i) => i.textContent)).toEqual([
      "Unmatched",
      "Rename view",
      "Duplicate view",
      "Delete view",
    ]);
    expect(container.querySelectorAll("s-popover")).toHaveLength(1);
    fireEvent.click(screen.getByText("Delete view"));
    expect(onAction).toHaveBeenCalledWith(1, "delete");
  });

  it("b59: Back returns to the list", () => {
    renderSwitcher(1);
    fireEvent.click(screen.getByLabelText("Actions for Unmatched"));
    fireEvent.click(screen.getAllByRole("menuitem")[0] as HTMLElement);
    expect(screen.getAllByRole("menuitemradio")).toHaveLength(3);
  });

  it("read-only grace: views switch but have no actions", () => {
    renderSwitcher(1, true);
    expect(screen.queryAllByLabelText(/^Actions for/)).toHaveLength(0);
    expect(screen.getAllByRole("menuitemradio")).toHaveLength(3);
  });
});

describe("ViewSwitcher accessibility", () => {
  it("a11y 7: the menu holds only menu items, the … one of them", async () => {
    const { container } = renderSwitcher(1);
    expect(screen.getByRole("menuitem", { name: "Actions for Unmatched" })).toBeTruthy();
    expect(await axeViolations(container)).toEqual([]);
  });

  it("a11y 8: opened, focus goes to the current view; Up, Down, Home and End move it", async () => {
    const { container } = renderSwitcher(1);
    container.querySelector("s-popover")?.dispatchEvent(new Event("show"));
    const current = screen.getByRole("menuitemradio", { name: "Unmatched" });
    await waitFor(() => expect(document.activeElement).toBe(current));
    const menu = screen.getByRole("menu");
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: "Actions for Unmatched" }),
    );
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(screen.getByRole("menuitemradio", { name: "Snowboards" }));
    fireEvent.keyDown(menu, { key: "Home" });
    expect(document.activeElement).toBe(screen.getByRole("menuitemradio", { name: "All" }));
    fireEvent.keyDown(menu, { key: "ArrowUp" });
    expect(document.activeElement).toBe(screen.getByRole("menuitemradio", { name: "Snowboards" }));
  });

  it("a11y 8: Right on … opens the actions with focus on Rename; Left goes back to …", async () => {
    renderSwitcher(1);
    const more = screen.getByRole("menuitem", { name: "Actions for Unmatched" });
    more.focus();
    fireEvent.keyDown(more, { key: "ArrowRight" });
    await waitFor(() => expect(document.activeElement?.textContent).toContain("Rename view"));
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowLeft" });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("menuitem", { name: "Actions for Unmatched" }),
      ),
    );
  });
});
