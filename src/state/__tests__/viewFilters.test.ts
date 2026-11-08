import { describe, expect, it } from "vitest";
import { mergeViewFilters, mergeViewQuery, splitViewFilters, splitViewQuery } from "../viewFilters";

// A saved view's own search and filters hide from the bar until the eye shows
// them (docs/research/index-filter-bar/view-filters-live.md).

const status = { field: "status", operator: "is", values: ["active", "draft"] };
const vendor = { field: "vendor", operator: "is", values: ["Bridgeful"] };

describe("splitViewFilters", () => {
  it("hides the view's filters, values in any order", () => {
    const applied = [{ ...status, values: ["draft", "active"] }];
    expect(splitViewFilters(applied, [status], false)).toEqual({
      shown: [],
      hidden: applied,
      intact: true,
    });
  });

  it("shows a filter the merchant adds on its own, the view's still hidden", () => {
    const split = splitViewFilters([vendor, status], [status], false);
    expect(split).toEqual({ shown: [vendor], hidden: [status], intact: true });
    expect(mergeViewFilters(split.shown, split.hidden)).toEqual([vendor, status]);
  });

  it("shows everything once revealed", () => {
    expect(splitViewFilters([status, vendor], [status], true)).toEqual({
      shown: [status, vendor],
      hidden: [],
      intact: true,
    });
  });

  it("shows everything, with no eye, once a view filter is changed", () => {
    const edited = { ...status, values: ["active"] };
    expect(splitViewFilters([edited], [status], false)).toEqual({
      shown: [edited],
      hidden: [],
      intact: false,
    });
  });

  it("hides an added filter once the view is updated with it", () => {
    expect(splitViewFilters([vendor, status], [status, vendor], false).shown).toEqual([]);
  });

  it("tells shapes apart", () => {
    const date = { field: "date", operator: "is", values: ["2026-11-03"], shape: "date" };
    const preset = { field: "date", operator: "is", values: ["2026-11-03"] };
    expect(splitViewFilters([preset], [date], false).intact).toBe(false);
  });
});

describe("splitViewQuery", () => {
  it("hides the view's search after what the merchant types, and puts it back", () => {
    expect(splitViewQuery("snow", "snow", false)).toEqual({
      shown: "",
      hidden: "snow",
      intact: true,
    });
    const split = splitViewQuery("hydrogen snow", "snow", false);
    expect(split.shown).toBe("hydrogen");
    expect(mergeViewQuery(split.shown, split.hidden)).toBe("hydrogen snow");
  });

  it("keeps a space the merchant just typed", () => {
    const merged = mergeViewQuery("hydrogen ", "snow");
    expect(splitViewQuery(merged, "snow", false).shown).toBe("hydrogen ");
    expect(mergeViewQuery("", "snow")).toBe("snow");
  });

  it("shows it all when revealed or changed", () => {
    expect(splitViewQuery("snow", "snow", true)).toEqual({
      shown: "snow",
      hidden: "",
      intact: true,
    });
    expect(splitViewQuery("snowboard", "snow", false)).toEqual({
      shown: "snowboard",
      hidden: "",
      intact: false,
    });
  });
});
