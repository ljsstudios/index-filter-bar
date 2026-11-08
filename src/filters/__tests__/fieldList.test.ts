import { describe, expect, it } from "vitest";
import { fieldListRows } from "../fieldList";
import type { FilterField } from "../types";

const field = (key: string, name: string): FilterField => ({
  key,
  name,
  multi: true,
  values: [],
  operators: [
    { value: "is", label: "Is", chipLabel: `${name} is` },
    { value: "is_not", label: "Is not", chipLabel: `${name} is not` },
  ],
});

const FIELDS = [field("status", "Sync status"), field("store", "Store")];
const labels = (text: string, used: string[] = []) =>
  fieldListRows(FIELDS, new Set(used), text).map((row) => row.label);

describe("fieldListRows", () => {
  it("lists every field by name with nothing typed", () => {
    expect(labels("")).toEqual(["Sync status", "Store"]);
  });

  it("drops fields already in the bar", () => {
    expect(labels("", ["status"])).toEqual(["Store"]);
  });

  it("matches word starts in any order", () => {
    expect(labels("stat")).toEqual(["Sync status", "Sync status is not"]);
    expect(labels("sto")).toEqual(["Store", "Store is not"]);
  });

  it("finds the other condition by its chip label, names first", () => {
    const rows = fieldListRows(FIELDS, new Set(), "is not");
    expect(rows.map((row) => [row.label, row.operator])).toEqual([
      ["Sync status is not", "is_not"],
      ["Store is not", "is_not"],
    ]);
  });

  it("finds a field by its first condition's label (handler-diff 19)", () => {
    expect(labels("sync status is")).toEqual(["Sync status", "Sync status is not"]);
  });

  it("returns nothing when no word matches", () => {
    expect(labels("vendor")).toEqual([]);
  });
});
