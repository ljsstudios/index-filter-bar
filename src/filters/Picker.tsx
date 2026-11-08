import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Tooltip } from "../components/Tooltip";
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
  /** The loading row: a spinner while the next values arrive. */
  loading?: boolean;
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
  /** The scrolling list reached its end: show more values. */
  onEndReached?: () => void;
  /** The loading row's accessible name. */
  loadingLabel: string;
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
  onEndReached,
  loadingLabel,
}: PickerProps) => {
  // A row reached by the keys scrolls into view.
  useEffect(() => {
    if (activeIndex < 0) return;
    document.getElementById(pickerRowId(id, activeIndex))?.scrollIntoView?.({ block: "nearest" });
  }, [id, activeIndex]);

  // The admin's width: the widest label, 50px, and the Enter keycap, capped at
  // 300px, set as the lists' least width each time the rows change. So the
  // popover never grows when the keycap lands on the longest row.
  const popoverRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLSpanElement>(null);
  const [minWidth, setMinWidth] = useState<number | undefined>(undefined);
  // Every row keeps the keycap's room, so a label clips at the same point
  // whether or not its row is highlighted.
  const [hintWidth, setHintWidth] = useState(0);
  // Rows whose label is clipped: hovering one shows the whole label.
  const [clipped, setClipped] = useState<ReadonlySet<string>>(new Set());
  const [fontsReady, setFontsReady] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: rows and fontsReady are when to measure again
  useLayoutEffect(() => {
    const root = popoverRef.current;
    if (!root) return;
    const labels = [...root.querySelectorAll<HTMLElement>("[data-picker-label]")];
    for (const el of labels) {
      el.style.flex = "none";
      el.style.width = "max-content";
    }
    const widest = labels.reduce((max, el) => Math.max(max, el.getBoundingClientRect().width), 0);
    for (const el of labels) {
      el.style.flex = "";
      el.style.width = "";
    }
    const hint = hintRef.current?.getBoundingClientRect().width ?? 0;
    setHintWidth(hint);
    setMinWidth(labels.length > 0 ? Math.min(widest + 50 + hint, 300) : undefined);
  }, [rows, fontsReady]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: measured again once the widths settle
  useLayoutEffect(() => {
    const root = popoverRef.current;
    if (!root) return;
    const next = new Set(
      [...root.querySelectorAll<HTMLElement>("[data-picker-label]")]
        .filter((el) => el.scrollWidth > el.clientWidth)
        .map((el) => el.dataset.rowId ?? ""),
    );
    setClipped((prev) =>
      prev.size === next.size && [...next].every((rowId) => prev.has(rowId)) ? prev : next,
    );
  }, [rows, minWidth, hintWidth]);
  // A web font arriving late changes the widths: measure again.
  useEffect(() => {
    let live = true;
    document.fonts?.ready.then(() => live && setFontsReady((n) => n + 1));
    return () => {
      live = false;
    };
  }, []);

  const sections: Array<{ key: string; rows: Array<{ row: PickerRow; index: number }> }> = [];
  rows.forEach((row, index) => {
    const key = row.section ?? "main";
    const last = sections[sections.length - 1];
    if (last && last.key === key) last.rows.push({ row, index });
    else sections.push({ key, rows: [{ row, index }] });
  });

  return (
    <div
      ref={popoverRef}
      className={styles.popover}
      style={
        {
          left: anchor.left,
          top: anchor.top,
          "--picker-row-hint-width": `${hintWidth}px`,
        } as CSSProperties
      }
      data-parity="picker"
      onMouseDown={(event) => event.preventDefault()}
    >
      {/* The keycap, measured once for the width, never seen. */}
      <span ref={hintRef} className={`${styles.hint} ${styles.measure}`} aria-hidden="true">
        <span className={styles.hintIcon}>
          <s-icon type="return" size="small"></s-icon>
        </span>
        {enterLabel}
      </span>
      {sections.map((section, sectionIndex) => (
        <div key={section.key}>
          {sectionIndex > 0 && <div className={styles.divider} data-parity="picker-divider" />}
          <div
            className={sectionIndex === 0 ? styles.pane : undefined}
            // At the end of the scrolling list, more values (the admin's 1px).
            onScroll={
              sectionIndex === 0
                ? (event) => {
                    const pane = event.currentTarget;
                    if (pane.scrollHeight - pane.scrollTop - pane.clientHeight < 1)
                      onEndReached?.();
                  }
                : undefined
            }
          >
            <div
              className={styles.list}
              role="listbox"
              id={sectionIndex === 0 ? id : `${id}-${section.key}`}
              aria-label={sectionIndex === 0 ? label : (sectionLabels[section.key] ?? label)}
              aria-multiselectable={(sectionIndex === 0 && multiselectable) || undefined}
              // The measured width is the list's width, not just its least:
              // a highlighted row's keycap can never stretch it.
              style={minWidth === undefined ? undefined : { width: minWidth, minWidth }}
            >
              {section.rows.map(({ row, index }) =>
                row.loading ? (
                  // biome-ignore lint/a11y/useFocusableInteractive: a disabled option, read through the field's aria-activedescendant like the rest
                  <div
                    key={row.id}
                    id={pickerRowId(id, index)}
                    className={styles.loadingRow}
                    role="option"
                    aria-selected={false}
                    aria-disabled="true"
                    data-parity="picker-loading"
                  >
                    <div className={styles.loadingContent}>
                      <s-spinner accessibilityLabel={loadingLabel}></s-spinner>
                    </div>
                  </div>
                ) : (
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
                      {clipped.has(row.id) ? (
                        <Tooltip content={row.label} className={styles.labelWrap}>
                          <span
                            className={styles.label}
                            data-parity="picker-label"
                            data-picker-label
                            data-row-id={row.id}
                          >
                            {row.label}
                          </span>
                        </Tooltip>
                      ) : (
                        <span className={styles.labelWrap}>
                          <span
                            className={styles.label}
                            data-parity="picker-label"
                            data-picker-label
                            data-row-id={row.id}
                          >
                            {row.label}
                          </span>
                        </span>
                      )}
                      <span className={styles.hint} aria-hidden="true" data-parity="picker-hint">
                        <span className={styles.hintIcon}>
                          <s-icon type="return" size="small" color="subdued"></s-icon>
                        </span>
                        {enterLabel}
                      </span>
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
