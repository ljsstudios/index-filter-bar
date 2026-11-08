import type { FilterField, FilterValue } from "@ljsstudios/index-filter-bar";
import { choices } from "./data";

/**
 * The demo's field builders, one per filter type, with the admin's
 * conditions and their order for each.
 */

const isOps = (name: string) => [
  { value: "is", label: "Is", chipLabel: `${name} is` },
  { value: "is_not", label: "Is not", chipLabel: `${name} is not` },
];

/** A list of values to tick (several at once unless `single`). */
export const listField = (
  key: string,
  name: string,
  values: Iterable<string> | FilterValue[],
  { single = false }: { single?: boolean } = {},
): FilterField => ({
  key,
  name,
  multi: !single,
  values:
    Array.isArray(values) && typeof values[0] === "object"
      ? (values as FilterValue[])
      : choices(values as Iterable<string>),
  operators: isOps(name),
});

const numberOps = (name: string, rangeFirst: boolean) => {
  const is = { value: "is", label: "Is", chipLabel: `${name} is` };
  const between = {
    value: "between",
    label: "Is between",
    chipLabel: `${name} is between`,
    range: true,
  };
  const rest = [
    { value: "gt", label: "Is greater than", chipLabel: `${name} is greater than` },
    { value: "lt", label: "Is less than", chipLabel: `${name} is less than` },
  ];
  const isNot = { value: "is_not", label: "Is not", chipLabel: `${name} is not` };
  return rangeFirst ? [between, ...rest, is, isNot] : [is, between, ...rest, isNot];
};

/** A whole number (Inventory's Available, On hand…). */
export const numberField = (key: string, name: string): FilterField => ({
  key,
  name,
  kind: "number",
  number: { minPrecision: 0, maxPrecision: 0 },
  multi: false,
  values: [],
  operators: numberOps(name, false),
});

/** An amount of money, the currency before it, starting as a range (Order total). */
export const currencyField = (key: string, name: string, prefix: string): FilterField => ({
  key,
  name,
  kind: "number",
  number: { minPrecision: 0, maxPrecision: 2, prefix },
  multi: false,
  values: [],
  operators: numberOps(name, true),
});

/** A measurement, its unit after it, starting as a range (Total product weight). */
export const measurementField = (key: string, name: string, suffix: string): FilterField => ({
  key,
  name,
  kind: "number",
  number: { minPrecision: 0, maxPrecision: 4, suffix },
  multi: false,
  values: [],
  operators: numberOps(name, true),
});

/** A date: presets, then Custom date and Custom range. */
export const dateField = (key: string, name: string, presets: FilterValue[]): FilterField => ({
  key,
  name,
  kind: "date",
  multi: false,
  values: presets,
  operators: isOps(name),
});

/** Typed text, optionally with a hint and a length (Credit card last 4 digits). */
export const textField = (
  key: string,
  name: string,
  text: { placeholder?: string; maxLength?: number } = {},
): FilterField => ({
  key,
  name,
  kind: "text",
  text,
  multi: false,
  values: [],
  operators: isOps(name),
});

/** The admin's past-date presets (Orders' Date). */
export const PAST_DATES: FilterValue[] = [
  { value: "today", label: "Today" },
  { value: "past_week", label: "Last 7 days" },
  { value: "past_month", label: "Last 30 days" },
  { value: "past_quarter", label: "Last 90 days" },
  { value: "past_year", label: "Last 12 months" },
];

/** The admin's Fulfill by presets, future ones first. */
export const FULFILL_BY_DATES: FilterValue[] = [
  { value: "next_month", label: "Next 30 days" },
  { value: "next_week", label: "Next 7 days" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "today", label: "Today" },
  { value: "past_week", label: "Last 7 days" },
  { value: "past_month", label: "Last 30 days" },
];
