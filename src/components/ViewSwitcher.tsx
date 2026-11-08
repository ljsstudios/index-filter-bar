import { useRef, useState } from "react";
import { useOverlayEvents } from "../internal/useOverlayEvents";
import { defaultLabels, format, type IndexFilterBarLabels } from "../labels";
import { focusMenuItem, onMenuKeyDown } from "./menuKeys";
import styles from "./ViewSwitcher.module.css";

export type ViewAction = "rename" | "duplicate" | "delete";

interface ViewSwitcherProps {
  /** Unique per page: the popover's id. */
  popoverId: string;
  /** The views' titles, All first. */
  titles: string[];
  selected: number;
  onSelect: (index: number) => void;
  onAction: (index: number, action: ViewAction) => void;
  /** Read-only grace: views can be switched but not changed. */
  readOnly?: boolean;
  labels?: IndexFilterBarLabels["views"];
}

/**
 * The admin's views button and menu. The current view's "…" swaps the list for that
 * view's actions in the same popover, with a Back row on top: one popover,
 * where the admin opens a second.
 */
export const ViewSwitcher = ({
  popoverId,
  titles,
  selected,
  onSelect,
  onAction,
  readOnly = false,
  labels = defaultLabels.views,
}: ViewSwitcherProps) => {
  const [open, setOpen] = useState(false);
  const [actionsFor, setActionsFor] = useState<number | null>(null);
  const paneRef = useRef<HTMLDivElement>(null);
  // Opened, focus goes to the current view (the ARIA menu pattern).
  const popoverRef = useOverlayEvents({
    onShow: () => {
      setOpen(true);
      focusMenuItem(paneRef.current, '[aria-checked="true"]');
    },
    onHide: () => {
      setOpen(false);
      setActionsFor(null);
    },
  });
  const openActions = (index: number) => {
    setActionsFor(index);
    focusMenuItem(paneRef.current, '[data-action="rename"], [data-action="duplicate"]');
  };
  const closeActions = () => {
    setActionsFor(null);
    focusMenuItem(paneRef.current, '[data-parity="view-actions"]');
  };
  const label = (index: number) => (index === 0 ? labels.all : titles[index]);

  const actions: ViewAction[] =
    actionsFor === 0 ? ["duplicate"] : ["rename", "duplicate", "delete"];
  const actionIcon = { rename: "edit", duplicate: "duplicate", delete: "delete" } as const;

  return (
    <>
      <button
        type="button"
        className={styles.activator}
        data-active={open || undefined}
        data-parity="views-button"
        aria-label={labels.switch}
        aria-haspopup="menu"
        aria-expanded={open}
        {...{ commandfor: popoverId, command: "--toggle" }}
      >
        <span className={styles.labelWrapper}>{label(selected)}</span>
        <span className={styles.iconWrapper}>
          <s-icon type="select"></s-icon>
        </span>
      </button>
      <s-popover id={popoverId} ref={popoverRef}>
        <div className={styles.pane} data-parity="views-pane" ref={paneRef}>
          {actionsFor === null ? (
            <div
              role="menu"
              className={styles.viewList}
              data-has-view-actions={!readOnly}
              aria-label={labels.switch}
              onKeyDown={onMenuKeyDown}
            >
              {titles.map((title, index) => (
                <div key={title} className={styles.viewItem} role="none">
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={index === selected}
                    className={styles.viewItemButton}
                    data-parity={index === selected ? "view-row-current" : "view-row"}
                    onClick={() => onSelect(index)}
                    {...{ commandfor: popoverId, command: "--hide" }}
                  >
                    <span
                      className={styles.checkIcon}
                      data-hidden={index !== selected}
                      data-parity={index === selected ? "view-check" : undefined}
                    >
                      <s-icon type="check"></s-icon>
                    </span>
                    <span
                      className={styles.viewItemLabel}
                      data-current={index === selected}
                      data-parity={index === selected ? "view-label-current" : "view-label"}
                    >
                      {label(index)}
                    </span>
                  </button>
                  {index === selected && !readOnly && (
                    <span className={styles.overflowTrigger} role="none">
                      <button
                        type="button"
                        role="menuitem"
                        aria-haspopup="menu"
                        className={styles.overflowButton}
                        data-parity="view-actions"
                        aria-label={format(labels.actions, { name: label(index) })}
                        onClick={() => openActions(index)}
                        onKeyDown={(event) => {
                          if (event.key === "ArrowRight") {
                            event.preventDefault();
                            openActions(index);
                          }
                        }}
                      >
                        <s-icon type="menu-horizontal"></s-icon>
                      </button>
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div
              role="menu"
              aria-label={format(labels.actions, { name: label(actionsFor) })}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  closeActions();
                  return;
                }
                onMenuKeyDown(event);
              }}
            >
              <button
                type="button"
                role="menuitem"
                className={styles.actionRow}
                onClick={closeActions}
              >
                <s-icon type="chevron-left"></s-icon>
                <span className={styles.backLabel}>{label(actionsFor)}</span>
              </button>
              <div className={styles.divider} />
              {actions.map((action) => (
                <button
                  key={action}
                  type="button"
                  role="menuitem"
                  data-action={action}
                  className={styles.actionRow}
                  data-tone={action === "delete" ? "critical" : undefined}
                  onClick={() => onAction(actionsFor, action)}
                  {...{ commandfor: popoverId, command: "--hide" }}
                >
                  <s-icon
                    type={actionIcon[action]}
                    tone={action === "delete" ? "critical" : undefined}
                    color={action === "delete" ? undefined : "subdued"}
                  ></s-icon>
                  {labels[action]}
                </button>
              ))}
            </div>
          )}
        </div>
      </s-popover>
    </>
  );
};
