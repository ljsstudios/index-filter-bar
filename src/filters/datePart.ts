/**
 * The admin's date part inputs: YYYY, MM and DD typed apart, digits only, moving on
 * when a part is full, padded and clamped when it loses focus.
 */

export type DatePartName = "year" | "month" | "day";

export const PART_LENGTH: Record<DatePartName, number> = { year: 4, month: 2, day: 2 };
export const PART_PLACEHOLDER: Record<DatePartName, string> = {
  year: "YYYY",
  month: "MM",
  day: "DD",
};

const ALWAYS = new Set([
  "Backspace",
  "Delete",
  "Tab",
  "Escape",
  "Enter",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
]);

/**
 * Whether a key may change a part (42-44): digits while the part has room
 * once the selection is replaced; editing and moving keys and shortcuts
 * always; Up, Down, space, "-" and "/" never.
 */
export const allowDateKey = (
  key: string,
  { length, selected }: { length: number; selected: number },
  part: DatePartName,
  shortcut = false,
) => {
  if (shortcut || ALWAYS.has(key)) return true;
  if (!/^\d$/.test(key)) return false;
  return length - selected < PART_LENGTH[part];
};

/** Whether this digit fills the part, so the next part takes over (45). */
export const fillsPart = (
  { length, selected }: { length: number; selected: number },
  part: DatePartName,
) => length - selected === PART_LENGTH[part] - 1;

/** A part tidied on blur (46): digits only; year padded to 4, month 1-12, day 1-31, both 2. */
export const tidyDatePart = (text: string, part: DatePartName) => {
  const digits = text.replace(/\D/g, "");
  if (digits === "") return "";
  if (part === "year") return digits.slice(0, 4).padStart(4, "0");
  const max = part === "month" ? 12 : 31;
  const value = Math.min(Math.max(Number(digits.slice(0, 2)), 1), max);
  return String(value).padStart(2, "0");
};

/** "YYYY-MM-DD" when the parts make a real calendar date (47), else null. */
export const dateFromParts = (year: string, month: string, day: string) => {
  if (!year || !month || !day) return null;
  const y = tidyDatePart(year, "year");
  const m = tidyDatePart(month, "month");
  const d = tidyDatePart(day, "day");
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (
    date.getUTCFullYear() !== Number(y) ||
    date.getUTCMonth() !== Number(m) - 1 ||
    date.getUTCDate() !== Number(d)
  ) {
    return null;
  }
  return `${y}-${m}-${d}`;
};

/** What a paste puts in (48): digits only, cut to the room left in the part. */
export const filterDatePaste = (
  pasted: string,
  { length, selected }: { length: number; selected: number },
  part: DatePartName,
) => pasted.replace(/\D/g, "").slice(0, Math.max(PART_LENGTH[part] - (length - selected), 0));

/**
 * Gives a part span its rules. `onFull` runs on the next tick after a digit
 * fills the part, to move to the next one.
 */
export const attachDatePart = (
  input: HTMLElement,
  part: DatePartName,
  onFull: (input: HTMLElement) => void,
) => {
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
    const now = measure();
    if (!allowDateKey(event.key, now, part, event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      return;
    }
    if (/^\d$/.test(event.key) && fillsPart(now, part)) setTimeout(() => onFull(input), 0);
  });
  input.addEventListener("paste", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const text = filterDatePaste(event.clipboardData?.getData("text/plain") ?? "", measure(), part);
    if (text) document.execCommand("insertText", false, text);
  });
  input.addEventListener("blur", () => {
    const tidy = tidyDatePart(input.textContent ?? "", part);
    if (tidy !== input.textContent) input.textContent = tidy;
  });
};
