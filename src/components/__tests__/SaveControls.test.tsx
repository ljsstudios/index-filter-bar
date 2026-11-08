import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SaveControls } from "../SaveControls";

// Behaviour numbers are docs/research/index-filter-bar/behaviour.md.

afterEach(cleanup);

const renderControls = (props: { dirty?: boolean; onAll?: boolean; readOnly?: boolean } = {}) => {
  const handlers = { onReset: vi.fn(), onSaveAsNew: vi.fn(), onUpdate: vi.fn() };
  const view = render(
    <SaveControls
      idPrefix="test"
      dirty={props.dirty ?? true}
      onAll={props.onAll ?? false}
      readOnly={props.readOnly}
      {...handlers}
    />,
  );
  const slideIn = view.container.firstElementChild as HTMLElement;
  return { ...view, slideIn, ...handlers };
};

const key = (init: KeyboardEventInit) =>
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ...init }));

describe("SaveControls", () => {
  it("b47: slides in only while the page differs from its view", () => {
    expect(renderControls({ dirty: false }).slideIn.getAttribute("data-open")).toBe("false");
    cleanup();
    expect(renderControls({ dirty: true }).slideIn.getAttribute("data-open")).toBe("true");
  });

  it("b49: Reset view applies at once, with no confirm", () => {
    const { onReset } = renderControls();
    fireEvent.click(screen.getByLabelText("Reset view"));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("b48, b58: on All, Save is plain and saves as a new view", () => {
    const { container, onSaveAsNew } = renderControls({ onAll: true });
    expect(container.querySelector("s-popover")).toBeNull();
    fireEvent.click(screen.getByText("Save"));
    expect(onSaveAsNew).toHaveBeenCalledTimes(1);
  });

  it("b58: on a saved view, Save opens Update view and Save as new view with their keys", () => {
    const { container, onUpdate, onSaveAsNew } = renderControls();
    const save = container.querySelector('[data-parity="save-view"]') as HTMLElement;
    expect(save.getAttribute("commandfor")).toBe("test-save-menu");
    const items = screen.getAllByRole("menuitem");
    expect(items.map((i) => i.textContent?.replace(/(⌘|Ctrl|⇧|S)+$/, ""))).toEqual([
      "Update view",
      "Save as new view",
    ]);
    expect([...(items[1]?.querySelectorAll("kbd") ?? [])].map((k) => k.textContent)).toHaveLength(
      3,
    );
    fireEvent.click(items[0] as HTMLElement);
    fireEvent.click(items[1] as HTMLElement);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onSaveAsNew).toHaveBeenCalledTimes(1);
  });

  it("b48: ⌘S updates the view and ⌘⇧S saves a new one", () => {
    const { onUpdate, onSaveAsNew } = renderControls();
    key({ metaKey: true, ctrlKey: true });
    key({ metaKey: true, ctrlKey: true, shiftKey: true });
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onSaveAsNew).toHaveBeenCalledTimes(1);
  });

  it("b48: on All, ⌘S saves a new view", () => {
    const { onUpdate, onSaveAsNew } = renderControls({ onAll: true });
    key({ metaKey: true, ctrlKey: true });
    expect(onUpdate).not.toHaveBeenCalled();
    expect(onSaveAsNew).toHaveBeenCalledTimes(1);
  });

  it("the shortcuts are off while nothing has changed, and in read-only grace", () => {
    const clean = renderControls({ dirty: false });
    key({ metaKey: true, ctrlKey: true });
    expect(clean.onUpdate).not.toHaveBeenCalled();
    cleanup();
    const readOnly = renderControls({ readOnly: true });
    key({ metaKey: true, ctrlKey: true });
    expect(readOnly.onUpdate).not.toHaveBeenCalled();
  });
});

describe("SaveControls accessibility", () => {
  it("a11y 8: the Save menu focuses Update view on open; Up and Down move", async () => {
    const { container } = renderControls();
    container.querySelector("s-popover")?.dispatchEvent(new Event("show"));
    const [update, saveAsNew] = screen.getAllByRole("menuitem");
    await waitFor(() => expect(document.activeElement).toBe(update));
    const menu = screen.getByRole("menu");
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(saveAsNew);
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(update);
  });
});
