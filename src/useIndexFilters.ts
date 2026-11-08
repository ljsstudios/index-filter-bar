import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ColumnsPopoverColumn, SortOption } from "./components/ColumnsPopover";
import { toSearchFieldLabels } from "./components/SearchField";
import type { ViewModalKind, ViewModalRequest } from "./components/ViewModals";
import type { ViewAction } from "./components/ViewSwitcher";
import type { FilterField } from "./filters/types";
import { defaultLabels, type IndexFilterBarLabels } from "./labels";
import { columnsToStore, reconcileColumns } from "./state/columns";
import type { SavedView, SavedViewColumns, SavedViewFilter } from "./state/savedViews";
import { readUrlState, writeUrlState } from "./state/url";
import {
  mergeViewFilters,
  mergeViewQuery,
  splitViewFilters,
  splitViewQuery,
} from "./state/viewFilters";

/** A column the page shows, in its default order. */
export interface IndexColumn {
  key: string;
  label: string;
  /** Hidden until the merchant shows it. */
  hidden?: boolean;
}

export interface UseIndexFiltersOptions {
  /** What the bar filters by. */
  fields?: FilterField[];
  /** What the list sorts by, each with its direction words ("A-Z", "Z-A"). */
  sortOptions?: SortOption[];
  /** "field direction": the sort All uses, "title asc" by default. */
  defaultSort?: string;
  /** The page's columns in their default order: reorder and hide them in the columns menu. */
  columns?: IndexColumn[];
  /**
   * The saved views, All first, as last stored. Without them the page has
   * just All, and the views button still offers Save as new view.
   */
  views?: SavedView[];
  /**
   * Stores the whole list after any change (create, update, rename,
   * duplicate, delete). Return a promise: the modal keeps its spinner until
   * it settles, and a rejection keeps it open with an error banner.
   * Without it, views live only in memory.
   */
  onViewsChange?: (views: SavedView[]) => void | Promise<void>;
  /**
   * Saved views (default true): the views button, Reset and Save, the
   * "Show view filters" eye and the save modals. False leaves the bar without
   * them, as the admin's Gift cards and Segments are; `views` and
   * `onViewsChange` are then ignored.
   */
  savedViews?: boolean;
  /** Keep search, filters, sort and view in the URL (default true). */
  url?: boolean;
  /** How long typing waits before `query` changes, in ms (default 400, the admin's). */
  searchDelay?: number;
  /** Every word the bar shows; English by default. */
  labels?: IndexFilterBarLabels;
  /** Unique per page when two bars share one: the popovers' and modals' ids. */
  id?: string;
  /** Views can be switched but not saved, renamed or deleted. */
  readOnly?: boolean;
  /** A view was saved, renamed or deleted: in a Shopify app, `shopify.toast.show`. */
  onToast?: (message: string) => void;
  /** Saving a view failed (its modal shows the error); report it here. */
  onError?: (error: unknown, action: ViewModalKind) => void;
}

const ALL: SavedView = { title: "All", sort: "", query: "", filters: [] };
const NO_FIELDS: FilterField[] = [];
const NO_SORTS: SortOption[] = [];
const NO_COLUMNS: IndexColumn[] = [];

const sameTitle = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** One spelling for "the same filters": order-free, empty ones dropped. */
const canonicalFilters = (filters: readonly SavedViewFilter[]) =>
  filters
    .filter((f) => f.values.length > 0)
    .map((f) => `${f.field}:${f.operator}:${f.shape ?? ""}:${[...f.values].sort().join(",")}`)
    .sort()
    .join("|");

/**
 * Everything an index page's bar needs, in one hook: the search (debounced),
 * the filters, the sort, the column layout, saved views with Reset and Save,
 * the "Show view filters" eye, and the URL. Spread `props` into
 * `<IndexFilterBar>`; read `query`, `filters`, `sort` and `visibleColumns`
 * into the page's list query and table.
 */
