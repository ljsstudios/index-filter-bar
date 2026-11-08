import { useRef, useState } from "react";
import { useOverlayEvents } from "../internal/useOverlayEvents";
import { defaultLabels, type IndexFilterBarLabels } from "../labels";
import styles from "./ColumnsPopover.module.css";
import { focusMenuItem, onMenuKeyDown } from "./menuKeys";

export interface SortOption {
  field: string;
  label: string;
  /** The direction labels for this field, e.g. A-Z / Z-A. */
  ascLabel: string;
  descLabel: string;
}

interface SortMenuProps {
  sortOptions: SortOption[];
  /** "field direction", e.g. "title asc". */
  sort: string;
  onSortChange: (sort: string) => void;
}

/**
 * The admin's sort list: the fields, ticked, a divider, then the current
 * field's two directions in its own words ("Oldest first", "Newest first").
 * Up and Down move through both groups.
 */
export const SortMenu = ({ sortOptions, sort, onSortChange }: SortMenuProps) => {
  const [field = "", direction = "asc"] = sort.split(" ");
  const current = sortOptions.find((option) => option.field === field) ?? sortOptions[0];
  return (
    <div onKeyDown={onMenuKeyDown}>
      <div className={styles.panelSection} role="menu">
        {sortOptions.map((option) => (
          <button
            key={option.field}
            type="button"
            role="menuitemradio"
            aria-checked={option.field === current?.field}
            className={styles.option}
            data-parity={option.field === current?.field ? "sort-option-current" : "sort-option"}
            onClick={() => onSortChange(`${option.field} ${direction}`)}
          >
            <span className={styles.tick} data-hidden={option.field !== current?.field}>
              <s-icon type="check"></s-icon>
            </span>
            {option.label}
          </button>
        ))}
      </div>
      <div className={styles.divider} />
      <div className={styles.panelSection} role="menu">
        {(["asc", "desc"] as const).map((dir) => (
          <button
            key={dir}
            type="button"
            role="menuitemradio"
            aria-checked={dir === direction}
            className={styles.option}
            onClick={() => onSortChange(`${current?.field ?? field} ${dir}`)}
          >
            <span className={styles.tick} data-hidden={dir !== direction}>
              <s-icon type="check"></s-icon>
            </span>
            {dir === "asc" ? current?.ascLabel : current?.descLabel}
          </button>
        ))}
      </div>
    </div>
  );
};

interface SortPopoverProps extends SortMenuProps {
  popoverId: string;
  labels?: IndexFilterBarLabels["columns"];
}

/**
 * The admin's sort button for a page without column choices (Customers →
 * Segments): the 28px sort icon, opening the sort list on its own, as wide
 * as its words.
 */
export const SortPopover = ({
  popoverId,
  sortOptions,
  sort,
  onSortChange,
  labels = defaultLabels.columns,
}: SortPopoverProps) => {
  const [open, setOpen] = useState(false);
  const paneRef = useRef<HTMLDivElement>(null);
  const popoverRef = useOverlayEvents({
    onShow: () => {
      setOpen(true);
      focusMenuItem(paneRef.current, '[aria-checked="true"]');
    },
    onHide: () => setOpen(false),
  });
  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        data-parity="sort-trigger"
        data-active={open || undefined}
        aria-label={labels.sortBy}
        aria-haspopup="menu"
        aria-expanded={open}
        {...{ commandfor: popoverId, command: "--toggle" }}
      >
        <s-icon type="sort" color="subdued"></s-icon>
      </button>
      <s-popover id={popoverId} ref={popoverRef}>
        <div ref={paneRef} className={styles.sortPane} data-parity="sort-pane">
          <SortMenu sortOptions={sortOptions} sort={sort} onSortChange={onSortChange} />
        </div>
      </s-popover>
    </>
  );
};
