import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type KeyboardEvent as ReactKeyboardEvent, useRef, useState } from "react";
import { useOverlayEvents } from "../internal/useOverlayEvents";
import { defaultLabels, format, type IndexFilterBarLabels } from "../labels";
import styles from "./ColumnsPopover.module.css";

export interface ColumnsPopoverColumn {
  key: string;
  label: string;
  visible: boolean;
}

export interface SortOption {
  field: string;
  label: string;
  /** The direction labels for this field, e.g. A-Z / Z-A. */
  ascLabel: string;
  descLabel: string;
}

interface ColumnsPopoverProps {
  popoverId: string;
  sortOptions: SortOption[];
  /** "field direction", e.g. "title asc". */
  sort: string;
  onSortChange: (sort: string) => void;
  columns: ColumnsPopoverColumn[];
  onReorder: (orderedKeys: string[]) => void;
  onToggle: (key: string) => void;
  labels?: IndexFilterBarLabels["columns"];
}

const SortableRow = ({
  column,
  onToggle,
  showLabel,
  hideLabel,
  reorderLabel,
}: {
  column: ColumnsPopoverColumn;
  onToggle: (key: string) => void;
  showLabel: string;
  hideLabel: string;
  reorderLabel: string;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.key });
  return (
    <div
      ref={setNodeRef}
      className={styles.row}
      data-hidden={!column.visible || undefined}
      data-dragging={isDragging || undefined}
      data-parity={column.visible ? "column-row" : "column-row-hidden"}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      // The whole row drags with the pointer; the keys drag from the handle,
      // a button of its own beside the eye.
      {...listeners}
    >
      <span className={styles.labelGroup}>
        <button
          type="button"
          ref={setActivatorNodeRef}
          className={styles.handle}
          data-parity="column-handle"
          {...attributes}
          aria-label={reorderLabel}
        >
          <s-icon type="drag-handle"></s-icon>
        </button>
        <span className={styles.rowLabel}>{column.label}</span>
      </span>
      <button
        type="button"
        className={styles.visibility}
        data-parity="column-visibility"
        aria-label={
          column.visible ? `${hideLabel} ${column.label}` : `${showLabel} ${column.label}`
        }
        // The row drags; the eye only toggles.
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        onClick={() => onToggle(column.key)}
      >
        <s-icon
          type={column.visible ? "view" : "hide"}
          color={column.visible ? undefined : "subdued"}
        ></s-icon>
      </button>
    </div>
  );
};

/**
 * The admin's display options: the 28px columns button opening Sort by and
 * the column list, each row dragged to reorder and its eye to show or hide.
 * Sort by swaps the popover for a sort panel with a Back row, where the admin
 * opens a second popover.
 */