export const useIndexFilters = ({
  fields = NO_FIELDS,
  sortOptions = NO_SORTS,
  defaultSort = "title asc",
  columns: pageColumns = NO_COLUMNS,
  views: initialViews,
  onViewsChange,
  savedViews = true,
  url = true,
  searchDelay = 400,
  labels = defaultLabels,
  id = "index-filter-bar",
  readOnly = false,
  onToast,
  onError,
}: UseIndexFiltersOptions = {}) => {
  const columnKeys = useMemo(() => pageColumns.map((column) => column.key), [pageColumns]);
  const defaultHidden = useMemo(
    () => pageColumns.filter((column) => column.hidden).map((column) => column.key),
    [pageColumns],
  );

  // ---- Saved views: All first, always ----
  const [views, setViews] = useState<SavedView[]>(() => {
    const list = savedViews && initialViews && initialViews.length > 0 ? initialViews : [ALL];
    return list.map((view, index) =>
      index === 0 ? { ...view, sort: view.sort || defaultSort } : view,
    );
  });

  // ---- The page's state, read once: the URL, else the named view, else All ----
  const [initial] = useState(() => {
    const fromUrl = url ? readUrlState(fields) : null;
    const named = fromUrl?.view
      ? views.findIndex((view, index) => index > 0 && sameTitle(view.title, fromUrl.view))
      : -1;
    const selected = Math.max(named, 0);
    const view = views[selected] ?? ALL;
    const urlHasState =
      !!fromUrl && (fromUrl.filters.length > 0 || fromUrl.query !== "" || fromUrl.sort !== "");
    return {
      selected,
      query: urlHasState ? (fromUrl?.query ?? "") : view.query,
      sort: (urlHasState ? fromUrl?.sort : view.sort) || defaultSort,
      filters: urlHasState ? (fromUrl?.filters ?? []) : view.filters,
      columns: reconcileColumns(view.columns, columnKeys, defaultHidden),
    };
  });
  const [selected, setSelected] = useState(initial.selected);

  // ---- Search: what's typed now, and what the list uses 400ms later ----
  const [queryValue, setQueryValue] = useState(initial.query);
  const [query, setQuery] = useState(initial.query);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const typeQuery = useCallback(
    (value: string) => {
      setQueryValue(value);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setQuery(value), searchDelay);
    },
    [searchDelay],
  );
  const setQueryNow = useCallback((value: string) => {
    clearTimeout(timer.current);
    setQueryValue(value);
    setQuery(value);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);

  const [filters, setFilters] = useState<SavedViewFilter[]>(initial.filters);
  const [sort, setSort] = useState(initial.sort);
  const [columns, setColumns] = useState<SavedViewColumns>(initial.columns);

  // ---- The page as it stands against the selected view ----
  const current = useMemo(
    () => ({
      sort,
      query,
      filters,
      columns: columnsToStore(columns, columnKeys, defaultHidden),
    }),
    [sort, query, filters, columns, columnKeys, defaultHidden],
  );
  const selectedView = views[selected];
  const dirty = useMemo(() => {
    if (!selectedView) return false;
    return (
      (selectedView.sort || defaultSort) !== current.sort ||
      selectedView.query.trim() !== current.query.trim() ||
      canonicalFilters(selectedView.filters) !== canonicalFilters(current.filters) ||
      JSON.stringify(selectedView.columns ?? null) !== JSON.stringify(current.columns ?? null)
    );
  }, [selectedView, current, defaultSort]);

  const load = useCallback(
    (view: SavedView) => {
      setQueryNow(view.query);
      setFilters(view.filters);
      setSort(view.sort || defaultSort);
      setColumns(reconcileColumns(view.columns, columnKeys, defaultHidden));
    },
    [setQueryNow, defaultSort, columnKeys, defaultHidden],
  );

  const persist = useCallback(
    async (next: SavedView[]) => {
      await onViewsChange?.(next);
      setViews(next);
      return next;
    },
    [onViewsChange],
  );

  const select = useCallback(
    (index: number) => {
      const view = views[index];
      if (!view) return;
      setSelected(index);
      load(view);
    },
    [views, load],
  );
  const reset = useCallback(() => {
    if (selectedView) load(selectedView);
  }, [selectedView, load]);
  const titleTaken = useCallback(
    (title: string, except?: number) =>
      views.some((view, index) => index !== except && sameTitle(view.title, title)),
    [views],
  );
  const create = useCallback(
    async (title: string) => {
      const next = await persist([...views, { ...current, title: title.trim() }]);
      setSelected(next.length - 1);
    },
    [views, current, persist],
  );
  const update = useCallback(async () => {
    if (selected === 0) return;
    await persist(
      views.map((view, i) => (i === selected ? { ...current, title: view.title } : view)),
    );
    onToast?.(labels.viewModals.savedToast);
  }, [selected, views, current, persist, onToast, labels]);
  const rename = useCallback(
    async (index: number, title: string) => {
      if (index === 0) return;
      await persist(
        views.map((view, i) => (i === index ? { ...view, title: title.trim() } : view)),
      );
    },
    [views, persist],
  );
  const duplicate = useCallback(
    async (index: number, title: string) => {
      const source = views[index];
      if (!source) return;
      const next = await persist([...views, { ...source, title: title.trim() }]);
      setSelected(next.length - 1);
      load(next[next.length - 1] as SavedView);
    },
    [views, persist, load],
  );
  const remove = useCallback(
    async (index: number) => {
      if (index === 0) return;
      const next = await persist(views.filter((_view, i) => i !== index));
      setSelected(0);
      load(next[0] as SavedView);
    },
    [views, persist, load],
  );

  // ---- A saved view's own search and filters: applied, out of the bar until the eye ----
  const [revealedView, setRevealedView] = useState<number | null>(null);
  const revealed = revealedView === selected;
  const viewFilters = useMemo(() => {
    const view = selected > 0 ? selectedView : undefined;
    const split = splitViewFilters(filters, view?.filters ?? [], false);
    const splitQuery = splitViewQuery(queryValue, view?.query ?? "", false);
    const hasOwn = Boolean(view?.filters.length || view?.query.trim());
    const eye = hasOwn && split.intact && splitQuery.intact;
    const hide = eye && !revealed;
    return {
      eye,
      shownFilters: hide ? split.shown : filters,
      hiddenFilters: hide ? split.hidden : [],
      shownQuery: hide ? splitQuery.shown : queryValue,
      hiddenQuery: hide ? splitQuery.hidden : "",
    };
  }, [filters, queryValue, selected, selectedView, revealed]);
  const { shownFilters, hiddenFilters, shownQuery, hiddenQuery } = viewFilters;

  // ---- The URL follows the state ----
  useEffect(() => {
    if (!url) return;
    writeUrlState(
      fields,
      { query, sort, view: selected > 0 ? (selectedView?.title ?? "") : "", filters },
      defaultSort,
    );
  }, [url, fields, query, sort, selected, selectedView, filters, defaultSort]);

  // ---- The save modals ----
  const [modal, setModal] = useState<ViewModalRequest | null>(null);
  const labelFor = useCallback(
    (index: number) => (index === 0 ? labels.views.all : (views[index]?.title ?? "")),
    [labels, views],
  );

  const visibleColumns = useMemo(
    () => columns.order.filter((key) => !columns.hidden.includes(key)),
    [columns],
  );
  const usedFields = useMemo(() => hiddenFilters.map((f) => f.field), [hiddenFilters]);
  const searchLabels = useMemo(() => toSearchFieldLabels(labels), [labels]);
  const popoverColumns = useMemo(
    (): ColumnsPopoverColumn[] =>
      columns.order.map((key) => ({
        key,
        label: pageColumns.find((column) => column.key === key)?.label ?? key,
        visible: !columns.hidden.includes(key),
      })),
    [columns, pageColumns],
  );

  /** Clears what the bar shows; a hidden view's own search and filters stay. */
  const clear = useCallback(() => {
    const keepView = shownQuery.trim() !== "" || shownFilters.length > 0;
    setQueryNow(keepView ? hiddenQuery : "");
    setFilters(keepView ? hiddenFilters : []);
  }, [shownQuery, shownFilters, hiddenQuery, hiddenFilters, setQueryNow]);

  const props: IndexFilterBarProps = {
    id,
    labels,
    readOnly,
    views: !savedViews
      ? null
      : {
          titles: views.map((view) => view.title),
          selected,
          onSelect: (index) => {
            setRevealedView(null);
            select(index);
          },
          onAction: (index: number, action: ViewAction) => setModal({ kind: action, index }),
        },
    search: {
      value: shownQuery,
      onChange: (value) => typeQuery(mergeViewQuery(value, hiddenQuery)),
      fields,
      filters: shownFilters,
      onFiltersChange: (next) => setFilters(mergeViewFilters(next, hiddenFilters)),
      usedFields,
      labels: searchLabels,
    },
    columns:
      sortOptions.length > 0 || pageColumns.length > 0
        ? {
            sortOptions,
            sort,
            onSortChange: setSort,
            columns: popoverColumns,
            onReorder: (order) => setColumns((c) => ({ ...c, order })),
            onToggle: (key) =>
              setColumns((c) => ({
                ...c,
                hidden: c.hidden.includes(key)
                  ? c.hidden.filter((k) => k !== key)
                  : [...c.hidden, key],
              })),
          }
        : null,
    viewFilters:
      savedViews && viewFilters.eye
        ? { revealed, onToggle: () => setRevealedView(revealed ? null : selected) }
        : null,
    save: !savedViews
      ? null
      : {
          dirty,
          onAll: selected === 0,
          onReset: reset,
          onSaveAsNew: () => setModal({ kind: "create", index: selected }),
          onUpdate: () => {
            update().catch((error: unknown) => onError?.(error, "create"));
          },
        },
    modals: !savedViews
      ? null
      : {
          request: modal,
          labelFor,
          titleTaken,
          onCreate: create,
          onRename: rename,
          onDuplicate: duplicate,
          onDelete: remove,
          onToast,
          onError,
        },
  };

  return {
    /** The search to send (debounced), the view's hidden search included. */
    query,
    /**
     * Typed text is waiting out the search delay: `query` is about to change.
     * Show the table loading from the first key: `loading={isFetching || bar.pending}`.
     */
    pending: queryValue !== query,
    /** The filters to apply, the view's hidden ones included. */
    filters,
    /** "field direction". */
    sort,
    setSort,
    /** Column keys to show, in order. */
    visibleColumns,
    /** The selected view: its index (0 is All), title, and whether the page differs from it. */
    view: { index: selected, title: labelFor(selected), dirty: savedViews && dirty },
    /** Anything narrowing the list, for an empty state's "Clear search and filters". */
    hasFilters: filters.length > 0 || queryValue.trim() !== "",
    clear,
    /** Spread into `<IndexFilterBar>`. */
    props,
  };
};

