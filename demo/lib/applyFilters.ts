import type { FilterField, SavedViewFilter } from "@ljsstudios/index-filter-bar";

/**
 * The demo's stand-in for a server: applies the bar's search and filters to
 * rows in the browser. A real app sends `query`, `filters` and `sort` to its
 * own API instead; this shows what each filter type means.
 */

/** What a row holds for a field: a value, several (tags), a number or a date. */
export type FieldValue = string | number | Date | null | readonly string[];
export type Accessors<Row> = Record<string, (row: Row) => FieldValue>;

const DAY = 24 * 60 * 60 * 1000;

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const fromIso = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y ?? 0, (m ?? 1) - 1, d ?? 1);
};

/** A date filter as the days it covers: [from, to), either end open. */
const dateBounds = (filter: SavedViewFilter): [number, number] => {
  const today = startOfDay(new Date()).getTime();
  if (filter.shape === "date") {
    const day = fromIso(filter.values[0] ?? "").getTime();
    return [day, day + DAY];
  }
  if (filter.shape === "range") {
    const [start = "", end = ""] = filter.values;
    return [
      start ? fromIso(start).getTime() : -Infinity,
      end ? fromIso(end).getTime() + DAY : Infinity,
    ];
  }
  const preset = filter.values[0] ?? "";
  const future = { tomorrow: [1, 2], next_week: [0, 7], next_month: [0, 30] }[preset];
  if (future) return [today + (future[0] ?? 0) * DAY, today + (future[1] ?? 0) * DAY];
  const days = { today: 1, past_week: 7, past_month: 30, past_quarter: 90, past_year: 365 }[preset];
  return days ? [today - (days - 1) * DAY, today + DAY] : [-Infinity, Infinity];
};

const asNumber = (text: string | undefined) =>
  text === undefined || text === "" ? undefined : Number(text);

/** True when one row's value meets one filter. */
const meets = (field: FilterField, filter: SavedViewFilter, value: FieldValue): boolean => {
  const negate = filter.operator === "is_not";

  if (field.kind === "date") {
    if (!(value instanceof Date)) return negate;
    const [from, to] = dateBounds(filter);
    const inside = value.getTime() >= from && value.getTime() < to;
    return negate ? !inside : inside;
  }

  if (field.kind === "number") {
    if (typeof value !== "number") return false;
    const [a, b] = filter.values.map(asNumber);
    switch (filter.operator) {
      case "between":
        return (a === undefined || value >= a) && (b === undefined || value <= b);
      case "gt":
        return a === undefined || value > a;
      case "lt":
        return a === undefined || value < a;
      case "is_not":
        return a === undefined || value !== a;
      default:
        return a === undefined || value === a;
    }
  }

  if (field.kind === "text") {
    const want = (filter.values[0] ?? "").trim().toLowerCase();
    const have = String(value ?? "").toLowerCase();
    return negate ? have !== want : have === want;
  }

  // A list: any of the chosen values (Is), or none of them (Is not).
  const have = Array.isArray(value) ? value : value == null ? [] : [String(value)];
  const hit = filter.values.some((wanted) => have.includes(wanted));
  return negate ? !hit : hit;
};

/**
 * The rows that match the search (every word, anywhere in `searchIn`) and
 * every filter.
 */
export const applyFilters = <Row>(
  rows: readonly Row[],
  {
    query,
    filters,
    fields,
    accessors,
    searchIn,
  }: {
    query: string;
    filters: readonly SavedViewFilter[];
    fields: readonly FilterField[];
    accessors: Accessors<Row>;
    searchIn: (row: Row) => string;
  },
): Row[] => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter((row) => {
    if (words.length > 0) {
      const text = searchIn(row).toLowerCase();
      if (!words.every((word) => text.includes(word))) return false;
    }
    return filters.every((filter) => {
      const field = fields.find((f) => f.key === filter.field);
      const read = accessors[filter.field];
      return !field || !read || meets(field, filter, read(row));
    });
  });
};

/** Sorts rows by "field direction", with a value per sortable field. */
export const sortRows = <Row>(
  rows: readonly Row[],
  sort: string,
  values: Record<string, (row: Row) => string | number | Date>,
): Row[] => {
  const [field = "", direction = "asc"] = sort.split(" ");
  const read = values[field];
  if (!read) return [...rows];
  const sign = direction === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => {
    const x = read(a);
    const y = read(b);
    if (typeof x === "string" && typeof y === "string") return sign * x.localeCompare(y);
    return sign * (Number(x) - Number(y));
  });
};
