import type { FilterField } from "./types";

/** A row of the field list: a field, or one of its other conditions. */
export interface FieldListRow {
  id: string;
  field: string;
  operator: string;
  label: string;
}

const words = (text: string) => text.toLowerCase().split(/\s+/).filter(Boolean);

// Every typed word is the start of some word in the label.
const matches = (typed: string[], label: string) => {
  const own = words(label);
  return typed.every((word) => own.some((candidate) => candidate.startsWith(word)));
};

/**
 * The field list for the text at the caret: every unused
 * field by name with nothing typed; with text, the fields whose name matches
 * (score 2) or first condition's chip label ("Sync status is", score 1),
 * and each other condition whose chip label matches ("Sync status is not",
 * score 1), highest first and stable within a score.
 */
export const fieldListRows = (
  fields: readonly FilterField[],
  usedFields: ReadonlySet<string>,
  text: string,
): FieldListRow[] => {
  const typed = words(text);
  // Read-only fields are only ever put in by the page.
  const available = fields.filter((field) => !usedFields.has(field.key) && !field.readOnly);
  if (typed.length === 0) {
    return available.map((field) => ({
      id: field.key,
      field: field.key,
      operator: field.operators[0]?.value ?? "is",
      label: field.name,
    }));
  }
  const scored: Array<FieldListRow & { score: number }> = [];
  for (const field of available) {
    const [first, ...others] = field.operators;
    // The field by its name (2), else by its first condition's label, "Sync status is" (1).
    const score = !first
      ? 0
      : matches(typed, field.name)
        ? 2
        : matches(typed, first.chipLabel)
          ? 1
          : 0;
    if (first && score > 0) {
      scored.push({
        id: field.key,
        field: field.key,
        operator: first.value,
        label: field.name,
        score,
      });
    }
    for (const operator of others) {
      if (matches(typed, operator.chipLabel)) {
        scored.push({
          id: `${field.key}:${operator.value}`,
          field: field.key,
          operator: operator.value,
          label: operator.chipLabel,
          score: 1,
        });
      }
    }
  }
  return scored
    .map((row, index) => ({ row, index }))
    .sort((a, b) => b.row.score - a.row.score || a.index - b.index)
    .map(({ row: { score: _score, ...row } }) => row);
};
