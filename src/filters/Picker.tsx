import { type ReactNode, useEffect } from "react";
import styles from "./Picker.module.css";

export interface PickerRow {
  id: string;
  label: string;
  /** A checkbox or tick before the label. */
  prefix?: ReactNode;
  selected?: boolean;
  /** Starts a new list after a divider (the value picker's conditions). */
  section?: string;
  /** A message row ("No results"): never highlighted or picked. */
  disabled?: boolean;
}

interface PickerProps {
  /** Unique: the listbox id, and the stem of each row's id. */
  id: string;
  /** The first list's name; later sections take theirs from `sectionLabels`. */
  label: string;
  sectionLabels?: Record<string, string>;
  /** The first list picks several values (checkboxes). */
  multiselectable?: boolean;
  rows: PickerRow[];
  /** The highlighted row, -1 for none. */
  activeIndex: number;
  /** The popover's top-left corner, relative to the search field's bar. */
  anchor: { left: number; top: number };
  enterLabel: string;
  onActiveChange: (index: number) => void;
  onPick: (row: PickerRow) => void;
}

export const pickerRowId = (pickerId: string, index: number) => `${pickerId}-row-${index}`;

/**
 * The bar's picker (the admin's ul.Picker in a Polaris popover): rows in one
 * or more listboxes split by dividers, one highlighted row shared by the
 * mouse and the keys with its Enter keycap. Focus stays in the search field:
 * rows swallow mousedown, the field owns the keys and
 * points at the highlighted row with aria-activedescendant.
 */
export const Picker = ({
  id,
  label,
  sectionLabels = {},
  multiselectable = false,
  rows,
  activeIndex,
  anchor,
  enterLabel,
  onActiveChange,
  onPick,
}: PickerProps) => {
  // A row reached by the keys scrolls into view.
  useEffect(() => {
    if (activeIndex < 0) return;
    document.getElementById(pickerRowId(id, activeIndex))?.scrollIntoView?.({ block: "nearest" });
  }, [id, activeIndex]);

  const sections: Array<{ key: string; rows: Array<{ row: PickerRow; index: number }> }> = [];
  rows.forEach((row, index) => {
    const key = row.section ?? "main";
    const last = sections[sections.length - 1];
    if (last && last.key === key) last.rows.push({ row, index });
    else sections.push({ key, rows: [{ row, index }] });
  });

  return (
    <div
      className={styles.popover}
      style={{ left: anchor.left, top: anchor.top }}
      data-parity="picker"
      onMouseDown={(event) => event.preventDefault()}
    >
      {sections.map((section, sectionIndex) => (
        <div key={section.key}>
          {sectionIndex > 0 && <div className={styles.divider} data-parity="picker-divider" />}
          <div className={sectionIndex === 0 ? styles.pane : undefined}>
            <div
              className={styles.list}
              role="listbox"
              id={sectionIndex === 0 ? id : `${id}-${section.key}`}
              aria-label={sectionIndex === 0 ? label : (sectionLabels[section.key] ?? label)}
              aria-multiselectable={(sectionIndex === 0 && multiselectable) || undefined}
            >
              {section.rows.map(({ row, index }) => (
                // biome-ignore lint/a11y/useFocusableInteractive: focus stays in the field, which points here with aria-activedescendant and owns the keys
                // biome-ignore lint/a11y/useKeyWithClickEvents: the field's keydown picks the highlighted row
                <div
                  key={row.id}
                  id={pickerRowId(id, index)}
                  className={styles.row}
                  role="option"
                  aria-selected={row.selected ?? false}
                  aria-disabled={row.disabled || undefined}
                  data-active={index === activeIndex || undefined}
                  data-parity={index === activeIndex ? "picker-row-active" : "picker-row"}
                  onMouseMove={() =>
                    !row.disabled && index !== activeIndex && onActiveChange(index)
                  }
                  onClick={() => !row.disabled && onPick(row)}
                >
                  <div className={styles.rowContent}>
                    {row.prefix}
                    <span className={styles.label} data-parity="picker-label">
                      {row.label}
                    </span>
                    <span className={styles.hint} aria-hidden="true" data-parity="picker-hint">
                      <span className={styles.hintIcon}>
                        <s-icon type="return" size="small" color="subdued"></s-icon>
                      </span>
                      {enterLabel}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
