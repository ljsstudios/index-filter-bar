/**
 * A page's saved views: named combinations of search, filters, sort and
 * columns. The first view is always All, the page's own default: it can be
 * duplicated but not renamed or deleted, and Save on it makes a new view.
 */

/** A filter as a view stores it: the same shape the bar hands the page. */
export interface SavedViewFilter {
  field: string;
  operator: string;
  values: string[];
  /** Date filters: a typed date or a range, as `FilterUnit.shape`. */
  shape?: "date" | "range";
}

/** A view's column layout, stored only when it differs from the page's default. */
export interface SavedViewColumns {
  order: string[];
  hidden: string[];
}

export interface SavedView {
  title: string;
  sort: string;
  query: string;
  filters: SavedViewFilter[];
  columns?: SavedViewColumns;
}

export const MAX_SAVED_VIEWS = 50;
export const MAX_VIEW_TITLE = 40;

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

const readFilter = (value: unknown): SavedViewFilter | null => {
  const f = value as Partial<SavedViewFilter> | null;
  if (typeof f?.field !== "string" || typeof f.operator !== "string") return null;
  const shape = f.shape === "date" || f.shape === "range" ? f.shape : undefined;
  return {
    field: f.field,
    operator: f.operator,
    values: strings(f.values),
    ...(shape ? { shape } : {}),
  };
};

const readColumns = (value: unknown): SavedViewColumns | undefined => {
  const c = value as Partial<SavedViewColumns> | null | undefined;
  if (!c || !Array.isArray(c.order)) return undefined;
  return { order: strings(c.order), hidden: strings(c.hidden) };
};

const readView = (value: unknown): SavedView | null => {
  const v = value as Partial<SavedView> | null;
  if (typeof v?.title !== "string" || v.title.trim() === "") return null;
  const columns = readColumns(v.columns);
  return {
    title: v.title.slice(0, MAX_VIEW_TITLE),
    sort: typeof v.sort === "string" ? v.sort : "",
    query: typeof v.query === "string" ? v.query : "",
    filters: (Array.isArray(v.filters) ? v.filters : [])
      .map(readFilter)
      .filter((f): f is SavedViewFilter => f !== null),
    ...(columns ? { columns } : {}),
  };
};

/**
 * A stored list read back safely, from your database or local storage:
 * malformed views are dropped, and the list always starts with the page's
 * All view (`defaults[0]`) whatever was stored.
 */
export const readSavedViews = (value: unknown, defaults: SavedView[]): SavedView[] => {
  const stored = (Array.isArray(value) ? value : [])
    .map(readView)
    .filter((v): v is SavedView => v !== null);
  if (stored.length === 0) return defaults;
  const [all, ...rest] = stored;
  return [{ ...all, title: defaults[0]?.title ?? all.title }, ...rest].slice(0, MAX_SAVED_VIEWS);
};
