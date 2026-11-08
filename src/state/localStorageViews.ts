import { readSavedViews, type SavedView } from "./savedViews";

/**
 * Saved views kept in the browser's local storage, for prototypes and demos
 * (a real app stores them per shop, on its server). Spread the result into
 * `useIndexFilters`:
 *
 *   useIndexFilters({ ...localStorageViews("products-views", DEFAULT_VIEWS), fields })
 *
 * `defaults` is used until something is saved; it starts with All.
 */
export const localStorageViews = (key: string, defaults: SavedView[]) => {
  let stored: unknown = null;
  try {
    stored = JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    // Unreadable or blocked storage: start from the defaults.
  }
  return {
    views: readSavedViews(stored, defaults),
    onViewsChange: (views: SavedView[]) => {
      try {
        localStorage.setItem(key, JSON.stringify(views));
      } catch {
        // Private windows and full storage: the views still work for the visit.
      }
    },
  };
};
