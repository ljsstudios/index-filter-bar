import { type DateLabels, dateValueText, isTypedDate, renderDateValue } from "./dateUnit";
import { isNumberField, isRangeOperator, numberValueText, renderNumberValue } from "./numberUnit";
import { isTextField, renderTextValue } from "./textUnit";
import type { FilterField, FilterUnit } from "./types";

/**
 * The search field's DOM: one contenteditable holding text nodes and filter
 * units. A unit is a non-editable span, its param chip, and
 * once it has values its value chip with a remove button. Units are built
 * here, not by React: the browser edits the text around them, so React
 * cannot own the field's children.
 */

export interface ChipClasses {
  unit: string;
  chip: string;
  param: string;
  value: string;
  lastValue: string;
  active: string;
  remove: string;
  numeric: string;
  range: string;
  container: string;
  input: string;
  separator: string;
  date: string;
  dateRange: string;
  dateGroup: string;
  datePart: string;
  dateSeparator: string;
  dateLabel: string;
  rangeSeparator: string;
  textChip: string;
  textInput: string;
  prefix: string;
  suffix: string;
  readOnlyParam: string;
  readOnlyValue: string;
}

const NBSP = " ";

export const isUnitSpan = (node: Node | null | undefined): node is HTMLSpanElement =>
  node instanceof HTMLSpanElement && !!node.dataset.unitId;

const startsWithSpace = (text: string) => /^[\s\u00a0]/.test(text);

/** "A, B, C + 2 more", each label cut at 40; a read-only label whole. */
export const valueText = (
  field: FilterField,
  values: string[],
  moreLabel: (n: number) => string,
) => {
  const labels = values.map((value) => {
    const label = field.values.find((v) => v.value === value)?.label ?? value;
    return label.length > 40 && !field.readOnly ? `${label.slice(0, 39)}…` : label;
  });
  return labels.length > 3
    ? `${labels.slice(0, 3).join(", ")}${moreLabel(labels.length - 3)}`
    : labels.join(", ");
};

/** The words a unit reads as: "Sync status is Synced", "Available is between 5 – 20". */
export const unitText = (
  field: FilterField,
  unit: FilterUnit,
  more: (n: number) => string,
  dateLabels?: DateLabels,
) => {
  const words = [chipLabel(field, unit.operator)];
  if (isTypedDate(field, unit) && dateLabels && unit.shape) {
    const text = dateValueText(unit.values, unit.shape, dateLabels);
    if (text) words.push(text);
  } else if (isTextField(field)) {
    if (unit.values[0]) words.push(unit.values[0]);
  } else if (isNumberField(field)) {
    const text = numberValueText(
      unit.values,
      isRangeOperator(field, unit.operator),
      field.number?.prefix,
      field.number?.suffix,
    );
    if (text) words.push(text);
  } else if (unit.values.length > 0) words.push(valueText(field, unit.values, more));
  return words.join(" ");
};

export const chipLabel = (field: FilterField, operator: string) =>
  field.operators.find((o) => o.value === operator)?.chipLabel ?? field.name;

interface UnitLabels {
  remove: string;
  more: (n: number) => string;
  starting: string;
  ending: string;
  a11y?: {
    remove: (chip: string) => string;
    minimum: string;
    maximum: string;
    year: string;
    month: string;
    day: string;
  };
}

/** Builds or refreshes a unit's span, then names its controls for screen readers. */
export const renderUnit = (
  span: HTMLSpanElement,
  unit: FilterUnit,
  field: FilterField,
  classes: ChipClasses,
  labels: UnitLabels,
) => {
  drawUnit(span, unit, field, classes, labels);
  if (labels.a11y) nameUnit(span, unit, field, labels, labels.a11y);
};

/**
 * What a screen reader hears for a unit's controls:
 * each ✕ names its chip ("Remove Available is 5"), each typed input is a
 * named textbox ("Order total (USD $), minimum", "Date, Starting year").
 */
