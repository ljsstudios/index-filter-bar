import {
  attachDatePart,
  type DatePartName,
  dateFromParts,
  PART_PLACEHOLDER,
  tidyDatePart,
} from "./datePart";
import type { FilterField, FilterUnit } from "./types";

/**
 * A typed date unit's value chip: YYYY-MM-DD as three part inputs, or "Starting …
 * – Ending …" for a range. Like numbers, the parts are editing hosts inside
 * the field and their text is the truth while one has focus.
 */

export interface DateChipClasses {
  chip: string;
  value: string;
  lastValue: string;
  remove: string;
  date: string;
  dateRange: string;
  dateGroup: string;
  datePart: string;
  dateSeparator: string;
  dateLabel: string;
  rangeSeparator: string;
}

export interface DateLabels {
  remove: string;
  starting: string;
  ending: string;
}

const PARTS: DatePartName[] = ["year", "month", "day"];

export const isDateField = (field: FilterField | undefined) => field?.kind === "date";

/** A date unit with typed dates rather than a preset. */
export const isTypedDate = (field: FilterField | undefined, unit: FilterUnit | undefined) =>
  isDateField(field) && !!unit?.shape;

/** The parts of a group, year first. */
export const groupParts = (group: Element) => [
  ...group.querySelectorAll<HTMLElement>("[data-date-part]"),
];

/** The group's date when its parts make a real one, else "". */
export const groupDate = (group: Element) => {
  const [year, month, day] = groupParts(group).map((part) => part.textContent ?? "");
  return dateFromParts(year ?? "", month ?? "", day ?? "") ?? "";
};

/** The unit's values: [date], or [start, end]; [] while none is a real date. */
export const readDateValues = (span: HTMLElement) => {
  const values = [...span.querySelectorAll("[data-group]")].map(groupDate);
  return values.some((v) => v !== "") ? values : [];
};

/** Pads and clamps every part, as a blur would, so Enter reads what blur shows. */
export const tidyDateParts = (span: HTMLElement) => {
  for (const part of span.querySelectorAll<HTMLElement>("[data-date-part]")) {
    const tidy = tidyDatePart(part.textContent ?? "", part.dataset.datePart as DatePartName);
    if (tidy !== part.textContent) part.textContent = tidy;
  }
};

/** "2026-11-03", or "Starting 2026-11-03 – Ending 2026-11-12" with an unset end left out. */
export const dateValueText = (values: string[], shape: "date" | "range", labels: DateLabels) => {
  if (shape === "date") return values[0] ?? "";
  const [start = "", end = ""] = values;
  return [start && `${labels.starting} ${start}`, end && `${labels.ending} ${end}`]
    .filter(Boolean)
    .join(" – ");
};

const removeButton = (classes: DateChipClasses, label: string) => {
  const remove = document.createElement("button");
  remove.type = "button";
  remove.tabIndex = -1;
  remove.dataset.part = "remove";
  remove.dataset.parity = "chip-remove";
  remove.className = classes.remove;
  remove.setAttribute("aria-label", label);
  remove.innerHTML =
    '<svg viewBox="0 0 8 8" width="8" height="8" fill="currentColor" aria-hidden="true"><path d="M1.28.22a.75.75 0 0 0-1.06 1.06L2.94 4 .22 6.72a.75.75 0 1 0 1.06 1.06L4 5.06l2.72 2.72a.75.75 0 0 0 1.06-1.06L5.06 4l2.72-2.72A.75.75 0 0 0 6.72.22L4 2.94z"/></svg>';
  return remove;
};

const span = (className: string, text?: string) => {
  const el = document.createElement("span");
  el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
};

/** Moves to the next part of the group when one fills. */
const nextPart = (input: HTMLElement) => {
  const group = input.closest("[data-group]");
  if (!group) return;
  const parts = groupParts(group);
  const next = parts[parts.indexOf(input) + 1];
  if (!next) return;
  next.focus({ preventScroll: true });
  const range = document.createRange();
  range.selectNodeContents(next);
  range.collapse(true);
  document.getSelection()?.removeAllRanges();
  document.getSelection()?.addRange(range);
};

/**
 * Builds or refreshes the value chip. A change of shape rebuilds it;
 * otherwise only parts whose text differs from the values are set, so a
 * focused part keeps its caret.
 */
export const renderDateValue = (
  unitSpan: HTMLSpanElement,
  unit: FilterUnit,
  classes: DateChipClasses,
  labels: DateLabels,
) => {
  const shape = unit.shape ?? "date";
  let chip = unitSpan.querySelector<HTMLSpanElement>("[data-part='value']");
  if (chip && chip.dataset.shape !== shape) {
    chip.remove();
    chip = null;
  }
  if (!chip) {
    chip = document.createElement("span");
    chip.dataset.part = "value";
    chip.dataset.parity = "value-chip";
    chip.dataset.shape = shape;
    chip.className = [
      classes.chip,
      classes.value,
      classes.lastValue,
      shape === "range" ? classes.dateRange : classes.date,
    ].join(" ");
    const groups = shape === "range" ? 2 : 1;
    let index = 0;
    for (let g = 0; g < groups; g += 1) {
      const group = span(classes.dateGroup);
      group.dataset.group = String(g);
      group.dataset.parity = `date-group-${g}`;
      if (g === 1) {
        const dash = span(classes.rangeSeparator, "–");
        dash.dataset.parity = "date-range-separator";
        group.append(dash);
      }
      if (shape === "range") {
        const label = span(classes.dateLabel, g === 0 ? labels.starting : labels.ending);
        label.dataset.parity = `date-label-${g}`;
        group.append(label);
      }
      PARTS.forEach((name, p) => {
        if (p > 0) {
          const separator = span(classes.dateSeparator, "-");
          separator.dataset.parity = "date-separator";
          group.append(separator);
        }
        const part = span(classes.datePart);
        part.contentEditable = "true";
        part.spellcheck = false;
        part.dataset.input = String(index);
        part.dataset.datePart = name;
        part.dataset.placeholder = PART_PLACEHOLDER[name];
        part.dataset.parity = `date-part-${g}-${name}`;
        attachDatePart(part, name, nextPart);
        group.append(part);
        index += 1;
      });
      chip.append(group);
    }
    chip.append(removeButton(classes, labels.remove));
    unitSpan.append(chip);
  }
  // Set the parts from the values, leaving a part alone while it says the same.
  [...chip.querySelectorAll("[data-group]")].forEach((group, g) => {
    const value = unit.values[g] ?? "";
    if (value === groupDate(group)) return;
    const [y = "", m = "", d = ""] = value ? value.split("-") : [];
    groupParts(group).forEach((part, p) => {
      const text = [y, m, d][p] ?? "";
      if ((part.textContent ?? "") !== text) part.textContent = text;
    });
  });
};
