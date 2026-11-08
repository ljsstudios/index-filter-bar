import type { SavedViewColumns } from "./savedViews";

/**
 * A view's column layout read against the page's current columns, so a
 * column added or removed since the view was saved never strands it
 * (useColumnConfig's rule, kept when the layout moved into saved views).
 * Unknown keys drop out; a new column lands where the registry puts it, not
 * on the end, and takes its default visibility.
 */
export const reconcileColumns = (
  stored: Partial<SavedViewColumns> | undefined,
  allKeys: readonly string[],
  defaultHidden: readonly string[] = [],
): SavedViewColumns => {
  const valid = new Set(allKeys);
  const storedOrder = (stored?.order ?? []).filter((key) => valid.has(key));
  const missing = allKeys.filter((key) => !storedOrder.includes(key));
  const storedHidden = (stored?.hidden ?? [...defaultHidden]).filter((key) => valid.has(key));
  const newlyHidden = stored ? missing.filter((key) => defaultHidden.includes(key)) : [];

  const order = [...storedOrder];
  for (const key of missing) {
    const before = allKeys.slice(0, allKeys.indexOf(key));
    const at = order.findIndex((existing) => !before.includes(existing));
    if (at === -1) order.push(key);
    else order.splice(at, 0, key);
  }
  return { order, hidden: [...new Set([...storedHidden, ...newlyHidden])] };
};

/**
 * Undefined when the layout is the page's default, so a view only stores
 * columns the merchant changed and All stays clean.
 */
export const columnsToStore = (
  columns: SavedViewColumns,
  allKeys: readonly string[],
  defaultHidden: readonly string[] = [],
): SavedViewColumns | undefined => {
  const sameOrder = columns.order.join("|") === allKeys.join("|");
  const sameHidden = [...columns.hidden].sort().join("|") === [...defaultHidden].sort().join("|");
  return sameOrder && sameHidden ? undefined : columns;
};
