import type { ReactNode } from "react";
import styles from "./IndexBar.module.css";

interface IndexBarProps {
  /** The views button, at the start. */
  views?: ReactNode;
  /** The search field: takes the room between the views and the actions. */
  children?: ReactNode;
  /** The columns button and the Reset / Save slide-in, at the end. */
  actions?: ReactNode;
}

/**
 * The card an index page's search and filter bar sits in, and the bar's row,
 * matched to the admin's.
 *
 * Not an `s-section`: inside an app Polaris gives sections the 20px app
 * container radius, and the admin's bar card is 12px. Not sticky either:
 * the admin's bar scrolls away with the page.
 */
export const IndexBar = ({ views, children, actions }: IndexBarProps) => (
  <div className={styles.card} data-parity="bar-section">
    <div className={styles.row} data-parity="bar-row">
      <div className={styles.main}>
        {views}
        <div className={styles.search}>{children}</div>
      </div>
      {actions}
    </div>
  </div>
);

/**
 * The same 12px card for what stands beside the bar on an index page, such as
 * the empty states: an `s-section` would be 20px inside an app.
 */
export const IndexCard = ({ children }: { children?: ReactNode }) => (
  <div className={styles.card}>{children}</div>
);
