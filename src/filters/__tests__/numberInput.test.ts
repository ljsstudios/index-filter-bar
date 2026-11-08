import { describe, expect, it } from "vitest";
import { allowKey, filterPaste, numberPlaceholder, tidyNumber } from "../numberInput";

const WHOLE = { minPrecision: 0, maxPrecision: 0 };
const TWO = { minPrecision: 0, maxPrecision: 2 };
const at = (text: string, start = text.length, end = start) => ({ text, start, end });

describe("allowKey (number-filters 24-28)", () => {
  it("takes digits and editing keys, blocks letters and spaces", () => {
    expect(allowKey("5", at(""), WHOLE, ".")).toBe(true);
    expect(allowKey("Backspace", at("5"), WHOLE, ".")).toBe(true);
    expect(allowKey("a", at(""), WHOLE, ".")).toBe(false);
    expect(allowKey(" ", at(""), WHOLE, ".")).toBe(false);
    expect(allowKey("e", at(""), TWO, ".")).toBe(false);
  });

  it("takes one leading minus", () => {
    expect(allowKey("-", at(""), WHOLE, ".")).toBe(true);
    expect(allowKey("-", at("5", 1), WHOLE, ".")).toBe(false);
    expect(allowKey("-", at("-5", 0), WHOLE, ".")).toBe(false);
  });

  it("takes one separator only when decimals are allowed, and no more decimals than allowed", () => {
    expect(allowKey(".", at("5"), WHOLE, ".")).toBe(false);
    expect(allowKey(".", at("5"), TWO, ".")).toBe(true);
    expect(allowKey(".", at("5.1"), TWO, ".")).toBe(false);
    expect(allowKey("9", at("5.12"), TWO, ".")).toBe(false);
    expect(allowKey("9", at("5.12", 0), TWO, ".")).toBe(true);
    expect(allowKey("9", at("5.12", 2, 4), TWO, ".")).toBe(true);
  });

  it("lets shortcuts through", () => {
    expect(allowKey("a", at("5"), WHOLE, ".", true)).toBe(true);
  });
});

describe("filterPaste (number-filters 30)", () => {
  it("keeps digits, one separator and the precision", () => {
    expect(filterPaste("1,234 units", "", WHOLE, ".")).toBe("1234");
    expect(filterPaste("3.14159", "", TWO, ".")).toBe("3.14");
    expect(filterPaste("-5", "", WHOLE, ".")).toBe("-5");
    expect(filterPaste("-5", "-1", WHOLE, ".")).toBe("5");
    expect(filterPaste("abc", "", WHOLE, ".")).toBe("");
  });
});

describe("tidyNumber (number-filters 32-33)", () => {
  it("tidies on blur", () => {
    expect(tidyNumber("", TWO, ".")).toBe("");
    expect(tidyNumber("5.", TWO, ".")).toBe("5");
    expect(tidyNumber(".5", TWO, ".")).toBe("0.5");
    expect(tidyNumber("1.50", TWO, ".")).toBe("1.5");
    expect(tidyNumber("-", WHOLE, ".")).toBe("-0");
    expect(tidyNumber("007", WHOLE, ".")).toBe("7");
    expect(tidyNumber("5", { minPrecision: 2, maxPrecision: 2 }, ".")).toBe("5.00");
  });

  it("shows 0, or 0.0 with decimals, as the placeholder", () => {
    expect(numberPlaceholder(WHOLE, ".")).toBe("0");
    expect(numberPlaceholder(TWO, ".")).toBe("0.0");
  });
});