/** What `<IndexFilterBar>` draws; built by `useIndexFilters`. */
export interface IndexFilterBarProps {
  id: string;
  labels: IndexFilterBarLabels;
  readOnly: boolean;
  /** The views button; null without saved views. */
  views: {
    titles: string[];
    selected: number;
    onSelect: (index: number) => void;
    onAction: (index: number, action: ViewAction) => void;
  } | null;
  search: {
    value: string;
    onChange: (value: string) => void;
    fields: FilterField[];
    filters: SavedViewFilter[];
    onFiltersChange: (filters: SavedViewFilter[]) => void;
    usedFields: string[];
    labels: ReturnType<typeof toSearchFieldLabels>;
  };
  columns: {
    sortOptions: SortOption[];
    sort: string;
    onSortChange: (sort: string) => void;
    columns: ColumnsPopoverColumn[];
    onReorder: (order: string[]) => void;
    onToggle: (key: string) => void;
  } | null;
  viewFilters: { revealed: boolean; onToggle: () => void } | null;
  save: {
    dirty: boolean;
    onAll: boolean;
    onReset: () => void;
    onSaveAsNew: () => void;
    onUpdate: () => void;
  } | null;
  modals: {
    request: ViewModalRequest | null;
    labelFor: (index: number) => string;
    titleTaken: (title: string, except?: number) => boolean;
    onCreate: (title: string) => Promise<void>;
    onRename: (index: number, title: string) => Promise<void>;
    onDuplicate: (index: number, title: string) => Promise<void>;
    onDelete: (index: number) => Promise<void>;
    onToast?: (message: string) => void;
    onError?: (error: unknown, action: ViewModalKind) => void;
  } | null;
}