const nameUnit = (
  span: HTMLSpanElement,
  unit: FilterUnit,
  field: FilterField,
  labels: UnitLabels,
  a11y: NonNullable<UnitLabels["a11y"]>,
) => {
  const text = unitText(field, unit, labels.more, labels);
  for (const remove of span.querySelectorAll<HTMLElement>("[data-part='remove']")) {
    remove.setAttribute("aria-label", a11y.remove(text));
  }
  const unitWord = field.number?.prefix ?? field.number?.suffix;
  const name = unitWord ? `${field.name} (${unitWord.trim()})` : field.name;
  const range = isNumberField(field) && isRangeOperator(field, unit.operator);
  for (const input of span.querySelectorAll<HTMLElement>("[data-input]")) {
    const part = input.dataset.datePart as "year" | "month" | "day" | undefined;
    let label = name;
    if (part) {
      const group = input.closest<HTMLElement>("[data-group]")?.dataset.group;
      const side =
        unit.shape === "range" ? `${group === "1" ? labels.ending : labels.starting} ` : "";
      label = `${name}, ${side}${a11y[part]}`;
    } else if (range) {
      label = `${name}, ${input.dataset.input === "1" ? a11y.maximum : a11y.minimum}`;
    }
    input.setAttribute("role", "textbox");
    input.setAttribute("aria-label", label);
    if (input.dataset.placeholder)
      input.setAttribute("aria-placeholder", input.dataset.placeholder);
  }
};

const drawUnit = (
  span: HTMLSpanElement,
  unit: FilterUnit,
  field: FilterField,
  classes: ChipClasses,
  labels: UnitLabels,
) => {
  span.className = classes.unit;
  span.contentEditable = "false";
  span.dataset.unitId = unit.id;
  span.dataset.parity = "filter-unit";
  if (unit.values.length === 0) span.dataset.incomplete = "true";
  else delete span.dataset.incomplete;
  // "list" units open from the caret touching them; typed ones (numbers,
  // typed dates) never do.
  span.dataset.kind = field.readOnly
    ? "readonly"
    : isNumberField(field) || isTextField(field) || isTypedDate(field, unit)
      ? "typed"
      : "list";

  let param = span.querySelector<HTMLSpanElement>("[data-part='param']");
  if (!param) {
    param = document.createElement("span");
    param.dataset.part = "param";
    param.dataset.parity = "param-chip";
    param.className = `${classes.chip} ${classes.param}${field.readOnly ? ` ${classes.readOnlyParam}` : ""}`;
    span.prepend(param);
  }
  param.textContent = chipLabel(field, unit.operator);

  // A typed date: its parts and calendar, rebuilt when the shape changes.
  if (isTypedDate(field, unit)) {
    span.querySelector("[data-part='value']:not([data-shape])")?.remove();
    renderDateValue(span, unit, classes, labels);
    return;
  }
  // A text unit's value chip exists from creation, its value typed in it.
  if (isTextField(field)) {
    renderTextValue(span, unit, field, classes, labels);
    return;
  }
  // A number unit's value chip exists from creation, its numbers typed in it.
  if (isNumberField(field)) {
    renderNumberValue(span, unit, field, classes, labels);
    return;
  }

  let value = span.querySelector<HTMLSpanElement>("[data-part='value']");
  if (unit.values.length === 0) {
    value?.remove();
    return;
  }
  if (!value) {
    value = document.createElement("span");
    value.dataset.part = "value";
    value.dataset.parity = "value-chip";
    value.className = `${classes.chip} ${classes.value} ${classes.lastValue}${field.readOnly ? ` ${classes.readOnlyValue}` : ""}`;
    const text = document.createElement("span");
    text.dataset.part = "value-text";
    const remove = document.createElement("button");
    remove.type = "button";
    remove.tabIndex = -1;
    remove.dataset.part = "remove";
    remove.dataset.parity = "chip-remove";
    remove.className = classes.remove;
    remove.setAttribute("aria-label", labels.remove);
    // The admin's 8px cross.
    remove.innerHTML =
      '<svg viewBox="0 0 8 8" width="8" height="8" fill="currentColor" aria-hidden="true"><path d="M1.28.22a.75.75 0 0 0-1.06 1.06L2.94 4 .22 6.72a.75.75 0 1 0 1.06 1.06L4 5.06l2.72 2.72a.75.75 0 0 0 1.06-1.06L5.06 4l2.72-2.72A.75.75 0 0 0 6.72.22L4 2.94z"/></svg>';
    value.append(text, remove);
    span.append(value);
  }
  const text = value.querySelector<HTMLSpanElement>("[data-part='value-text']");
  const full = valueText(field, unit.values, labels.more);
  if (text) text.textContent = full;
  value.title = unit.values.length > 3 ? full : "";
};

