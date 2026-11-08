import type { KeyboardEvent } from "react";

const ITEMS = '[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]';

const itemsOf = (menu: Element) =>
  [...menu.querySelectorAll<HTMLElement>(ITEMS)].filter(
    (item) => !item.hasAttribute("disabled") && item.getAttribute("aria-disabled") !== "true",
  );

/**
 * The ARIA menu keys: Up and Down move between the
 * items, wrapping, and Home and End jump to the first and last. Put it on the
 * element with role="menu"; Escape, Enter and Space stay the popover's and
 * the buttons' own.
 */
export const onMenuKeyDown = (event: KeyboardEvent<HTMLElement>) => {
  const items = itemsOf(event.currentTarget);
  if (items.length === 0) return;
  const at = items.indexOf(document.activeElement as HTMLElement);
  const next =
    event.key === "ArrowDown"
      ? (at + 1) % items.length
      : event.key === "ArrowUp"
        ? (at - 1 + items.length) % items.length
        : event.key === "Home"
          ? 0
          : event.key === "End"
            ? items.length - 1
            : null;
  if (next === null) return;
  event.preventDefault();
  items[next]?.focus();
};

/**
 * Focus an item once the popover shows it: the one matching `selector` (the
 * current view), else the first.
 */
export const focusMenuItem = (menu: Element | null, selector?: string) => {
  if (!menu) return;
  requestAnimationFrame(() => {
    const chosen = selector ? menu.querySelector<HTMLElement>(selector) : null;
    (chosen ?? itemsOf(menu)[0])?.focus();
  });
};
