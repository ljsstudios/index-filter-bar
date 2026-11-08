/** One choice of a list filter, e.g. Synced. */
export interface FilterValue {
  value: string;
  label: string;
}

/** A condition, e.g. Is / Is not, with the words the chip and field list use. */
export interface FilterOperator {
  value: string;
  /** In the condition menu: "Is", "Is not". */
  label: string;
  /** On the param chip, and in the field list for anything but the first: "Sync status is not". */
  chipLabel: string;
  /** Number fields: the condition takes two numbers, "Is between". */
  range?: boolean;
}

/** A filterable field the bar offers (the admin's filter choice). */
export interface FilterField {
  key: string;
  /**
   * A list of values to pick from; a number typed into the chip; or a date:
   * a list of presets plus Custom date and Custom range, which turn the chip
   * into typed dates with a calendar. List by default.
   */
  kind?: "list" | "number" | "date" | "text";
  /** Number fields: decimals kept (the admin's min/maxPrecision, default 0 and 2). */
  number?: {
    minPrecision: number;
    maxPrecision: number;
    /** A currency amount: the code and symbol before each number, "USD $". */
    prefix?: string;
    /** A measurement: the unit after each number, "lb". */
    suffix?: string;
  };
  /**
   * A filter the page puts in that can be removed but not opened or changed,
   * never offered in the field list (the admin's readOnly choices). Its values show through `values` labels, or raw.
   */
  readOnly?: boolean;
  /** Text fields: the empty chip's hint ("xxxx") and an optional length. */
  text?: { placeholder?: string; maxLength?: number };
  /** In the field list: "Sync status". */
  name: string;
  /** Several values (checkboxes) or one (ticks). */
  multi: boolean;
  /**
   * The values to pick from. A long list is shown 25 at a time, the next 25
   * on scrolling to its end. With `fetchMoreValues`, these are the values
   * loaded so far for the current search.
   */
  values: FilterValue[];
  /**
   * Values from a server, a page at a time, as the admin's long lists are.
   * Called with the text typed after the chip ("" for none): when the list
   * opens empty, 250ms after the typing stops (replace `values` with that
   * search's first page), and on scrolling to the end while `hasNextPage`
   * (add the next page). The list shows a loading row until it resolves, and
   * doesn't narrow the values itself.
   */
  fetchMoreValues?: (search: string) => Promise<void> | void;
  /** More values to fetch for the current search. */
  hasNextPage?: boolean;
  /** The first is the default condition. */
  operators: FilterOperator[];
}

/**
 * A filter in the bar: a field, a condition and its values. A number unit
 * holds [n], or [min, max] for a range where either end may be "" (a half
 * range applies just its set end); none while nothing is typed.
 */
export interface FilterUnit {
  id: string;
  field: string;
  operator: string;
  values: string[];
  /**
   * Date fields: a typed date, ["2026-11-03"], or a range, [start, end] with
   * either end "" for a half range. Without it a date unit holds a preset.
   */
  shape?: "date" | "range";
}