export const unitSpans = (root: HTMLElement) => [...root.children].filter(isUnitSpan);

/** Text typed straight after a unit to filter its values: not search text. */
export interface TypedValue {
  unitId: string;
  node: Text;
  length: number;
}

/**
 * The free text: every top-level text node, spaces collapsed,
 * less any value filter typed after a unit.
 */
export const readText = (root: HTMLElement, typed?: TypedValue | null) =>
  [...root.childNodes]
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => {
      const text = node.textContent ?? "";
      return typed && node === typed.node ? text.slice(typed.length) : text;
    })
    .join(" ")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * The caret as a top-level text node and offset, or null when it is elsewhere
 * or a range is selected (so Backspace deletes the selection).
 */
export const caretInRoot = (root: HTMLElement): { node: Node; offset: number } | null => {
  const selection = document.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return null;
  const { startContainer, startOffset } = selection.getRangeAt(0);
  if (startContainer === root) return { node: root, offset: startOffset };
  if (startContainer.parentNode === root && startContainer.nodeType === Node.TEXT_NODE) {
    return { node: startContainer, offset: startOffset };
  }
  return null;
};

/** The text the field list filters by: the text node at the caret, trimmed. */
export const caretText = (root: HTMLElement) => {
  const caret = caretInRoot(root);
  if (!caret || caret.node === root) return "";
  return (caret.node.textContent ?? "").replace(/ /g, " ").trim();
};

/** The unit right before or after a top-level caret, if it touches one. */
export const unitBesideCaret = (root: HTMLElement, side: "left" | "right") => {
  const caret = caretInRoot(root);
  if (!caret) return null;
  let neighbour: Node | null;
  if (caret.node === root) {
    neighbour = root.childNodes[side === "left" ? caret.offset - 1 : caret.offset] ?? null;
  } else {
    const text = caret.node.textContent ?? "";
    const atEdge = side === "left" ? caret.offset === 0 : caret.offset === text.length;
    if (!atEdge) return null;
    neighbour = side === "left" ? caret.node.previousSibling : caret.node.nextSibling;
  }
  return neighbour instanceof HTMLSpanElement && neighbour.dataset.unitId ? neighbour : null;
};

/**
 * The unit the caret touches on its left (the admin's right-of-chip): right
 * after the span, or in the text node after it with no space before the
 * caret. That text is a filter for the unit's values.
 */
export const unitTouchingCaret = (
  root: HTMLElement,
): { span: HTMLSpanElement; node: Text | null; typed: string } | null => {
  const caret = caretInRoot(root);
  if (!caret) return null;
  // Only list units: a number unit is never entered by the caret touching it
  //.
  const listUnit = (node: Node | null | undefined): node is HTMLSpanElement =>
    isUnitSpan(node) && node.dataset.kind === "list";
  if (caret.node === root) {
    const left = root.childNodes[caret.offset - 1];
    return listUnit(left) ? { span: left, node: null, typed: "" } : null;
  }
  const left = caret.node.previousSibling;
  const typed = (caret.node.textContent ?? "").slice(0, caret.offset);
  if (!listUnit(left) || startsWithSpace(typed)) return null;
  return { span: left, node: caret.node as Text, typed };
};

