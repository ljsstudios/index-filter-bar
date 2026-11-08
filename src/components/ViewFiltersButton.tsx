import { Tooltip } from "./Tooltip";
import styles from "./ViewFiltersButton.module.css";

interface ViewFiltersButtonProps {
  /** The view's filters are in the bar. */
  revealed: boolean;
  onToggle: () => void;
  labels: { show: string; hide: string };
}

/**
 * The eye after the columns button on a saved view: shows or hides the view's
 * own search and filters.
 * Only the icon and its words change; the button is never drawn pressed.
 */
export const ViewFiltersButton = ({ revealed, onToggle, labels }: ViewFiltersButtonProps) => {
  const label = revealed ? labels.hide : labels.show;
  return (
    <Tooltip content={label}>
      <button
        type="button"
        className={styles.button}
        data-parity="view-filters"
        aria-label={label}
        onClick={onToggle}
      >
        <s-icon type={revealed ? "hide" : "view"} color="subdued"></s-icon>
      </button>
    </Tooltip>
  );
};
