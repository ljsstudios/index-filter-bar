import { describe, expect, it } from "vitest";
import { allowDateKey, dateFromParts, fillsPart, filterDatePaste, tidyDatePart } from "../datePart";

describe("allowDateKey (date-filters 42-44)", () => {
  it("takes digits while the part has room, blocks the rest", () => {
    expect(allowDateKey("2", { length: 0, selected: 0 }, "year")).toBe(true);
    expect(allowDateKey("2", { length: 4, selected: 0 }, "year")).toBe(false);
    expect(allowDateKey("2", { length: 4, selected: 4 }, "year")).toBe(true);
    expect(allowDateKey("1", { length: 2, selected: 0 }, "month")).toBe(false);
    for (const key of ["-", "/", " ", "a", "ArrowUp", "ArrowDown"]) {
      expect(allowDateKey(key, { length: 0, selected: 0 }, "day")).toBe(false);
    }
    expect(allowDateKey("Backspace", { length: 2, selected: 0 }, "day")).toBe(true);
    expect(allowDateKey("v", { length: 0, selected: 0 }, "day", true)).toBe(true);
  });

  it("moves on when a digit fills the part (45)", () => {
    expect(fillsPart({ length: 3, selected: 0 }, "year")).toBe(true);
    expect(fillsPart({ length: 2, selected: 0 }, "year")).toBe(false);
    expect(fillsPart({ length: 1, selected: 0 }, "month")).toBe(true);
  });
});

describe("tidyDatePart (46)", () => {
  it("pads and clamps", () => {
    expect(tidyDatePart("", "year")).toBe("");
    expect(tidyDatePart("26", "year")).toBe("0026");
    expect(tidyDatePart("0", "month")).toBe("01");
    expect(tidyDatePart("7", "month")).toBe("07");
    expect(tidyDatePart("13", "month")).toBe("12");
    expect(tidyDatePart("45", "day")).toBe("31");
  });
});

describe("dateFromParts (47)", () => {
  it("only takes real calendar dates", () => {
    expect(dateFromParts("2026", "11", "03")).toBe("2026-11-03");
    expect(dateFromParts("2026", "2", "31")).toBeNull();
    expect(dateFromParts("2028", "02", "29")).toBe("2028-02-29");
    expect(dateFromParts("2026", "", "03")).toBeNull();
  });
});

describe("filterDatePaste (48)", () => {
  it("keeps digits, cut to the room left", () => {
    expect(filterDatePaste("2026-11-03", { length: 0, selected: 0 }, "year")).toBe("2026");
    expect(filterDatePaste("12", { length: 1, selected: 0 }, "month")).toBe("1");
  });
});
