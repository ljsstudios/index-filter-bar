import { useEffect, useRef, useState } from "react";
import { useOverlayEvents } from "../internal/useOverlayEvents";
import { defaultLabels, type IndexFilterBarLabels } from "../labels";
import { focusMenuItem, onMenuKeyDown } from "./menuKeys";
import styles from "./SaveControls.module.css";
import { Tooltip } from "./Tooltip";

interface SaveControlsProps {
  /** Unique per page: the ids of the Save menu and the Reset tooltip. */
  idPrefix: string;
  /** The page differs from its selected view: the controls slide in. */
  dirty: boolean;
  /** All is selected: Save makes a new view, with no menu. */
  onAll: boolean;
  onReset: () => void;
  /** Save as new view (the name modal). */
  onSaveAsNew: () => void;
  /** Update view: the selected view takes the page as it is. */
  onUpdate: () => void;
  /** Views can't be saved: Save stays disabled. */
  readOnly?: boolean;
  labels?: IndexFilterBarLabels["views"];
}

const MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * The admin's Reset view and Save, sliding in at the bar's end while the page
 * differs from its view.
 * On All, Save is plain and opens Save as new view. On a saved view it opens
 * a menu: Update view (⌘S) and Save as new view (⌘⇧S), the shortcuts live
 * while the controls show.
 */
export const SaveControls = ({
  idPrefix,
  dirty,
  onAll,
  onReset,
  onSaveAsNew,
  onUpdate,
  readOnly = false,
  labels = defaultLabels.views,
}: SaveControlsProps) => {
  const menuId = `${idPrefix}-save-menu`;
  const [menuOpen, setMenuOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  // Opened, focus goes to Update view (the ARIA menu pattern).
  const menuRef = useOverlayEvents({
    onShow: () => {
      setMenuOpen(true);
      focusMenuItem(listRef.current);
    },
    onHide: () => setMenuOpen(false),
  });
  const canSave = dirty && !readOnly;

  // ⌘S updates the view (Save as new on All); ⌘⇧S always saves as new.
  const handlers = useRef({ onSaveAsNew, onUpdate, onAll });
  handlers.current = { onSaveAsNew, onUpdate, onAll };
  useEffect(() => {
    if (!canSave) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(MAC ? event.metaKey : event.ctrlKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      const { onSaveAsNew: saveAsNew, onUpdate: update, onAll: all } = handlers.current;
      if (event.shiftKey || all) saveAsNew();
      else update();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canSave]);

  const mod = MAC ? "⌘" : "Ctrl";

  return (
    <div className={styles.slideIn} data-open={dirty} inert={!dirty || undefined}>
      <Tooltip content={labels.resetView}>
        <button
          type="button"
          className={`${styles.button} ${styles.iconOnly}`}
          data-parity="reset-view"
          aria-label={labels.resetView}
          tabIndex={dirty ? undefined : -1}
          onClick={onReset}
        >
          <s-icon type="reset" color="subdued"></s-icon>
        </button>
      </Tooltip>
      <button
        type="button"
        className={`${styles.button} ${styles.disclosure}`}
        data-parity="save-view"
        data-active={menuOpen || undefined}
        aria-haspopup={onAll ? undefined : "menu"}
        aria-expanded={onAll ? undefined : menuOpen}
        tabIndex={dirty ? undefined : -1}
        disabled={!canSave || undefined}
        onClick={onAll ? onSaveAsNew : undefined}
        {...(onAll ? {} : { commandfor: menuId, command: "--toggle" })}
      >
        {labels.save}
        <span className={styles.disclosureIcon} data-collapsed={onAll}>
          <s-icon type="select"></s-icon>
        </span>
      </button>
      {!onAll && (
        <s-popover id={menuId} ref={menuRef}>
          <div
            ref={listRef}
            className={styles.menu}
            role="menu"
            aria-label={labels.save}
            data-parity="save-menu"
            onKeyDown={onMenuKeyDown}
          >
            <button
              type="button"
              role="menuitem"
              className={styles.menuRow}
              onClick={onUpdate}
              {...{ commandfor: menuId, command: "--hide" }}
            >
              <span className={styles.menuIcon}>
                <s-icon type="refresh" color="subdued"></s-icon>
              </span>
              <span className={styles.menuLabel}>{labels.updateView}</span>
              <span className={styles.keys} aria-hidden="true">
                <kbd className={styles.key} data-parity="keycap">
                  {mod}
                </kbd>
                <kbd className={styles.key}>S</kbd>
              </span>
            </button>
            <button
              type="button"
              role="menuitem"
              className={styles.menuRow}
              onClick={onSaveAsNew}
              {...{ commandfor: menuId, command: "--hide" }}
            >
              <span className={styles.menuIcon}>
                <s-icon type="plus-circle" color="subdued"></s-icon>
              </span>
              <span className={styles.menuLabel}>{labels.saveAsNew}</span>
              <span className={styles.keys} aria-hidden="true">
                <kbd className={styles.key}>{mod}</kbd>
                <kbd className={styles.key}>⇧</kbd>
                <kbd className={styles.key}>S</kbd>
              </span>
            </button>
          </div>
        </s-popover>
      )}
    </div>
  );
};
