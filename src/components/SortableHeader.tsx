import { defaultLabels, type IndexFilterBarLabels } from "../labels";
import styles from "./SortableHeader.module.css";

export const parseSortField = (
  sortSelected: string[],
): { field: string; direction: "asc" | "desc" } => {
  const [field = "title", direction = "asc"] = (sortSelected[0] ?? "title asc").split(" ");
  return { field, direction: direction as "asc" | "desc" };
};

type SortType = "text" | "numeric" | "date";

// The hover-tooltip copy for a sort direction, matching Shopify's admin: A-Z / Z-A
// for text, low/high for numbers, oldest/newest for dates.
const sortTipKey = (dir: "asc" | "desc", type: SortType): keyof IndexFilterBarLabels["sort"] => {
  if (type === "numeric") return dir === "asc" ? "lowToHigh" : "highToLow";
  if (type === "date") return dir === "asc" ? "oldestFirst" : "newestFirst";
  return dir === "asc" ? "aToZ" : "zToA";
};

interface SortableHeaderProps {
  field: string;
  label: string;
  sortSelected: string[];
  onSort: (value: string[]) => void;
  numeric?: boolean;
  // Column value kind — drives the sort tooltip copy (A-Z vs low/high vs oldest/
  // newest). Defaults from `numeric`; pass "date" for date columns.
  sortType?: SortType;
  // Optional hover hint shown after the label. Both must be set; tooltipId must
  // be unique on the page.
  tooltip?: string;
  tooltipId?: string;
  labels?: IndexFilterBarLabels["sort"];
}

export const SortableHeader = ({
  field,
  label,
  sortSelected,
  onSort,
  numeric,
  sortType,
  tooltip,
  tooltipId,
  labels = defaultLabels.sort,
}: SortableHeaderProps) => {
  const { field: activeField, direction } = parseSortField(sortSelected);
  const isActive = activeField === field;
  const nextDirection = isActive && direction === "asc" ? "desc" : "asc";
  // The active column shows its current direction; an unsorted column hints the
  // ascending sort its first click applies (its icon only shows on hover).
  const iconDir = isActive ? direction : "asc";
  const iconType = iconDir === "asc" ? "sort-ascending" : "sort-descending";
  const type: SortType = sortType ?? (numeric ? "numeric" : "text");
  const sortTipId = `sort-tip-${field}`;

  return (
    <>
      {/* biome-ignore lint/a11y/useSemanticElements: styled as inline table header, not a button */}
      <span
        className={numeric ? styles.sortableHeaderNumeric : styles.sortableHeader}
        onClick={() => onSort([`${field} ${nextDirection}`])}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSort([`${field} ${nextDirection}`]);
          }
        }}
      >
        <s-text>{label}</s-text>
        <span className={isActive ? styles.sortIconActive : styles.sortIcon}>
          <s-icon type={iconType} {...{ interestfor: sortTipId }}></s-icon>
        </span>
        {tooltip && tooltipId && (
          <s-icon type="info" size="small" {...{ interestfor: tooltipId }}></s-icon>
        )}
      </span>
      <s-tooltip id={sortTipId}>{labels[sortTipKey(iconDir, type)]}</s-tooltip>
      {tooltip && tooltipId && <s-tooltip id={tooltipId}>{tooltip}</s-tooltip>}
    </>
  );
};
