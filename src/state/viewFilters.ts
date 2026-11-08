/**
 * A saved view's own search and filters, hidden from the bar until the eye
 * shows them. The page
 * keeps the full search and filters; the bar is handed what to show, and its
 * changes are merged back with what it hides.
 *
 * A view's filter hides while it is applied exactly as saved. A filter the
 * merchant adds shows on its own, and hides with the others once the view is
 * updated, since it then matches a saved one.
 */

interface ViewFilter {
  field: string;
  operator: string;
  values: readonly string[];
  shape?: string;
}

/** One spelling for a filter: field, condition, shape and values in any order. */
const filterKey = (filter: ViewFilter) =>
  [
    filter.field,
    filter.operator,
    filter.shape ?? "",
    [...filter.values].sort().join("\u0000"),
  ].join("\u0001");

export interface ViewFilterSplit<F extends ViewFilter> {
  /** What the bar shows. */
  shown: F[];
  /** The view's filters, applied but kept out of the bar. */
  hidden: F[];
  /** Every one of the view's filters is applied unchanged: the eye can show. */
  intact: boolean;
}

/**
 * Splits the page's filters into the ones the bar shows and the view's own,
 * hidden unless `revealed`. Once a view filter is changed or removed nothing
 * hides, so the merchant sees everything they are editing.
 */
export const splitViewFilters = <F extends ViewFilter>(
  filters: readonly F[],
  saved: readonly ViewFilter[],
  revealed: boolean,
): ViewFilterSplit<F> => {
  const wanted = saved.filter((f) => f.values.length > 0).map(filterKey);
  const hidden: F[] = [];
  const shown: F[] = [];
  for (const filter of filters) {
    const at = wanted.indexOf(filterKey(filter));
    if (at === -1) shown.push(filter);
    else {
      wanted.splice(at, 1);
      hidden.push(filter);
    }
  }
  const intact = wanted.length === 0;
  if (revealed || !intact) return { shown: [...filters], hidden: [], intact };
  return { shown, hidden, intact };
};

/** The bar's filters back with the hidden ones, the view's last, as the admin sends them. */
export const mergeViewFilters = <F>(shown: readonly F[], hidden: readonly F[]): F[] => [
  ...shown,
  ...hidden,
];

export interface ViewQuerySplit {
  shown: string;
  hidden: string;
  intact: boolean;
}

/**
 * The same for the search text: the view's saved search sits after what the
 * merchant types (`hydrogen snow`), and hides while it is still there. The
 * split and merge round-trip exactly, spaces included, so the field never
 * loses a space the merchant just typed.
 */
export const splitViewQuery = (query: string, saved: string, revealed: boolean): ViewQuerySplit => {
  const view = saved.trim();
  if (!view) return { shown: query, hidden: "", intact: true };
  const shown =
    query === view ? "" : query.endsWith(` ${view}`) ? query.slice(0, -(view.length + 1)) : null;
  if (shown === null) return { shown: query, hidden: "", intact: false };
  if (revealed) return { shown: query, hidden: "", intact: true };
  return { shown, hidden: view, intact: true };
};

/** The bar's text back with the view's hidden search after it. */
export const mergeViewQuery = (shown: string, hidden: string): string => {
  if (!hidden) return shown;
  return shown === "" ? hidden : `${shown} ${hidden}`;
};
