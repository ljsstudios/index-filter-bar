import type { FilterField, FilterUnit } from "./types";

/**
 * A text unit's value chip: one editable span holding a typed value, e.g. the
 * admin's Orders "Credit card (last 4 digits)". Like numbers, the span is
 * an editing host inside the field and its text is the truth while it has
 * focus.
 */

export interface TextChipClasses {
  chip: string;
  value: string;
  lastValue: string;
  remove: string;
  textChip: string;
  textInput: string;
}

export const isTextField = (field: FilterField | undefined) => field?.kind === "text";

/** The unit's value: [trimmed text], or [] while there is none (30, 32). */
export const readTextValues = (span: HTMLElement) => {
  const text = (span.querySelector("[data-input]")?.textContent ?? "").trim();
  return text ? [text] : [];
};

/** Plain text on one line, cut to the room left when the field has a length (27). */
export const filterTextPaste = (
  pasted: string,
  { length, selected }: { length: number; selected: number },
  maxLength?: number,
) => {
  const text = pasted.replace(/\s*[\r\n]+\s*/g, " ");
  return maxLength === undefined
    ? text
    : text.slice(0, Math.max(maxLength - (length - selected), 0));
};

/** Whether a key may type into the input: printable keys only while it has room (23). */
export const allowTextKey = (
  key: string,
  { length, selected }: { length: number; selected: number },
  maxLength?: number,
  shortcut = false,
) => shortcut || key.length !== 1 || maxLength === undefined || length - selected < maxLength;

/**
 * Gives the span its rules: the length kept, paste plain text cut to fit,
 * the whole text selected when focus comes from the keyboard (a click keeps
 * its caret), and markup flattened on blur (22-29).
 */
export const attachTextInput = (input: HTMLElement, maxLength?: number) => {
  let pressed = false;
  const measure = () => {
    const selection = document.getSelection();
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    const selected = range && input.contains(range.startContainer) ? range.toString().length : 0;
    return { length: (input.textContent ?? "").length, selected };
  };
  input.addEventListener("mousedown", () => {
    pressed = true;
  });
  input.addEventListener("focus", () => {
    if (!pressed) {
      const range = document.createRange();
      range.selectNodeContents(input);
      document.getSelection()?.removeAllRanges();
      document.getSelection()?.addRange(range);
    }
    pressed = false;
  });
  input.addEventListener("keydown", (event) => {
    if (event.isComposing) return;
    if (!allowTextKey(event.key, measure(), maxLength, event.metaKey || event.ctrlKey)) {
      event.preventDefault();
    }
  });
  input.addEventListener("paste", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const text = filterTextPaste(
      event.clipboardData?.getData("text/plain") ?? "",
      measure(),
      maxLength,
    );
    if (text) document.execCommand("insertText", false, text);
  });
  input.addEventListener("blur", () => {
    const flat = input.textContent ?? "";
    if (input.innerHTML !== flat) input.textContent = flat;
  });
};

/** Builds the chip once; afterwards sets the text only when it differs. */
export const renderTextValue = (
  span: HTMLSpanElement,
  unit: FilterUnit,
  field: FilterField,
  classes: TextChipClasses,
  labels: { remove: string },
) => {
  let chip = span.querySelector<HTMLSpanElement>("[data-part='value']");
  if (!chip) {
    chip = document.createElement("span");
    chip.dataset.part = "value";
    chip.dataset.parity = "value-chip";
    chip.className = [classes.chip, classes.value, classes.lastValue, classes.textChip].join(" ");
    const input = document.createElement("span");
    input.className = classes.textInput;
    input.contentEditable = "true";
    input.spellcheck = false;
    input.dataset.input = "0";
    input.dataset.parity = "text-input";
    if (field.text?.placeholder) input.dataset.placeholder = field.text.placeholder;
    if (field.text?.maxLength !== undefined) input.dataset.maxLength = String(field.text.maxLength);
    attachTextInput(input, field.text?.maxLength);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.tabIndex = -1;
    remove.dataset.part = "remove";
    remove.dataset.parity = "chip-remove";
    remove.className = classes.remove;
    remove.setAttribute("aria-label", labels.remove);
    remove.innerHTML =
      '<svg viewBox="0 0 8 8" width="8" height="8" fill="currentColor" aria-hidden="true"><path d="M1.28.22a.75.75 0 0 0-1.06 1.06L2.94 4 .22 6.72a.75.75 0 1 0 1.06 1.06L4 5.06l2.72 2.72a.75.75 0 0 0 1.06-1.06L5.06 4l2.72-2.72A.75.75 0 0 0 6.72.22L4 2.94z"/></svg>';
    chip.append(input, remove);
    span.append(chip);
  }
  const input = chip.querySelector<HTMLElement>("[data-input]");
  const text = unit.values[0] ?? "";
  if (input && (input.textContent ?? "").trim() !== text) input.textContent = text;
};