export const ColumnsPopover = ({
  popoverId,
  sortOptions,
  sort,
  onSortChange,
  columns,
  onReorder,
  onToggle,
  labels = defaultLabels.columns,
}: ColumnsPopoverProps) => {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<"main" | "sort">("main");
  const popoverRef = useOverlayEvents({
    onShow: () => setOpen(true),
    onHide: () => {
      setOpen(false);
      setPanel("main");
    },
  });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const [field = "", direction = "asc"] = sort.split(" ");
  const current = sortOptions.find((option) => option.field === field) ?? sortOptions[0];

  // What a screen reader hears while a column is moved by the keys, in the
  // merchant's language.
  const labelOf = (id: UniqueIdentifier) =>
    columns.find((column) => column.key === String(id))?.label ?? String(id);
  const positionOf = (id: UniqueIdentifier) =>
    columns.findIndex((column) => column.key === String(id)) + 1;
  // dnd-kit reports the starting place as a move; only a new place is said.
  const lastOverRef = useRef<UniqueIdentifier | null>(null);
  // While a column is held, Escape cancels the move, not the popover:
  // it is handed to dnd-kit's document listener before the popover sees it.
  const draggingRef = useRef(false);
  const onPaneKeyDownCapture = (event: ReactKeyboardEvent) => {
    if (!draggingRef.current || event.key !== "Escape") return;
    event.stopPropagation();
    event.preventDefault();
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true }),
    );
  };
  const dragText = {
    screenReaderInstructions: { draggable: labels.dragInstructions },
    announcements: {
      onDragStart: ({ active }: { active: { id: UniqueIdentifier } }) => {
        lastOverRef.current = active.id;
        draggingRef.current = true;
        return format(labels.pickedUp, { column: labelOf(active.id) });
      },
      onDragOver: ({
        active,
        over,
      }: {
        active: { id: UniqueIdentifier };
        over: { id: UniqueIdentifier } | null;
      }) => {
        if (!over || over.id === lastOverRef.current) return undefined;
        lastOverRef.current = over.id;
        return format(labels.movedTo, {
          column: labelOf(active.id),
          position: positionOf(over.id),
          total: columns.length,
        });
      },
      onDragEnd: ({
        active,
        over,
      }: {
        active: { id: UniqueIdentifier };
        over: { id: UniqueIdentifier } | null;
      }) => {
        draggingRef.current = false;
        return over
          ? format(labels.dropped, {
              column: labelOf(active.id),
              position: positionOf(over.id),
              total: columns.length,
            })
          : format(labels.cancelled, { column: labelOf(active.id) });
      },
      onDragCancel: ({ active }: { active: { id: UniqueIdentifier } }) => {
        draggingRef.current = false;
        return format(labels.cancelled, { column: labelOf(active.id) });
      },
    },
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const keys = columns.map((column) => column.key);
    onReorder(arrayMove(keys, keys.indexOf(String(active.id)), keys.indexOf(String(over.id))));
  };

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        data-parity="columns-button"
        data-active={open || undefined}
        aria-label={labels.displayOptions}
        aria-haspopup="dialog"
        aria-expanded={open}
        {...{ commandfor: popoverId, command: "--toggle" }}
      >
        <s-icon type="layout-columns-3" color="subdued"></s-icon>
      </button>
      <s-popover id={popoverId} ref={popoverRef}>
        <div
          className={styles.pane}
          data-parity="columns-pane"
          onKeyDownCapture={onPaneKeyDownCapture}
        >
          {panel === "main" ? (
            <>
              <div className={styles.section}>
                <div className={styles.sortRow}>
                  <span className={styles.labelGroup}>
                    <s-icon type="sort"></s-icon>
                    {labels.sortBy}
                  </span>
                  <button
                    type="button"
                    className={styles.actionButton}
                    data-parity="sort-button"
                    aria-label={format(labels.sortByNamed, { sort: current?.label ?? "" })}
                    onClick={() => setPanel("sort")}
                  >
                    {current?.label}
                    <s-icon type="select"></s-icon>
                  </button>
                </div>
              </div>
              <div className={styles.divider} />
              <div className={styles.section}>
                <div className={styles.columns}>
                  <span className={styles.columnsLabel} data-parity="columns-label">
                    {labels.columns}
                  </span>
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={onDragEnd}
                    accessibility={dragText}
                  >
                    <SortableContext
                      items={columns.map((column) => column.key)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className={styles.rows}>
                        {columns.map((column) => (
                          <SortableRow
                            key={column.key}
                            column={column}
                            onToggle={onToggle}
                            showLabel={labels.show}
                            hideLabel={labels.hide}
                            reorderLabel={format(labels.reorder, { column: column.label })}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className={styles.panelSection}>
                <button type="button" className={styles.option} onClick={() => setPanel("main")}>
                  <s-icon type="chevron-left"></s-icon>
                  {labels.sortBy}
                </button>
              </div>
              <div className={styles.divider} />
              <div className={styles.panelSection} role="menu">
                {sortOptions.map((option) => (
                  <button
                    key={option.field}
                    type="button"
                    role="menuitemradio"
                    aria-checked={option.field === current?.field}
                    className={styles.option}
                    data-parity={
                      option.field === current?.field ? "sort-option-current" : "sort-option"
                    }
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
            </>
          )}
        </div>
      </s-popover>
    </>
  );
};
