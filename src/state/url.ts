import type { FilterField } from "../filters/types";
import type { SavedViewFilter } from "./savedViews";

/**
 * The bar's state in the page URL, so a refresh or a shared link lands on
 * the same list. Readable params, one per field and condition:
 *
 *   ?query=snow&sort=created+desc&view=Drafts
 *   &vendor=Acme&vendor=Nike          Vendor is Acme, Nike
 *   &vendor_not=Acme                  Vendor is not Acme
 *   &available_between=5&available_between=20
 *   &date=2026-11-03&date_shape=date  a typed date (date fields only)
 *
 * Values repeat rather than join, so a value holding a comma survives.
 * Params the bar doesn't own are left alone.
 */

export interface UrlState {
  query: string;
  sort: string;
  /** The saved view's title, "" for All. */
  view: string;
  filters: SavedViewFilter[];
}

/** `is` owns the bare key, `is_not` is `_not`, the rest are `_<operator>`. */
export const filterParam = (field: string, operator: string) =>
  operator === "is" ? field : `${field}_${operator === "is_not" ? "not" : operator}`;

const shapeParam = (field: string, operator: string) => `${filterParam(field, operator)}_shape`;

/** Every param the bar may write for these fields, so stale ones are cleared. */
const ownedParams = (fields: readonly FilterField[]) => {
  const keys = new Set(["query", "sort", "view"]);
  for (const field of fields) {
    for (const operator of field.operators) {
      keys.add(filterParam(field.key, operator.value));
      keys.add(shapeParam(field.key, operator.value));
    }
  }
  return keys;
};

/** The filters a URL holds. Only the fields' own conditions are read. */
export const decodeFilters = (
  fields: readonly FilterField[],
  params: URLSearchParams,
): SavedViewFilter[] =>
  fields.flatMap((field) =>
    field.operators.flatMap((operator): SavedViewFilter[] => {
      const values = params.getAll(filterParam(field.key, operator.value));
      if (values.length === 0 || values.every((value) => value === "")) return [];
      const shape = params.get(shapeParam(field.key, operator.value));
      return [
        {
          field: field.key,
          operator: operator.value,
          values,
          ...(shape === "date" || shape === "range" ? { shape } : {}),
        },
      ];
    }),
  );

/** The params for a set of filters, in the fields' order. */
export const encodeFilters = (
  fields: readonly FilterField[],
  filters: readonly SavedViewFilter[],
): [string, string][] =>
  fields.flatMap((field) =>
    field.operators.flatMap((operator) => {
      const filter = filters.find((f) => f.field === field.key && f.operator === operator.value);
      if (!filter || filter.values.length === 0) return [];
      const pairs: [string, string][] = filter.values.map((value) => [
        filterParam(field.key, operator.value),
        value,
      ]);
      if (filter.shape) pairs.push([shapeParam(field.key, operator.value), filter.shape]);
      return pairs;
    }),
  );

/** Reads the bar's state from a query string (`location.search` by default). */
export const readUrlState = (
  fields: readonly FilterField[],
  search: string = typeof location === "undefined" ? "" : location.search,
): UrlState => {
  const params = new URLSearchParams(search);
  return {
    query: params.get("query") ?? "",
    sort: params.get("sort") ?? "",
    view: params.get("view") ?? "",
    filters: decodeFilters(fields, params),
  };
};

/**
 * Writes the bar's state into the URL with `history.replaceState`, keeping
 * every param the bar doesn't own. The default sort and All are left out, so
 * an untouched page keeps a clean URL. Does nothing when nothing changed.
 */
export const writeUrlState = (
  fields: readonly FilterField[],
  state: UrlState,
  defaultSort: string,
) => {
  if (typeof location === "undefined" || typeof history === "undefined") return;
  const owned = ownedParams(fields);
  const next = new URLSearchParams();
  for (const [key, value] of new URLSearchParams(location.search)) {
    if (!owned.has(key)) next.append(key, value);
  }
  if (state.query.trim()) next.set("query", state.query);
  if (state.sort && state.sort !== defaultSort) next.set("sort", state.sort);
  if (state.view) next.set("view", state.view);
  for (const [key, value] of encodeFilters(fields, state.filters)) next.append(key, value);
  const search = next.toString();
  if (search === location.search.replace(/^\?/, "")) return;
  history.replaceState(
    history.state,
    "",
    `${location.pathname}${search ? `?${search}` : ""}${location.hash}`,
  );
};
