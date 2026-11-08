import en from "./locales/en.json";

/**
 * Every word the bar shows, grouped by the part that shows it. Plain strings,
 * so a locale file (`@ljsstudios/index-filter-bar/locales/de.json`) is the
 * same shape. `{name}` and `{count}` are filled in where the text says so.
 */
export interface IndexFilterBarLabels {
  search: {
    placeholder: string;
    clear: string;
    removeFilter: string;
    /** The keycap on the highlighted row. */
    enter: string;
    /** The field list's accessible name. */
    fieldList: string;
    /** After a cut-off value list, with `{count}`: " + {count} more". */
    more: string;
    noOptions: string;
    addFilter: string;
    customDate: string;
    customRange: string;
    starting: string;
    ending: string;
  };
  /** Words only a screen reader hears. `{chip}` is a filter's words, `{field}` its name. */
  a11y: {
    /** The field's description: how chips are reached and removed. */
    help: string;
    remove: string;
    values: string;
    condition: string;
    minimum: string;
    maximum: string;
    year: string;
    month: string;
    day: string;
    added: string;
    changed: string;
    removed: string;
    chipHint: string;
  };
  /** The standard conditions, for building fields (`operators` helpers). */
  operators: {
    is: string;
    isNot: string;
    between: string;
    greaterThan: string;
    lessThan: string;
  };
  views: {
    all: string;
    switch: string;
    /** With `{name}`. */
    actions: string;
    rename: string;
    duplicate: string;
    delete: string;
    resetView: string;
    save: string;
    updateView: string;
    saveAsNew: string;
    showViewFilters: string;
    hideViewFilters: string;
  };
  viewModals: {
    saveAsHeading: string;
    viewNameLabel: string;
    nameLabel: string;
    nameTaken: string;
    /** With `{name}`. */
    copyOf: string;
    createView: string;
    save: string;
    discard: string;
    cancel: string;
    deleteHeading: string;
    /** With `{name}`. */
    deleteBody: string;
    saveFailed: string;
    createdToast: string;
    renamedToast: string;
    deletedToast: string;
  };
  columns: {
    displayOptions: string;
    sortBy: string;
    /** The sort button's name, with `{sort}`. */
    sortByNamed: string;
    columns: string;
    show: string;
    hide: string;
    /** Screen reader words while a column is moved by the keys, with `{column}`. */
    reorder: string;
    dragInstructions: string;
    pickedUp: string;
    /** With `{column}`, `{position}` and `{total}`. */
    movedTo: string;
    dropped: string;
    cancelled: string;
  };
  /** The sort header's tooltip, by the column's kind of value. */
  sort: {
    aToZ: string;
    zToA: string;
    lowToHigh: string;
    highToLow: string;
    oldestFirst: string;
    newestFirst: string;
  };
}

/** English, the default for every label. */
export const defaultLabels: IndexFilterBarLabels = en;

/** Labels with some groups or words replaced; anything left out stays English. */
export type PartialLabels = {
  [G in keyof IndexFilterBarLabels]?: Partial<IndexFilterBarLabels[G]>;
};

/** English with `overrides` laid over it, group by group. */
export const mergeLabels = (overrides: PartialLabels = {}): IndexFilterBarLabels => {
  const merged = { ...defaultLabels };
  for (const group of Object.keys(defaultLabels) as (keyof IndexFilterBarLabels)[]) {
    const own = overrides[group];
    if (own) Object.assign(merged, { [group]: { ...defaultLabels[group], ...own } });
  }
  return merged;
};

/** Fills `{name}`-style holes: `format("Copy of {name}", { name: "Draft" })`. */
export const format = (template: string, values: Record<string, string | number>): string =>
  template.replace(/\{(\w+)\}/g, (hole, key: string) =>
    key in values ? String(values[key]) : hole,
  );