/** Puts the caret at offset in a text node. */
export const placeCaretIn = (node: Node, offset: number) => {
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  const selection = document.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
};

/**
 * Steps out past a unit's right edge: over a space already there, or onto a
 * no-break space put in.
 */
export const caretAfterUnit = (span: HTMLSpanElement) => {
  const next = span.nextSibling;
  if (next?.nodeType === Node.TEXT_NODE && startsWithSpace(next.textContent ?? "")) {
    placeCaretIn(next, 1);
    return;
  }
  const space = document.createTextNode(NBSP);
  span.after(space);
  placeCaretIn(space, 1);
};

/** Steps out before a unit, into the space before it if there is one. */
export const caretBeforeUnit = (root: HTMLElement, span: HTMLSpanElement) => {
  const previous = span.previousSibling;
  if (previous?.nodeType === Node.TEXT_NODE)
    placeCaretIn(previous, previous.textContent?.length ?? 0);
  else placeCaret(root, { before: span });
};

/** Every unit gets a space after it, as the field is left (so focus at the end opens the field list). */
export const spaceUnits = (root: HTMLElement) => {
  for (const span of unitSpans(root)) {
    const next = span.nextSibling;
    if (next?.nodeType === Node.TEXT_NODE && startsWithSpace(next.textContent ?? "")) continue;
    span.after(document.createTextNode(NBSP));
  }
};

/** Puts the caret at a node boundary: just before or after an element, or at the end. */
export const placeCaret = (root: HTMLElement, where: { before?: Node; after?: Node } = {}) => {
  const range = document.createRange();
  if (where.before) range.setStartBefore(where.before);
  else if (where.after) range.setStartAfter(where.after);
  else range.selectNodeContents(root);
  range.collapse(!!(where.before || where.after));
  const selection = document.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
};

/**
 * Puts a unit at the caret in place of the text typed to find its field
 *: that text node goes, the unit goes where
 * it was with a space before it if it would touch text, and the caret sits
 * right after it, touching it, until the unit is left.
 */
export const insertUnitAtCaret = (root: HTMLElement, span: HTMLSpanElement) => {
  const caret = caretInRoot(root);
  let before: Node | null = null;
  if (caret && caret.node !== root) {
    const textNode = caret.node as Text;
    before = textNode.nextSibling;
    textNode.remove();
  } else if (caret) {
    before = root.childNodes[caret.offset] ?? null;
  }
  const gapBefore = before?.previousSibling ?? (before ? null : root.lastChild);
  if (gapBefore && gapBefore.nodeType !== Node.TEXT_NODE) {
    root.insertBefore(document.createTextNode(NBSP), before);
  } else if (gapBefore?.nodeType === Node.TEXT_NODE && !/\s$/.test(gapBefore.textContent ?? "")) {
    gapBefore.textContent = `${gapBefore.textContent}${NBSP}`;
  }
  root.insertBefore(span, before);
  placeCaret(root, { after: span });
};

/** Removes a unit and the space after it; returns the node the caret should sit before. */
export const removeUnit = (span: HTMLSpanElement) => {
  const next = span.nextSibling;
  if (next?.nodeType === Node.TEXT_NODE && next.textContent === NBSP) {
    const following = next.nextSibling;
    next.remove();
    span.remove();
    return following;
  }
  span.remove();
  return next;
};

/** Rebuilds the field from settled state: units first, each with a space after, then the text. */
export const rebuild = (root: HTMLElement, spans: HTMLSpanElement[], text: string) => {
  root.replaceChildren();
  for (const span of spans) root.append(span, document.createTextNode(NBSP));
  if (text) root.append(document.createTextNode(text));
};
