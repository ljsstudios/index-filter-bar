import { attachNumberInput, DEFAULT_PRECISION, numberPlaceholder } from "./numberInput";
import type { FilterField, FilterUnit } from "./types";

/**
 * A number unit's value chip: unlike a list unit it
 * exists from creation, holding one editable number, or two with an en dash
 * for "Is between". The inputs are their own editing hosts inside the
 * field; while one has focus its text is the truth, read back on Enter,
 * blur or arrowing out.
 */

export interface NumberChipClasses {
  chip: string;
  value: string;
  lastValue: string;
  remove: string;
  numeric: string;
  range: string;
  container: string;
  input: string;
  separator: string;
  prefix: string;
  suffix: string;
}

export const isNumberField = (field: FilterField | undefined) => field?.kind === "number";

export const isRangeOperator = (field: FilterField, operator: string) =>
  !!field.operators.find((o) => o.value === operator)?.range;

/** The unit's inputs, first then second. */
export const numberInputs = (span: HTMLElement) => [
  ...span.querySelectorAll<HTMLElement>("[data-input]"),
];

/** The values the inputs hold: [n], [min, max], or [] while all are empty. */
export const readNumberValues = (span: HTMLElement) => {
  const values = numberInputs(span).map((input) => (input.textContent ?? "").trim());
  return values.some((v) => v !== "") ? values : [];
};

/** "5", or "5 – 20" for a range, each with the currency before it; an empty end stays empty. */
export const numberValueText = (values: string[], range: boolean, prefix = "", suffix = "") => {
  const amount = (value = "") => (value ? `${prefix}${value}${suffix ? ` ${suffix}` : ""}` : value);
  return range ? `${amount(values[0])} – ${amount(values[1])}`.trim() : amount(values[0]);
};

const removeButton = (classes: NumberChipClasses, label: string) => {
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

/**
 * Builds or refreshes the value chip. A change of shape (one number to two)
 * rebuilds it; otherwise only inputs whose text differs are set, so a caret
 * in a focused input stays put.
 */
export const renderNumberValue = (
  span: HTMLSpanElement,
  unit: FilterUnit,
  field: FilterField,
  classes: NumberChipClasses,
  labels: { remove: string },
) => {
  const range = isRangeOperator(field, unit.operator);
  const precision = field.number ?? DEFAULT_PRECISION;
  let chip = span.querySelector<HTMLSpanElement>("[data-part='value']");
  if (chip && chip.dataset.range !== String(range)) {
    chip.remove();
    chip = null;
  }
  if (!chip) {
    chip = document.createElement("span");
    chip.dataset.part = "value";
    chip.dataset.parity = "value-chip";
    chip.dataset.range = String(range);
    chip.className = [
      classes.chip,
      classes.value,
      classes.lastValue,
      range ? classes.range : classes.numeric,
    ].join(" ");
    for (let index = 0; index < (range ? 2 : 1); index += 1) {
      const container = document.createElement("span");
      container.className = classes.container;
      container.dataset.container = String(index);
      container.dataset.parity = `number-container-${index}`;
      if (index === 1) {
        const separator = document.createElement("span");
        separator.className = classes.separator;
        separator.dataset.parity = "number-separator";
        separator.textContent = "–";
        container.append(separator);
      }
      // A currency's code and symbol sit before each amount.
      if (field.number?.prefix) {
        const prefix = document.createElement("span");
        prefix.className = classes.prefix;
        prefix.dataset.parity = `number-prefix-${index}`;
        prefix.textContent = field.number.prefix;
        container.append(prefix);
      }
      const input = document.createElement("span");
      input.className = classes.input;
      input.contentEditable = "true";
      input.dataset.input = String(index);
      input.dataset.parity = `number-input-${index}`;
      input.dataset.placeholder = numberPlaceholder(
        precision,
        undefined,
        !!field.number?.prefix && !range,
      );
      input.spellcheck = false;
      attachNumberInput(input, precision);
      container.append(input);
      // A measurement's unit sits after each number.
      if (field.number?.suffix) {
        const suffix = document.createElement("span");
        suffix.className = classes.suffix;
        suffix.dataset.parity = `number-suffix-${index}`;
        suffix.textContent = field.number.suffix;
        container.append(suffix);
      }
      chip.append(container);
    }
    chip.append(removeButton(classes, labels.remove));
    span.append(chip);
  }
  numberInputs(span).forEach((input, index) => {
    const text = unit.values[index] ?? "";
    if ((input.textContent ?? "") !== text) input.textContent = text;
  });
};
