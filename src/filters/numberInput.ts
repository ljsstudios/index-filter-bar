/**
 * The admin's number input rules: which keys and pasted text it takes, and how the
 * value is tidied when it loses focus.
 */

export interface NumberPrecision {
  minPrecision: number;
  maxPrecision: number;
}

export const DEFAULT_PRECISION: NumberPrecision = { minPrecision: 0, maxPrecision: 2 };

/** The browser's decimal separator, "." or ",". */
export const decimalSeparator = () => (1.1).toLocaleString().charAt(1) || ".";

const ALWAYS = new Set([
  "Backspace",
  "Delete",
  "Tab",
  "Escape",
  "Enter",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
]);

/**
 * Whether a key may change the input (24-28): digits up to the precision, one
 * leading "-", one separator when decimals are allowed; editing and moving
 * keys and shortcuts always.
 */
export const allowKey = (
  key: string,
  { text, start, end }: { text: string; start: number; end: number },
  { maxPrecision }: NumberPrecision,
  separator = decimalSeparator(),
  shortcut = false,
) => {
  if (shortcut || ALWAYS.has(key) || key.length > 1) return true;
  if (/^\d$/.test(key)) {
    const at = text.indexOf(separator);
    if (at < 0 || start <= at) return true;
    // After the separator: no more decimals than the precision, unless the
    // selection replaces some.
    return start !== end || text.length - at - 1 < maxPrecision;
  }
  if (key === "-") return !text.includes("-") && start === 0;
  if (key === separator) return maxPrecision > 0 && !text.includes(separator);
  return false;
};

/** What a paste puts in (30): digits and one separator, decimals cut to the precision. */
export const filterPaste = (
  pasted: string,
  current: string,
  { maxPrecision }: NumberPrecision,
  separator = decimalSeparator(),
) => {
  let digits = "";
  let seenSeparator = false;
  let decimals = 0;
  for (const ch of pasted) {
    if (/\d/.test(ch)) {
      if (seenSeparator) {
        if (decimals >= maxPrecision) continue;
        decimals += 1;
      }
      digits += ch;
    } else if (ch === separator && maxPrecision > 0 && !seenSeparator) {
      seenSeparator = true;
      digits += ch;
    }
  }
  if (pasted.trim().startsWith("-") && !current.includes("-") && digits) digits = `-${digits}`;
  return digits;
};

/**
 * The value tidied on blur (32-33): a leading "-" kept, stray characters out,
 * "0" before a bare separator, decimals cut and trailing zeros dropped, then
 * formatted with the precision. Empty stays empty.
 */
export const tidyNumber = (
  text: string,
  { minPrecision, maxPrecision }: NumberPrecision,
  separator = decimalSeparator(),
) => {
  if (text === "") return "";
  const negative = text.trimStart().startsWith("-");
  const kept = text.replace(new RegExp(`[^\\d${separator === "." ? "\\." : separator}]`, "g"), "");
  const [whole = "", ...rest] = kept.split(separator);
  const decimals = rest.join("").slice(0, maxPrecision).replace(/0+$/, "");
  const value = Number(`${negative ? "-" : ""}${whole || "0"}.${decimals || "0"}`);
  return value.toLocaleString(undefined, {
    minimumFractionDigits: minPrecision,
    maximumFractionDigits: maxPrecision,
    useGrouping: false,
  });
};

/**
 * The placeholder (35): "0", or "0.0" when decimals are allowed; "0.00" for
 * a single currency amount (a currency range keeps "0.0", as the admin's does).
 */
export const numberPlaceholder = (
  { maxPrecision }: NumberPrecision,
  separator = decimalSeparator(),
  singleCurrency = false,
) => (maxPrecision <= 0 ? "0" : singleCurrency ? `0${separator}00` : `0${separator}0`);

/**
 * Gives an input span its rules: keys and paste filtered, the whole text
 * selected when focus comes from the keyboard (a click keeps its caret), and
 * the value tidied on blur.
 */
export const attachNumberInput = (input: HTMLElement, precision: NumberPrecision) => {
  let pressed = false;
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
    const selection = document.getSelection();
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    const text = input.textContent ?? "";
    const start = range ? offsetIn(input, range.startContainer, range.startOffset) : text.length;
    const end = range ? offsetIn(input, range.endContainer, range.endOffset) : text.length;
    const shortcut = event.metaKey || event.ctrlKey;
    if (!allowKey(event.key, { text, start, end }, precision, decimalSeparator(), shortcut)) {
      event.preventDefault();
    }
  });
  input.addEventListener("paste", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const text = filterPaste(
      event.clipboardData?.getData("text/plain") ?? "",
      input.textContent ?? "",
      precision,
    );
    if (text) document.execCommand("insertText", false, text);
  });
  input.addEventListener("blur", () => {
    const tidy = tidyNumber(input.textContent ?? "", precision);
    if (tidy !== input.textContent) input.textContent = tidy;
  });
};

// The character offset of a boundary inside the input.
const offsetIn = (input: HTMLElement, node: Node, offset: number) => {
  if (node === input) {
    let count = 0;
    for (let i = 0; i < offset; i += 1) count += input.childNodes[i]?.textContent?.length ?? 0;
    return count;
  }
  const range = document.createRange();
  range.setStart(input, 0);
  range.setEnd(node, offset);
  return range.toString().length;
};
