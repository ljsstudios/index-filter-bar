import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { appendAddButton, findAddButton, removeAddButton } from "../filters/addFilter";
import { DateCalendar } from "../filters/DateCalendar";
import {
  groupParts,
  isDateField,
  isTypedDate,
  readDateValues,
  groupDate as readGroupDate,
  tidyDateParts,
} from "../filters/dateUnit";
import {
  caretAfterUnit,
  caretBeforeUnit,
  caretText,
  insertUnitAtCaret,
  isUnitSpan,
  placeCaret,
  readText,
  rebuild,
  removeUnit,
  renderUnit,
  spaceUnits,
  type TypedValue,
  unitBesideCaret,
  unitSpans,
  unitText,
  unitTouchingCaret,
} from "../filters/dom";
import { fieldListRows } from "../filters/fieldList";
import { DEFAULT_PRECISION, tidyNumber } from "../filters/numberInput";
import {
  isNumberField,
  isRangeOperator,
  numberInputs,
  readNumberValues,
} from "../filters/numberUnit";
import { Picker, type PickerRow, pickerRowId } from "../filters/Picker";
import pickerStyles from "../filters/Picker.module.css";
import { isTextField, readTextValues } from "../filters/textUnit";
import type { FilterField, FilterUnit } from "../filters/types";
import { defaultLabels, format, type IndexFilterBarLabels } from "../labels";
import styles from "./SearchField.module.css";

export interface SearchFieldLabels {
  placeholder: string;
  clear: string;
  removeFilter: string;
  enter: string;
  fieldList: string;
  more: (count: number) => string;
  is: string;
  isNot: string;
  noOptions: string;
  addFilter: string;
  /** Date fields: the two rows that turn a preset into typed dates, and the range labels. */
  customDate: string;
  customRange: string;
  starting: string;
  ending: string;
  /** Words only a screen reader hears. */
  a11y: SearchFieldA11yLabels;
}

/** SearchField's words, built from the bar's labels (English by default). */
export const toSearchFieldLabels = (
  labels: IndexFilterBarLabels = defaultLabels,
): SearchFieldLabels => {
  const { search, a11y, operators } = labels;
  return {
    ...search,
    more: (count) => format(search.more, { count }),
    is: operators.is,
    isNot: operators.isNot,
    a11y: {
      help: a11y.help,
      remove: (chip) => format(a11y.remove, { chip }),
      values: (field) => format(a11y.values, { field }),
      condition: (field) => format(a11y.condition, { field }),
      minimum: a11y.minimum,
      maximum: a11y.maximum,
      year: a11y.year,
      month: a11y.month,
      day: a11y.day,
      added: (chip) => format(a11y.added, { chip }),
      changed: (chip) => format(a11y.changed, { chip }),
      removed: (chip) => format(a11y.removed, { chip }),
      chipHint: (chip) => format(a11y.chipHint, { chip }),
      loading: a11y.loading,
    },
  };
};

const DEFAULT_LABELS = toSearchFieldLabels();

/** The screen reader's words: input names, list names, the field's help. */
export interface SearchFieldA11yLabels {
  /** The field's description: how chips are reached and removed. */
  help: string;
  /** A chip's ✕, with the chip's words: "Remove Available is 5". */
  remove: (chip: string) => string;
  /** A value list: "Product vendor values". */
  values: (field: string) => string;
  /** A condition list: "Product vendor condition". */
  condition: (field: string) => string;
  /** A range's two numbers. */
  minimum: string;
  maximum: string;
  /** A typed date's parts. */
  year: string;
  month: string;
  day: string;
  /** Said when a filter is applied, changed or removed, with its words. */
  added: (chip: string) => string;
  changed: (chip: string) => string;
  removed: (chip: string) => string;
  /** Said when a chip becomes the active one: its words and how to remove it. */
  chipHint: (chip: string) => string;
  /** The loading row's name, while more values arrive. */
  loading: string;
}

interface SearchFieldProps {
  /** The page's search text (the undebounced value). */
  value: string;
  onChange: (value: string) => void;
  /** The fields the bar can filter by; none for a search-only bar. */
  fields?: readonly FilterField[];
  /** The page's filters: complete units only. */
  filters?: readonly Omit<FilterUnit, "id">[];
  onFiltersChange?: (filters: Omit<FilterUnit, "id">[]) => void;
  /**
   * Fields filtered outside the bar, such as a saved view's hidden filters:
   * the field list leaves them out, as it does fields with a chip.
   */
  usedFields?: readonly string[];
  /** English by default; `toSearchFieldLabels(localeLabels)` for another language. */
  labels?: SearchFieldLabels;
}

/**
 * What the keys and the picker work on. A chip is active by a click or an
 * arrow (no caret), or by the caret touching its unit's right edge (`caret`),
 * where typing filters its values (the admin's right-of-chip).
 */
type Active =
  | null
  | { kind: "editor" }
  | {
      kind: "chip";
      unitId: string;
      part: "param" | "value";
      caret?: boolean;
      /** A number unit: which of its numbers has focus. */
      input?: number;
    };

/** The highlighted row: none, the first row, or a row kept by id as the rows change. */
type Highlight = null | "first" | { id: string };

const sameTarget = (a: Active, b: Active) =>
  a?.kind === "editor"
    ? b?.kind === "editor"
    : a?.kind === "chip" && b?.kind === "chip" && a.unitId === b.unitId && a.part === b.part;

const NO_FIELDS: readonly FilterField[] = [];
const NO_FILTERS: readonly Omit<FilterUnit, "id">[] = [];
const NO_USED_FIELDS: readonly string[] = [];
const PICKER_ID = "search-field-picker";
const HELP_ID = "search-field-help";
/** Values shown at a time in a long list, and added on reaching its end (the admin's). */
const VALUE_PAGE = 25;
/** How long a server list waits after typing before it searches (the admin's). */
const VALUE_SEARCH_DELAY = 250;
let nextUnitId = 0;
const newUnitId = () => `unit-${++nextUnitId}`;

/**
 * The admin's search and filter field: a one-line contenteditable after the search icon, holding free text and
 * filter units. Focus opens the field list at the caret; choosing a field
 * puts a unit there and opens its values, then Is / Is not.
 *
 * While the field has focus its DOM is the truth: the browser edits the text
 * around the units, and every change reports the text and the complete
 * filters. Away from it the field is rebuilt from the page's state, so a view
 * loaded or Reset lands without fighting the merchant's caret.
 */
export const SearchField = ({
  value,
  onChange,
  fields = NO_FIELDS,
  filters = NO_FILTERS,
  onFiltersChange,
  usedFields = NO_USED_FIELDS,
  labels = DEFAULT_LABELS,
}: SearchFieldProps) => {
  const editableRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const unitsRef = useRef(new Map<string, FilterUnit>());
  const focusedRef = useRef(false);
  // Focus from a click shows no ring (the admin's data-pointer-focus).
  const [pointerFocus, setPointerFocus] = useState(false);
  // When the pointer last went down on the bar: focus within a moment of it
  // came from a click. A flag would outlive the click and make a later
  // return to the tab look like one.
  const pointerDownAtRef = useRef(Number.NEGATIVE_INFINITY);
  const fromPointer = () => performance.now() - pointerDownAtRef.current < 500;
  const [overflow, setOverflow] = useState({ left: false, right: false });
  const [active, setActive] = useState<Active>(null);
  // The latest active element, for handlers that run before a render.
  const activeRef = useRef<Active>(null);
  const [dismissed, setDismissed] = useState(false);
  const [highlight, setHighlight] = useState<Highlight>(null);
  const [filterText, setFilterText] = useState("");
  // ---- Long value lists, a page at a time (the admin's 25) ----
  // A list the page holds shows this many; scrolling to its end adds 25.
  const [valueLimit, setValueLimit] = useState(VALUE_PAGE);
  // A server list is fetching its next page or a search's first.
  const [loadingValues, setLoadingValues] = useState(false);
  const fetchingRef = useRef(false);
  const filterTextRef = useRef("");
  const [anchor, setAnchor] = useState({ left: 0, top: 0 });
  // Bumped when a unit changes, so the picker's rows read it afresh.
  const [unitsVersion, setUnitsVersion] = useState(0);
  // Text typed after a unit to filter its values.
  const typedRef = useRef<TypedValue | null>(null);
  // The caret the field last acted on, so a repeat selectionchange is a no-op.
  const lastCaretRef = useRef<{ node: Node; offset: number } | null>(null);
  // Leaving a chip with Escape keeps the picker closed.
  const keepDismissedRef = useRef(false);
  // The "+" stays away while keys are pressed, and comes back a second after
  // typing stops or when a unit is added (the admin's suppressAddFilter).
  const [suppressAdd, setSuppressAdd] = useState(false);
  const addTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const suppressAddNow = () => {
    clearTimeout(addTimerRef.current);
    setSuppressAdd(true);
  };
  const allowAddLater = () => {
    clearTimeout(addTimerRef.current);
    addTimerRef.current = setTimeout(() => setSuppressAdd(false), 1000);
  };
  useEffect(() => () => clearTimeout(addTimerRef.current), []);

  const chipClasses = useMemo(
    () => ({
      unit: styles.unit,
      chip: styles.chip,
      param: styles.param,
      value: styles.value,
      lastValue: styles.lastValue,
      active: styles.active,
      remove: styles.remove,
      numeric: styles.numeric,
      range: styles.range,
      container: styles.numberContainer,
      input: styles.numberInput,
      separator: styles.separator,
      date: styles.date,
      dateRange: styles.dateRange,
      dateGroup: styles.dateGroup,
      datePart: styles.datePart,
      dateSeparator: styles.dateSeparator,
      dateLabel: styles.dateLabel,
      rangeSeparator: styles.rangeSeparator,
      textChip: styles.textChip,
      textInput: styles.textInput,
      prefix: styles.numberPrefix,
      suffix: styles.numberSuffix,
      readOnlyParam: styles.readOnlyParam,
      readOnlyValue: styles.readOnlyValue,
    }),
    [],
  );
  const fieldOf = useCallback((key: string) => fields.find((f) => f.key === key), [fields]);

  const measureOverflow = useCallback(() => {
    const el = editableRef.current;
    if (!el) return;
    const left = el.scrollLeft > 0;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setOverflow((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
  }, []);

  const drawUnit = useCallback(
    (span: HTMLSpanElement, unit: FilterUnit) => {
      const field = fieldOf(unit.field);
      if (!field) return;
      renderUnit(span, unit, field, chipClasses, {
        remove: labels.removeFilter,
        more: labels.more,
        starting: labels.starting,
        ending: labels.ending,
        a11y: labels.a11y,
      });
    },
    [
      fieldOf,
      chipClasses,
      labels.removeFilter,
      labels.more,
      labels.starting,
      labels.ending,
      labels.a11y,
    ],
  );

  // ---- Screen reader announcements ----
  const [announcement, setAnnouncement] = useState("");
  // Each applied unit's words at the last commit, by unit id.
  const committedRef = useRef(new Map<string, string>());
  const textOf = useCallback(
    (unit: FilterUnit) => {
      const field = fieldOf(unit.field);
      return field
        ? unitText(field, unit, labels.more, {
            remove: labels.removeFilter,
            starting: labels.starting,
            ending: labels.ending,
          })
        : "";
    },
    [fieldOf, labels.more, labels.removeFilter, labels.starting, labels.ending],
  );
  // Cleared first, so the same words twice are said twice.
  const announce = (text: string) => {
    setAnnouncement("");
    requestAnimationFrame(() => setAnnouncement(text));
  };
  // Read by the memoised activate, so always this render's labels.
  const hintChipRef = useRef((_unitId: string) => {});
  hintChipRef.current = (unitId: string) => {
    const unit = unitsRef.current.get(unitId);
    // Typed chips (numbers, typed dates, text) take focus in a named textbox
    // instead, where Backspace edits before it removes.
    if (!unit || unit.values.length === 0 || spanOf(unitId)?.dataset.kind === "typed") return;
    announce(labels.a11y.chipHint(textOf(unit)));
  };

  // Away from the field, it shows the page's state.
  useLayoutEffect(() => {
    const el = editableRef.current;
    if (!el || focusedRef.current) return;
    const units = new Map<string, FilterUnit>();
    const spans: HTMLSpanElement[] = [];
    for (const filter of filters) {
      if (!fieldOf(filter.field) || filter.values.length === 0) continue;
      const unit = { ...filter, id: newUnitId() };
      units.set(unit.id, unit);
      const span = document.createElement("span");
      drawUnit(span, unit);
      spans.push(span);
    }
    unitsRef.current = units;
    // The page's own filters are where announcements start from: only what
    // the merchant changes from here is said.
    committedRef.current = new Map([...units.values()].map((unit) => [unit.id, textOf(unit)]));
    rebuild(el, spans, value);
    measureOverflow();
  }, [filters, value, fieldOf, drawUnit, measureOverflow, textOf]);

  // The browser's undo cannot replay the units built by script, so it is
  // off. Native: React's beforeinput has no inputType.
  useEffect(() => {
    const el = editableRef.current;
    if (!el) return;
    const block = (event: InputEvent) => {
      if (event.inputType === "historyUndo" || event.inputType === "historyRedo") {
        event.preventDefault();
      }
    };
    el.addEventListener("beforeinput", block);
    return () => el.removeEventListener("beforeinput", block);
  }, []);

  useEffect(() => {
    window.addEventListener("resize", measureOverflow);
    return () => window.removeEventListener("resize", measureOverflow);
  }, [measureOverflow]);

  // The field's units in the order they sit.
  const orderedUnits = () => {
    const el = editableRef.current;
    if (!el) return [];
    return unitSpans(el)
      .map((span) => unitsRef.current.get(span.dataset.unitId ?? ""))
      .filter((unit): unit is FilterUnit => !!unit);
  };

  const commitFilters = () => {
    const complete = orderedUnits().filter((unit) => unit.values.length > 0);
    // Say what changed since the last commit: added, changed, removed.
    const before = committedRef.current;
    const after = new Map(complete.map((unit) => [unit.id, textOf(unit)]));
    const said: string[] = [];
    for (const [id, text] of after) {
      const was = before.get(id);
      if (was === undefined) said.push(labels.a11y.added(text));
      else if (was !== text) said.push(labels.a11y.changed(text));
    }
    for (const [id, text] of before) if (!after.has(id)) said.push(labels.a11y.removed(text));
    committedRef.current = after;
    if (said.length > 0) announce(said.join(". "));
    onFiltersChange?.(complete.map(({ id: _id, ...unit }) => unit));
  };

  const emitQuery = () => {
    const el = editableRef.current;
    if (el) onChange(readText(el, typedRef.current));
  };

  const spanOf = (unitId: string) =>
    editableRef.current?.querySelector<HTMLSpanElement>(`[data-unit-id="${unitId}"]`) ?? null;

  // ---- Number units ----
  // Our own moves of focus back to the field set the caret themselves.
  const internalFocusRef = useRef(false);
  // The calendar for a focused date part: its unit and group, and the group's
  // date as the part took focus (typing does not move it).
  const [calendar, setCalendar] = useState<null | {
    unitId: string;
    group: number;
    value: string;
  }>(null);

  /** A number input in the field that a node is, or sits in. */
  const inputOf = (node: EventTarget | null) =>
    node instanceof Node && editableRef.current?.contains(node)
      ? ((node instanceof HTMLElement ? node : node.parentElement)?.closest<HTMLElement>(
          "[data-input]",
        ) ?? null)
      : null;
  const unitIdOf = (node: Element) =>
    node.closest<HTMLElement>("[data-unit-id]")?.dataset.unitId ?? "";

  /** A unit typed into its chip: a number, or a date past its presets. */
  const isTyped = (unit: FilterUnit | undefined) => {
    const field = unit && fieldOf(unit.field);
    return isNumberField(field) || isTextField(field) || isTypedDate(field, unit);
  };

  /**
   * Reads a number unit's inputs into its values, tidied, and commits when
   * they changed (Enter, blur, arrowing out; typing alone never applies).
   */
  const applyNumber = (unitId: string) => {
    const span = spanOf(unitId);
    const unit = unitsRef.current.get(unitId);
    const field = unit && fieldOf(unit.field);
    if (!span || !unit) return;
    // A typed date: parts padded as a blur would, then the real dates read.
    if (isTypedDate(field, unit)) {
      tidyDateParts(span);
      const values = readDateValues(span);
      if (JSON.stringify(values) !== JSON.stringify(unit.values)) updateUnit({ ...unit, values });
      return;
    }
    // A text value: its trimmed text.
    if (isTextField(field)) {
      const values = readTextValues(span);
      if (JSON.stringify(values) !== JSON.stringify(unit.values)) updateUnit({ ...unit, values });
      return;
    }
    if (!isNumberField(field)) return;
    const precision = field?.number ?? DEFAULT_PRECISION;
    for (const input of numberInputs(span)) {
      const tidy = tidyNumber((input.textContent ?? "").trim(), precision);
      if (tidy !== input.textContent) input.textContent = tidy;
    }
    const values = readNumberValues(span);
    if (JSON.stringify(values) !== JSON.stringify(unit.values)) updateUnit({ ...unit, values });
  };

  /** Focuses one of a unit's numbers: all of it selected, or the caret at an end. */
  const focusInput = (unitId: string, index: number, where: "all" | "start" | "end") => {
    const span = spanOf(unitId);
    const input = span && numberInputs(span)[index];
    if (!input) return;
    input.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(input);
    if (where !== "all") range.collapse(where === "start");
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
  };

  /** Moves focus from a number back to the field, applying it first. */
  const leaveNumberInput = () => {
    const el = editableRef.current;
    const input = inputOf(document.activeElement);
    if (!el || !input) return;
    applyNumber(unitIdOf(input));
    internalFocusRef.current = true;
    el.focus({ preventScroll: true });
    internalFocusRef.current = false;
  };

  // The popover sits 6px under the bar: on a chip, under the
  // part being edited, or the unit's right end while it has no value chip
  //; for the field list, at the caret.
  const placePicker = useCallback((next: Active) => {
    const bar = barRef.current?.getBoundingClientRect();
    const el = editableRef.current;
    if (!bar || !el) return;
    let left = el.getBoundingClientRect().left + 4;
    if (next?.kind === "chip") {
      const span = el.querySelector(`[data-unit-id="${next.unitId}"]`);
      const part = span?.querySelector(`[data-part="${next.part}"]`);
      const rect = caretRect(el);
      // A date part's calendar sits under its group.
      const focused =
        next.input !== undefined ? span?.querySelector(`[data-input="${next.input}"]`) : null;
      const group = focused?.closest("[data-group]");
      if (group) left = group.getBoundingClientRect().left;
      else if (part) left = part.getBoundingClientRect().left;
      // No value chip yet: at the caret, so it follows a value filter as it is typed.
      else if (next.caret && rect) left = rect.left;
      else if (span) left = span.getBoundingClientRect().right;
    } else {
      const rect = caretRect(el);
      if (rect) left = rect.left;
    }
    // Relative to the bar the picker sits in.
    setAnchor({ left: Math.round(left - bar.left), top: Math.round(bar.height + 6) });
  }, []);

  const activate = useCallback(
    (next: Active, options: { keepDismissed?: boolean } = {}) => {
      const same = sameTarget(activeRef.current, next);
      const was = activeRef.current;
      activeRef.current = next;
      setActive(next);
      if (!options.keepDismissed) setDismissed(false);
      // The same element again keeps its highlight.
      if (!same) setHighlight(next?.kind === "chip" ? "first" : null);
      // Only the chip being edited is dark.
      const el = editableRef.current;
      if (el) {
        if (next?.kind === "chip" && !next.caret) el.dataset.chipActive = "true";
        else delete el.dataset.chipActive;
        for (const part of el.querySelectorAll(`.${styles.active}`))
          part.classList.remove(styles.active);
        if (next?.kind === "chip") {
          const span = el.querySelector(`[data-unit-id="${next.unitId}"]`);
          const part = span?.querySelector(`[data-part="${next.part}"]`);
          part?.classList.add(styles.active);
          // An active chip scrolled out of the field comes into view.
          (part ?? span)?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
        }
      }
      if (next) requestAnimationFrame(() => placePicker(next));
      // A chip reached by the arrows or a click (not the caret touching it)
      // says what it is and how to remove it, once per unit.
      if (
        next?.kind === "chip" &&
        !next.caret &&
        !(was?.kind === "chip" && was.unitId === next.unitId)
      ) {
        hintChipRef.current(next.unitId);
      }
    },
    [placePicker],
  );

  /**
   * Reads the caret into the active element (the admin's selectionchange):
   * touching a unit's right edge, that unit's values filtered by the text
   * typed there; elsewhere the field list filtered by the word at the caret.
   * Runs on every caret move while focused.
   */
  const syncCaret = (force = false) => {
    const el = editableRef.current;
    const selection = document.getSelection();
    if (!el || !focusedRef.current || !selection || selection.rangeCount === 0) return false;
    if (!selection.isCollapsed) return false;
    const { startContainer, startOffset } = selection.getRangeAt(0);
    if (startContainer !== el && startContainer.parentNode !== el) return false;
    const last = lastCaretRef.current;
    if (!force && last && last.node === startContainer && last.offset === startOffset) return true;
    lastCaretRef.current = { node: startContainer, offset: startOffset };
    const keepDismissed = keepDismissedRef.current;
    keepDismissedRef.current = false;

    const touching = unitTouchingCaret(el);
    const unitId = touching?.span.dataset.unitId;
    if (touching && unitId && unitsRef.current.has(unitId)) {
      typedRef.current = touching.node
        ? { unitId, node: touching.node, length: touching.typed.length }
        : null;
      const text = touching.typed.trim();
      const next: Active = { kind: "chip", unitId, part: "value", caret: true };
      const was = activeRef.current;
      activate(next, { keepDismissed });
      // A new value filter highlights its first match.
      if (sameTarget(was, next) && text !== filterTextRef.current) setHighlight("first");
      setFilterText(text);
      filterTextRef.current = text;
      return true;
    }
    typedRef.current = null;
    activate({ kind: "editor" }, { keepDismissed });
    const text = caretText(el);
    setFilterText(text);
    filterTextRef.current = text;
    return true;
  };
  const syncRef = useRef(syncCaret);
  syncRef.current = syncCaret;

  useEffect(() => {
    const onSelectionChange = () => {
      if (focusedRef.current) syncRef.current();
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, []);

  // A chip made active by a click or an arrow shows no caret. The caret is
  // parked, hidden, just before the unit rather than removed: with no
  // selection Chrome puts one back at the field's start on the next key,
  // which would read as a caret move and release the chip.
  const activateChip = (unitId: string, part: "param" | "value", keepDismissed = false) => {
    removeTyped();
    const el = editableRef.current;
    const span = spanOf(unitId);
    if (el && span) {
      placeCaret(el, { before: span });
      const range = document.getSelection()?.getRangeAt(0);
      lastCaretRef.current = range
        ? { node: range.startContainer, offset: range.startOffset }
        : null;
    }
    activate({ kind: "chip", unitId, part }, { keepDismissed });
  };

  // ---- Rows the picker shows for the active element ----
  const unitFor = (a: Active) => (a?.kind === "chip" ? unitsRef.current.get(a.unitId) : undefined);

  // biome-ignore lint/correctness/useExhaustiveDependencies: unitsVersion re-reads the units ref
  const rows = useMemo((): PickerRow[] => {
    if (!active) return [];
    if (active.kind === "editor") {
      const used = new Set([...usedFields, ...orderedUnits().map((u) => u.field)]);
      return fieldListRows(fields, used, filterText).map((row) => ({
        id: `field:${row.id}`,
        label: row.label,
      }));
    }
    const unit = unitFor(active);
    const field = unit && fieldOf(unit.field);
    if (!unit || !field) return [];
    // A date range is neither Is nor Is not.
    const ticked = (value: string) => unit.operator === value && unit.shape !== "range";
    const operatorRows: PickerRow[] = field.operators.map((operator) => ({
      id: `operator:${operator.value}`,
      label: operator.label,
      selected: ticked(operator.value),
      section: "operators",
      prefix: (
        <span className={pickerStyles.tickPrefix}>
          <span className={pickerStyles.tick} data-hidden={!ticked(operator.value)}>
            <s-icon type="check" color={ticked(operator.value) ? undefined : "subdued"}></s-icon>
          </span>
        </span>
      ),
    }));
    if (active.part === "param") return operatorRows.map((row) => ({ ...row, section: undefined }));
    // A number or a typed date is typed into its chip: no list (a date's
    // calendar is its own popover).
    if (isNumberField(field) || isTextField(field) || isTypedDate(field, unit)) return [];
    // Typed after the unit, the values narrow to labels holding the text;
    // a server list is searched by the server instead.
    const typed = active.caret ? filterText.toLowerCase() : "";
    const options = field.fetchMoreValues
      ? field.values
      : field.values
          .filter((option) => option.label.toLowerCase().includes(typed))
          .slice(0, valueLimit);
    // Nothing to show, or nothing matching: the admin's one grey row, no conditions.
    if (options.length === 0 && !loadingValues) {
      return [{ id: "message:none", label: labels.noOptions, disabled: true }];
    }
    // While a page loads, a spinner row ends the values.
    const loadingRows: PickerRow[] = loadingValues
      ? [{ id: "message:loading", label: "", disabled: true, loading: true }]
      : [];
    const valueRows: PickerRow[] = options.map((option) => {
      const chosen = unit.values.includes(option.value);
      return {
        id: `value:${option.value}`,
        label: option.label,
        selected: chosen,
        prefix: field.multi ? (
          // Drawn, not read: the option itself is the choice (aria-selected).
          <span className={pickerStyles.prefix} aria-hidden="true" inert>
            <s-checkbox checked={chosen || undefined}></s-checkbox>
          </span>
        ) : (
          <span className={pickerStyles.tickPrefix}>
            <span className={pickerStyles.tick} data-hidden={!chosen}>
              <s-icon type="check" color={chosen ? undefined : "subdued"}></s-icon>
            </span>
          </span>
        ),
      };
    });
    // A date field's presets end with Custom date and Custom range.
    const customRows: PickerRow[] = isDateField(field)
      ? [
          { id: "custom:date", label: labels.customDate },
          { id: "custom:range", label: labels.customRange },
        ].map((row) => ({
          ...row,
          prefix: (
            <span className={pickerStyles.tickPrefix}>
              <span className={pickerStyles.tick} data-hidden>
                <s-icon type="check" color="subdued"></s-icon>
              </span>
            </span>
          ),
        }))
      : [];
    return [...valueRows, ...loadingRows, ...customRows, ...operatorRows];
  }, [
    valueLimit,
    loadingValues,
    active,
    fields,
    usedFields,
    filterText,
    fieldOf,
    unitsVersion,
    labels.noOptions,
    labels.customDate,
    labels.customRange,
  ]);

  const pickerOpen = focusedRef.current && !!active && !dismissed && rows.length > 0;

  // The list field whose values are open, and the text typed to narrow them.
  const valueUnit =
    active?.kind === "chip" && active.part === "value" ? unitFor(active) : undefined;
  const valueField = valueUnit ? fieldOf(valueUnit.field) : undefined;
  const valueSearch = active?.kind === "chip" && active.caret ? filterText.trim() : "";
  const valueKey = valueUnit ? `${valueUnit.id}:${valueSearch}` : "";
  // A new list or a new search starts from its first page.
  // biome-ignore lint/correctness/useExhaustiveDependencies: valueKey is the list and search
  useEffect(() => setValueLimit(VALUE_PAGE), [valueKey]);
  const fetchValues = useCallback(async (field: FilterField, search: string) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setLoadingValues(true);
    try {
      await field.fetchMoreValues?.(search);
    } finally {
      fetchingRef.current = false;
      setLoadingValues(false);
    }
  }, []);
  // A server list: its first page when it opens empty, and a search 250ms
  // after the typing stops (the admin's).
  const searchedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!valueField?.fetchMoreValues || !valueUnit) {
      searchedRef.current = null;
      return;
    }
    if (searchedRef.current === valueKey) return;
    const run = () => {
      searchedRef.current = valueKey;
      void fetchValues(valueField, valueSearch);
    };
    const opening = !searchedRef.current?.startsWith(`${valueUnit.id}:`);
    if (opening && valueSearch === "") {
      if (valueField.values.length === 0) run();
      else searchedRef.current = valueKey;
      return;
    }
    const timer = setTimeout(run, VALUE_SEARCH_DELAY);
    return () => clearTimeout(timer);
  }, [valueField, valueUnit, valueKey, valueSearch, fetchValues]);
  // Scrolled to the end of the values: the next 25, or the server's next page.
  const onValuesEnd = () => {
    if (!valueField) return;
    if (valueField.fetchMoreValues) {
      if (valueField.hasNextPage) void fetchValues(valueField, valueSearch);
      return;
    }
    setValueLimit((limit) => limit + VALUE_PAGE);
  };
  // Each list is named for what it holds: the field list, a field's values,
  // a field's condition. The value picker's conditions are their own list.
  const pickerField = active?.kind === "chip" ? fieldOf(unitFor(active)?.field ?? "") : undefined;
  const pickerNames: {
    main: string;
    sections: Record<string, string>;
    multiselectable: boolean;
  } = !pickerField
    ? { main: labels.fieldList, sections: {}, multiselectable: false }
    : active?.kind === "chip" && active.part === "param"
      ? {
          main: labels.a11y.condition(pickerField.name),
          sections: {},
          multiselectable: false,
        }
      : {
          main: labels.a11y.values(pickerField.name),
          sections: { operators: labels.a11y.condition(pickerField.name) },
          multiselectable: pickerField.multi,
        };
  const pickerIds = [...new Set(rows.map((row) => row.section ?? "main"))].map((key, index) =>
    index === 0 ? PICKER_ID : `${PICKER_ID}-${key}`,
  );
  const activeIndex = (() => {
    if (!highlight) return -1;
    if (highlight === "first") return rows.findIndex((row) => !row.disabled);
    // Kept on its row while that row is listed.
    return rows.findIndex((row) => row.id === highlight.id && !row.disabled);
  })();

  // ---- Changes to units ----
  const updateUnit = (unit: FilterUnit) => {
    unitsRef.current.set(unit.id, unit);
    const span = spanOf(unit.id);
    if (span) drawUnit(span, unit);
    const current = activeRef.current;
    if (current?.kind === "chip" && current.unitId === unit.id) {
      span?.querySelector(`[data-part="${current.part}"]`)?.classList.add(styles.active);
    }
    setUnitsVersion((v) => v + 1);
    commitFilters();
    if (current) requestAnimationFrame(() => placePicker(current));
  };

  // Takes out text typed after a unit to filter its values,
  // leaving the caret touching the unit.
  function removeTyped(placeCaretAfter = false) {
    const el = editableRef.current;
    const typed = typedRef.current;
    typedRef.current = null;
    if (!el || !typed || typed.node.parentNode !== el) return;
    typed.node.deleteData(0, Math.min(typed.length, typed.node.length));
    if (typed.node.length === 0) typed.node.remove();
    const span = spanOf(typed.unitId);
    if (placeCaretAfter && span) placeCaret(el, { after: span });
    emitQuery();
  }

  const deleteUnit = (unitId: string) => {
    const el = editableRef.current;
    const span = spanOf(unitId);
    if (!el || !span) return;
    if (typedRef.current?.unitId === unitId) removeTyped();
    const next = removeUnit(span);
    unitsRef.current.delete(unitId);
    if (next) placeCaret(el, { before: next });
    else placeCaret(el);
    setUnitsVersion((v) => v + 1);
    commitFilters();
    lastCaretRef.current = null;
    if (!syncCaret()) activate({ kind: "editor" });
    measureOverflow();
  };

  const addUnit = (fieldKey: string, operator: string) => {
    const el = editableRef.current;
    const field = fieldOf(fieldKey);
    if (!el || !field) return;
    const unit: FilterUnit = { id: newUnitId(), field: fieldKey, operator, values: [] };
    unitsRef.current.set(unit.id, unit);
    const span = document.createElement("span");
    drawUnit(span, unit);
    // The caret stays touching the new unit, so its values open at its right
    // end and typing filters them.
    insertUnitAtCaret(el, span);
    clearTimeout(addTimerRef.current);
    setSuppressAdd(false);
    setUnitsVersion((v) => v + 1);
    emitQuery();
    lastCaretRef.current = null;
    // A number unit focuses its first number, with no popover.
    // A number or text unit focuses its input, with no popover.
    if (isNumberField(field) || isTextField(field)) focusInput(unit.id, 0, "all");
    else syncCaret();
    measureOverflow();
  };

  // Leaves a unit: before it, or past a space after it.
  const leaveUnit = (
    unitId: string,
    side: "before" | "after",
    options: { keepDismissed?: boolean } = {},
  ) => {
    const el = editableRef.current;
    const span = spanOf(unitId);
    if (!el || !span) return;
    removeTyped();
    if (side === "before") caretBeforeUnit(el, span);
    else caretAfterUnit(span);
    lastCaretRef.current = null;
    keepDismissedRef.current = !!options.keepDismissed;
    syncCaret();
    emitQuery();
  };

  const pick = (row: PickerRow) => {
    const current = activeRef.current;
    if (!current || row.disabled) return;
    if (row.id.startsWith("field:")) {
      const id = row.id.slice("field:".length);
      const [fieldKey = id, operator] = id.split(":");
      addUnit(fieldKey, operator ?? fieldOf(fieldKey)?.operators[0]?.value ?? "is");
      return;
    }
    const unit = unitFor(current);
    const field = unit && fieldOf(unit.field);
    if (!unit || !field) return;
    // Custom date / Custom range: the preset unit becomes typed dates in
    // place, applied at once (any preset goes), the year focused
    //.
    if (row.id.startsWith("custom:")) {
      updateUnit({
        ...unit,
        shape: row.id === "custom:range" ? "range" : "date",
        values: [],
      });
      focusInput(unit.id, 0, "all");
      return;
    }
    // A typed date's Is / Is not keep its date; a range becomes one date,
    // its Starting kept. Applied at once; the menu closes
    // and the field list opens after the unit (live).
    if (row.id.startsWith("operator:") && isTypedDate(field, unit)) {
      const span = spanOf(unit.id);
      if (span) tidyDateParts(span);
      const typed = span ? readDateValues(span) : unit.values;
      const first = typed[0] ?? "";
      updateUnit({
        ...unit,
        operator: row.id.slice("operator:".length),
        shape: "date",
        values: first ? [first] : [],
      });
      leaveUnit(unit.id, "after");
      return;
    }
    // A text value keeps its text across Is / Is not; applied at once, focus
    // back in the text with the caret at its end.
    if (row.id.startsWith("operator:") && isTextField(field)) {
      const span = spanOf(unit.id);
      const values = span ? readTextValues(span) : unit.values;
      updateUnit({ ...unit, operator: row.id.slice("operator:".length), values });
      focusInput(unit.id, 0, "end");
      return;
    }
    if (row.id.startsWith("operator:") && isNumberField(field)) {
      // A number keeps its first value: one to two numbers puts it first, two
      // to one drops the second. It applies at once and the first number is
      // selected.
      const operator = row.id.slice("operator:".length);
      const span = spanOf(unit.id);
      const typed = span
        ? numberInputs(span).map((input) => (input.textContent ?? "").trim())
        : unit.values;
      const first = typed[0] ?? "";
      const second = isRangeOperator(field, unit.operator) ? (typed[1] ?? "") : "";
      const next = isRangeOperator(field, operator) ? [first, second] : [first];
      updateUnit({ ...unit, operator, values: next.some((v) => v !== "") ? next : [] });
      focusInput(unit.id, 0, "all");
      return;
    }
    if (row.id.startsWith("operator:")) {
      updateUnit({ ...unit, operator: row.id.slice("operator:".length) });
      // From the param chip's menu the unit moves on to its values; from the
      // value picker's conditions it stays put (the admin's handleSelect).
      if (current.kind === "chip" && current.part === "param") {
        if (unit.values.length > 0) activateChip(unit.id, "value");
        else {
          const el = editableRef.current;
          const span = spanOf(unit.id);
          if (el && span) placeCaret(el, { after: span });
          lastCaretRef.current = null;
          syncCaret();
        }
      }
      return;
    }
    const chosen = row.id.slice("value:".length);
    if (field.multi) {
      const values = unit.values.includes(chosen)
        ? unit.values.filter((v) => v !== chosen)
        : [...unit.values, chosen];
      updateUnit({ ...unit, values });
      // A pick clears the text typed to find it.
      if (current.kind === "chip" && current.caret && typedRef.current) {
        removeTyped(true);
        lastCaretRef.current = null;
        syncCaret();
      }
      return;
    }
    // One value: picking the chosen one does nothing; otherwise it is taken,
    // the unit closes and the field list opens after it.
    if (unit.values.length === 1 && unit.values[0] === chosen) return;
    updateUnit({ ...unit, values: [chosen] });
    suppressAddNow();
    leaveUnit(unit.id, "after");
  };

  // ---- Events ----
  const emitText = () => {
    const el = editableRef.current;
    if (!el) return;
    // Typing in a number is the number's own: nothing applies until Enter,
    // blur or arrowing out.
    if (inputOf(document.activeElement)) return;
    // A stray <br> keeps the placeholder away; drop it.
    for (const br of el.querySelectorAll(":scope > br")) br.remove();
    if (el.textContent === "" && unitSpans(el).length === 0) el.replaceChildren();
    // Units the browser deleted with the text around them are gone.
    const present = new Set(unitSpans(el).map((span) => span.dataset.unitId));
    let lost = false;
    for (const id of unitsRef.current.keys()) {
      if (!present.has(id)) {
        unitsRef.current.delete(id);
        lost = true;
      }
    }
    if (lost) {
      setUnitsVersion((v) => v + 1);
      commitFilters();
    }
    syncCaret(true);
    if (activeRef.current?.kind !== "chip") allowAddLater();
    emitQuery();
    measureOverflow();
  };

  const onFocus = (event: React.FocusEvent<HTMLDivElement>) => {
    const el = editableRef.current;
    const fromInside = !!el && el.contains(event.relatedTarget as Node | null);
    if (!fromInside) {
      focusedRef.current = true;
      suppressAddNow();
      lastCaretRef.current = null;
    }
    // A number took focus: its unit's value chip is active, no picker.
    const input = inputOf(event.target);
    if (input) {
      const group = input.closest<HTMLElement>("[data-group]");
      setCalendar(
        input.dataset.datePart && group
          ? {
              unitId: unitIdOf(input),
              group: Number(group.dataset.group),
              value: readGroupDate(group),
            }
          : null,
      );
      activate({
        kind: "chip",
        unitId: unitIdOf(input),
        part: "value",
        input: Number(input.dataset.input),
      });
      return;
    }
    if (internalFocusRef.current) return;
    if (fromInside) {
      // Back from a number: it applies. From the keyboard (Shift+Tab) the
      // caret goes just before the unit with the field list (live); a click
      // leaves it where it landed.
      const from = inputOf(event.relatedTarget);
      const span = from?.closest<HTMLSpanElement>("[data-unit-id]");
      if (!from || !span) return;
      applyNumber(unitIdOf(from));
      if (el && !fromPointer()) {
        placeCaret(el, { before: span });
        lastCaretRef.current = null;
        syncCaret();
      }
      return;
    }
    // Focus without a click (Tab, coming back to the tab) puts the caret at
    // the end; a click keeps it where it lands.
    if (el && !fromPointer()) {
      placeCaret(el);
      // Coming back to the tab, Chrome puts back the caret it had when the
      // tab was left, after this handler: put it at the end again then.
      setTimeout(() => {
        if (!focusedRef.current || fromPointer() || document.activeElement !== el) return;
        placeCaret(el);
        lastCaretRef.current = null;
        syncCaret();
      }, 0);
    }
    if (!syncCaret()) activate({ kind: "editor" });
  };

  // Leaving the field: typed value filters and unfinished units
  // go, every unit keeps a space after it, the text scrolls back to its start,
  // and nothing is active.
  const onBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    const related = event.relatedTarget as Node | null;
    // Focus taken by the bar's own popover (the calendar's month arrows give
    // themselves focus on press) is not leaving the bar: the part it came
    // from gets it back (the admin's blur ignores its popover content).
    const left = event.target as HTMLElement;
    if (related && barRef.current?.contains(related) && !editableRef.current?.contains(related)) {
      setTimeout(() => {
        if (left.isConnected) left.focus({ preventScroll: true });
      }, 0);
      return;
    }
    if (editableRef.current && related && editableRef.current.contains(related)) {
      // Focus moving within the field: leaving a number's value chip applies
      // it; Tab between the two numbers of a range does not.
      const from = inputOf(event.target);
      // A Starting part applies on every blur, even to its own next part.
      const starting =
        !!from?.closest("[data-group='0']") && !!from?.closest("[data-shape='range']");
      if (from && (starting || !from.closest("[data-part='value']")?.contains(related))) {
        applyNumber(unitIdOf(from));
      }
      return;
    }
    // Numbers being typed are read in before the field settles.
    for (const unit of orderedUnits()) {
      if (isTyped(unit)) applyNumber(unit.id);
    }
    focusedRef.current = false;
    clearTimeout(addTimerRef.current);
    setSuppressAdd(false);
    lastCaretRef.current = null;
    setPointerFocus(false);
    const el = editableRef.current;
    if (el) {
      // No caret is left behind for Chrome to restore on the way back.
      const selection = document.getSelection();
      if (selection?.rangeCount && el.contains(selection.getRangeAt(0).startContainer)) {
        selection.removeAllRanges();
      }
      // A value filter typed after an unfinished unit stays as search text
      // when the unit goes, as in the admin; after a finished one it goes.
      const typedUnit = typedRef.current && unitsRef.current.get(typedRef.current.unitId);
      if (typedUnit && typedUnit.values.length === 0) typedRef.current = null;
      else removeTyped();
      for (const unit of orderedUnits()) {
        if (unit.values.length === 0) {
          const span = spanOf(unit.id);
          if (span) removeUnit(span);
          unitsRef.current.delete(unit.id);
        }
      }
      spaceUnits(el);
      el.scrollLeft = 0;
      for (const part of el.querySelectorAll(`.${styles.active}`))
        part.classList.remove(styles.active);
    }
    if (el) delete el.dataset.chipActive;
    activeRef.current = null;
    setActive(null);
    commitFilters();
    emitQuery();
    measureOverflow();
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const part = target.closest<HTMLElement>("[data-part]");
    const span = target.closest<HTMLSpanElement>("[data-unit-id]");
    // A press elsewhere in the field drops the "+" (not on it, nor on a unit).
    const add = editableRef.current && findAddButton(editableRef.current);
    if (add && !add.contains(target) && !span) add.remove();
    if (!part || !span?.dataset.unitId) return;
    const unitId = span.dataset.unitId;
    // A read-only chip opens nothing and takes no focus; only its x acts
    //.
    if (span.dataset.kind === "readonly" && part.dataset.part !== "remove") {
      event.preventDefault();
      return;
    }
    // A press on a number puts the caret there (its own focus). Elsewhere on
    // a number's value chip: the en dash goes to the second number, the
    // padding to the end of the first.
    if (inputOf(target)) return;
    const pressedUnit = unitsRef.current.get(unitId);
    // A text chip's padding puts the caret at the end of its text.
    if (part.dataset.part === "value" && isTextField(fieldOf(pressedUnit?.field ?? ""))) {
      event.preventDefault();
      focusInput(unitId, 0, "end");
      return;
    }
    if (
      part.dataset.part === "value" &&
      isTypedDate(fieldOf(pressedUnit?.field ?? ""), pressedUnit)
    ) {
      // A date's label, separators or en dash go to that group's year; the
      // chip's own padding does nothing.
      event.preventDefault();
      const group = target.closest<HTMLElement>("[data-group]");
      const year = group && groupParts(group)[0];
      if (year) focusInput(unitId, Number(year.dataset.input), "all");
      return;
    }
    if (part.dataset.part === "value" && isNumberField(fieldOf(pressedUnit?.field ?? ""))) {
      event.preventDefault();
      if (target.closest("[data-container='1']")) focusInput(unitId, 1, "all");
      else focusInput(unitId, 0, "end");
      return;
    }
    // A chip press opens its menu; no caret goes into the field.
    event.preventDefault();
    if (!focusedRef.current) {
      focusedRef.current = true;
      editableRef.current?.focus({ preventScroll: true });
    }
    // The x removes on click, so pressing and dragging off it cancels.
    if (part.dataset.part === "remove") return;
    // A number being typed applies before its condition menu opens.
    leaveNumberInput();
    activateChip(unitId, part.dataset.part === "param" ? "param" : "value");
  };

  const onClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const remove = target.closest<HTMLElement>("[data-part='remove']");
    const span = target.closest<HTMLSpanElement>("[data-unit-id]");
    if (remove && span?.dataset.unitId) {
      leaveNumberInput();
      deleteUnit(span.dataset.unitId);
      return;
    }
    if (span) return;
    // A click in the text releases any chip: the caret decides.
    syncCaret(true);
  };

  /**
   * Keys in a number, with our
   * rules where the admin's are not copied: Escape keeps the filter, Delete at
   * the end steps out as Right does.
   */
  const numberKey = (event: React.KeyboardEvent<HTMLDivElement>, input: HTMLElement) => {
    const el = editableRef.current;
    const span = input.closest<HTMLSpanElement>("[data-unit-id]");
    if (!el || !span || event.defaultPrevented) return;
    const unitId = span.dataset.unitId ?? "";
    const inputs = numberInputs(span);
    const index = inputs.indexOf(input);
    const last = index === inputs.length - 1;
    const text = input.textContent ?? "";
    const selection = document.getSelection();
    const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
    const probe = document.createRange();
    probe.selectNodeContents(input);
    if (range) probe.setEnd(range.startContainer, range.startOffset);
    const start = range ? probe.toString().length : text.length;
    const collapsed = !range || range.collapsed;
    const atStart = start === 0;
    const atEnd = collapsed && start === text.length;
    const stepOut = () => {
      applyNumber(unitId);
      internalFocusRef.current = true;
      el.focus({ preventScroll: true });
      internalFocusRef.current = false;
      leaveUnit(unitId, "after");
    };

    switch (event.key) {
      case "ArrowUp":
      case "ArrowDown":
        event.preventDefault();
        return;
      case "Enter":
        event.preventDefault();
        if (input.dataset.datePart) {
          dateEnter(unitId, input);
          return;
        }
        if (!last) focusInput(unitId, index + 1, "all");
        else {
          // Applied, and the bar is left with no field list.
          applyNumber(unitId);
          input.blur();
        }
        return;
      case "Escape":
        event.preventDefault();
        applyNumber(unitId);
        internalFocusRef.current = true;
        el.focus({ preventScroll: true });
        internalFocusRef.current = false;
        leaveUnit(unitId, "after", { keepDismissed: true });
        return;
      case "Tab":
        if (!event.shiftKey && !last) {
          event.preventDefault();
          focusInput(unitId, index + 1, "all");
        } else if (event.shiftKey && index > 0) {
          event.preventDefault();
          focusInput(unitId, index - 1, "all");
        } else if (event.shiftKey) {
          event.preventDefault();
          applyNumber(unitId);
          internalFocusRef.current = true;
          el.focus({ preventScroll: true });
          internalFocusRef.current = false;
          placeCaret(el, { before: span });
          lastCaretRef.current = null;
          syncCaret();
        } else setDismissed(true);
        return;
      case "ArrowLeft":
        if (!atStart) return;
        event.preventDefault();
        if (index > 0) focusInput(unitId, index - 1, "end");
        else {
          applyNumber(unitId);
          internalFocusRef.current = true;
          el.focus({ preventScroll: true });
          internalFocusRef.current = false;
          activateChip(unitId, "param");
        }
        return;
      case "ArrowRight":
      case "Delete":
        if (!atEnd) return;
        event.preventDefault();
        if (!last) focusInput(unitId, index + 1, "start");
        else stepOut();
        return;
      case "Backspace":
        if (!(collapsed && atStart)) return;
        event.preventDefault();
        // A text with something in it is not thrown away by one press at its
        // start: the caret steps out before it.
        if (input.dataset.parity === "text-input" && text !== "") {
          applyNumber(unitId);
          internalFocusRef.current = true;
          el.focus({ preventScroll: true });
          internalFocusRef.current = false;
          leaveUnit(unitId, "before");
          return;
        }
        if (index > 0) focusInput(unitId, index - 1, "end");
        else {
          internalFocusRef.current = true;
          el.focus({ preventScroll: true });
          internalFocusRef.current = false;
          deleteUnit(unitId);
        }
        return;
    }
  };

  /**
   * Enter in a date part: an unfilled part moves to the
   * next in its group; a real Starting date moves to Ending; a real Ending or
   * single date, or Enter on the day, applies and leaves the bar.
   */
  const dateEnter = (unitId: string, input: HTMLElement) => {
    const group = input.closest<HTMLElement>("[data-group]");
    if (!group) return;
    const parts = groupParts(group);
    const at = parts.indexOf(input);
    const name = input.dataset.datePart;
    const full = (input.textContent ?? "").length >= (name === "year" ? 4 : 2);
    const next = parts[at + 1];
    const isStarting =
      group.dataset.group === "0" && !!group.parentElement?.querySelector("[data-group='1']");
    const valid = readGroupDate(group) !== "";
    if (!full && next) {
      focusInput(unitId, Number(next.dataset.input), "all");
      return;
    }
    if (isStarting) {
      if (valid) focusInput(unitId, 3, "all");
      else if (next) focusInput(unitId, Number(next.dataset.input), "all");
      return;
    }
    if (valid || name === "day") {
      applyNumber(unitId);
      input.blur();
    } else if (next) focusInput(unitId, Number(next.dataset.input), "all");
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.nativeEvent.isComposing) return;
    const el = editableRef.current;
    if (!el) return;
    const current = activeRef.current;
    const chip = current?.kind === "chip" ? current : null;
    const input = inputOf(event.target);

    // Any key but the arrows and Enter takes the "+" away until typing stops; a space
    // where it stands takes its place (the admin's keydown).
    const modifier = ["Shift", "Control", "Alt", "Meta", "CapsLock"].includes(event.key);
    const arrow = event.key.startsWith("Arrow");
    if (event.key === " " && !input && findAddButton(el)) {
      event.preventDefault();
      removeAddButton(el);
      const space = document.createTextNode("\u00a0");
      const range = document.getSelection()?.rangeCount
        ? document.getSelection()?.getRangeAt(0)
        : null;
      if (range) {
        range.deleteContents();
        range.insertNode(space);
        placeCaret(el, { after: space });
      }
      suppressAddNow();
      setDismissed(false);
      lastCaretRef.current = null;
      syncCaret();
      emitQuery();
      return;
    }
    // Keys typed in a date part never reach the admin's bar.
    // Nor in a text with a length.
    const dateDigit =
      (!!input?.dataset.datePart || !!input?.dataset.maxLength) &&
      event.key.length === 1 &&
      !event.metaKey &&
      !event.ctrlKey;
    if (!modifier && !arrow && event.key !== "Enter" && !dateDigit) {
      removeAddButton(el);
      suppressAddNow();
    }

    // Undo and redo are off.
    if (
      (event.metaKey || event.ctrlKey) &&
      (event.key === "z" || event.key === "Z" || event.key === "y")
    ) {
      event.preventDefault();
      return;
    }

    if (input) {
      numberKey(event, input);
      return;
    }

    // Up and Down never move the caret; with a picker they move the highlight
    // over the rows that can be picked.
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!pickerOpen) return;
      const pickable = rows.flatMap((row, index) => (row.disabled ? [] : [index]));
      if (pickable.length === 0) return;
      const at = pickable.indexOf(activeIndex);
      const step = event.key === "ArrowDown" ? 1 : -1;
      const nextAt =
        at < 0
          ? step > 0
            ? 0
            : pickable.length - 1
          : (at + step + pickable.length) % pickable.length;
      const row = rows[pickable[nextAt] ?? 0];
      if (row) setHighlight({ id: row.id });
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const row = pickerOpen ? rows[activeIndex] : undefined;
      if (row) pick(row);
      else el.blur();
      return;
    }
    // Escape closes the picker and keeps the chip; again, it
    // leaves the chip with the picker still closed, then leaves the field.
    if (event.key === "Escape") {
      event.preventDefault();
      if (pickerOpen) setDismissed(true);
      else if (chip) leaveUnit(chip.unitId, "after", { keepDismissed: true });
      else el.blur();
      return;
    }
    // Tab closes the picker and leaves in one press.
    if (event.key === "Tab") {
      setDismissed(true);
      return;
    }
    const printable = event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey;

    // The caret touching a unit: typing filters its values and the browser
    // edits that text; with none typed, Backspace and Left step onto the unit
    // and off it.
    if (chip?.caret) {
      const typed = typedRef.current?.unitId === chip.unitId ? typedRef.current.length : 0;
      if (typed > 0) return;
      if (event.key === "Backspace") {
        // The caret touches the open unit: Backspace removes it.
        event.preventDefault();
        deleteUnit(chip.unitId);
      } else if (event.key === "ArrowLeft") {
        // Into the unit from the right: its condition.
        event.preventDefault();
        activateChip(chip.unitId, "param");
      }
      return;
    }
    if (chip) {
      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        deleteUnit(chip.unitId);
      } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        // Part to part within the unit, then out of it: value
        // to condition on Left, condition to value on Right. Past the end
        // the caret steps over the space, so no press looks like nothing
        // happened.
        event.preventDefault();
        const unit = unitsRef.current.get(chip.unitId);
        if (event.key === "ArrowLeft") {
          if (chip.part === "value") activateChip(chip.unitId, "param");
          else leaveUnit(chip.unitId, "before");
        } else if (chip.part === "param" && unit && isTyped(unit)) {
          focusInput(chip.unitId, 0, "start");
        } else if (chip.part === "param" && unit && unit.values.length > 0) {
          activateChip(chip.unitId, "value");
        } else if (chip.part === "param") {
          // No value chip yet: the caret touches the unit, its values open.
          const span = spanOf(chip.unitId);
          if (span) placeCaret(el, { after: span });
          lastCaretRef.current = null;
          syncCaret();
        } else leaveUnit(chip.unitId, "after");
      } else if (printable) {
        // On a value chip a key types its value filter, right after the
        // unit; a param chip takes none.
        const span = spanOf(chip.unitId);
        if (chip.part === "value" && span) {
          placeCaret(el, { after: span });
          lastCaretRef.current = null;
        } else event.preventDefault();
      }
      return;
    }
    // At a gap beside a unit: Backspace and the arrows step onto it, one stop
    // a press.
    const besideLeft = gapUnit(el, "left");
    const besideRight = gapUnit(el, "right");
    // A read-only unit: Backspace reaches it, then removes it; Delete right
    // before it removes it; one arrow press steps over it.
    const readOnlyLeft = besideLeft?.dataset.kind === "readonly" ? besideLeft : null;
    const readOnlyRight = besideRight?.dataset.kind === "readonly" ? besideRight : null;
    if (readOnlyLeft && (event.key === "Backspace" || event.key === "ArrowLeft")) {
      event.preventDefault();
      const touching = unitBesideCaret(el, "left") === readOnlyLeft;
      if (event.key === "Backspace" && touching) deleteUnit(readOnlyLeft.dataset.unitId ?? "");
      else if (event.key === "Backspace") placeCaret(el, { after: readOnlyLeft });
      else placeCaret(el, { before: readOnlyLeft });
      lastCaretRef.current = null;
      syncCaret();
      return;
    }
    if (readOnlyRight && (event.key === "Delete" || event.key === "ArrowRight")) {
      event.preventDefault();
      const touching = unitBesideCaret(el, "right") === readOnlyRight;
      if (event.key === "Delete" && touching) deleteUnit(readOnlyRight.dataset.unitId ?? "");
      else if (event.key === "Delete") placeCaret(el, { before: readOnlyRight });
      else placeCaret(el, { after: readOnlyRight });
      lastCaretRef.current = null;
      syncCaret();
      return;
    }
    // A number on the left is entered at the end of its last number
    //: it never opens from the caret touching it.
    const leftUnit = besideLeft && unitsRef.current.get(besideLeft.dataset.unitId ?? "");
    if ((event.key === "ArrowLeft" || event.key === "Backspace") && leftUnit && isTyped(leftUnit)) {
      event.preventDefault();
      focusInput(leftUnit.id, numberInputs(besideLeft).length - 1, "end");
      return;
    }
    // Left crosses the space, so the caret touches the unit and its values
    // open, the caret still showing (the admin's right-of-chip).
    if (event.key === "ArrowLeft" && besideLeft) {
      event.preventDefault();
      placeCaret(el, { after: besideLeft });
      lastCaretRef.current = null;
      syncCaret();
      return;
    }
    // Backspace at a gap: the admin deletes the space, which leaves the caret
    // touching the unit with its values open; the next press removes it.
    // Ours keeps the space and moves the caret instead.
    if (event.key === "Backspace" && besideLeft) {
      event.preventDefault();
      placeCaret(el, { after: besideLeft });
      lastCaretRef.current = null;
      syncCaret();
      return;
    }
    if ((event.key === "Delete" || event.key === "ArrowRight") && besideRight) {
      event.preventDefault();
      activateChip(besideRight.dataset.unitId ?? "", "param");
    }
  };

  // Copy writes the selection as the merchant sees it: text, and each unit
  // as "Sync status is Synced"; with nothing selected, the whole field
  //. The admin writes its query syntax, which its search reads
  // back; ours has none, so the words are what is useful.
  const selectionText = () => {
    const el = editableRef.current;
    if (!el) return "";
    const selection = document.getSelection();
    // Only a selection in the field counts; anything else copies the whole field.
    const range =
      selection &&
      selection.rangeCount > 0 &&
      !selection.isCollapsed &&
      el.contains(selection.getRangeAt(0).commonAncestorContainer)
        ? selection.getRangeAt(0)
        : null;
    const nodes = range ? [...range.cloneContents().childNodes] : [...el.childNodes];
    const parts: string[] = [];
    for (const node of nodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = (node.textContent ?? "").trim();
        if (text) parts.push(text);
      } else if (node instanceof HTMLElement && node.dataset.unitId) {
        const unit = unitsRef.current.get(node.dataset.unitId);
        const field = unit && fieldOf(unit.field);
        if (unit && field) {
          parts.push(
            unitText(field, unit, labels.more, {
              remove: labels.removeFilter,
              starting: labels.starting,
              ending: labels.ending,
            }),
          );
        }
      }
    }
    return parts.join(" ");
  };

  const onCopy = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.clipboardData.setData("text/plain", selectionText());
  };

  // Cut copies, then removes the selection and commits what is left.
  const onCut = (event: React.ClipboardEvent<HTMLDivElement>) => {
    onCopy(event);
    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return;
    selection.getRangeAt(0).deleteContents();
    emitText();
  };

  // Paste is plain text on one line: newlines to spaces, trimmed.
  const onPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const text = event.clipboardData
      .getData("text/plain")
      .replace(/\s*[\r\n]+\s*/g, " ")
      .trim();
    if (text) document.execCommand("insertText", false, text);
  };

  const clear = () => {
    const el = editableRef.current;
    if (!el) return;
    el.replaceChildren();
    unitsRef.current.clear();
    typedRef.current = null;
    setUnitsVersion((v) => v + 1);
    onChange("");
    commitFilters();
    el.focus();
    placeCaret(el);
    lastCaretRef.current = null;
    if (!syncCaret()) activate({ kind: "editor" });
    measureOverflow();
  };

  // The "+" (the admin's showAddFilterButton): focused, with free text or a
  // finished filter, on the field list or on a chip that has values.
  const activeUnit = active?.kind === "chip" ? unitsRef.current.get(active.unitId) : undefined;
  // Free text counts only while the field list is up, as in the admin.
  const hasText = active?.kind === "editor" && value.trim() !== "";
  const hasFinished = orderedUnits().some((unit) => unit.values.length > 0);
  // On a number chip it shows whatever the field holds (the admin's _i).
  const numberActive = isTyped(activeUnit);
  const showAdd =
    focusedRef.current &&
    !!active &&
    fields.length > 0 &&
    !suppressAdd &&
    (numberActive ||
      ((hasText || hasFinished) &&
        (active.kind === "editor" || (activeUnit?.values.length ?? 0) > 0)));

  // Clicking it goes to the end of the field with the field list open.
  const onAddClick = () => {
    const el = editableRef.current;
    if (!el || !removeAddButton(el)) return;
    suppressAddNow();
    setDismissed(false);
    el.focus();
    requestAnimationFrame(() => {
      placeCaret(el);
      lastCaretRef.current = null;
      syncCaret();
    });
  };
  const onAddClickRef = useRef(onAddClick);
  onAddClickRef.current = onAddClick;

  useLayoutEffect(() => {
    const el = editableRef.current;
    if (!el) return;
    const existing = findAddButton(el);
    if (!showAdd) existing?.remove();
    else if (!existing) {
      appendAddButton(el, { label: labels.addFilter, onClick: () => onAddClickRef.current() });
    }
  }, [showAdd, labels.addFilter]);

  /**
   * A day picked: ignored when it is already the group's
   * date; else the group's parts take it and it applies at once. In
   * Starting, focus moves to the Ending year; otherwise the caret goes after
   * the unit and the field list opens.
   */
  const onCalendarPick = (date: string) => {
    const el = editableRef.current;
    if (!el || !calendar || date === calendar.value) return;
    const span = spanOf(calendar.unitId);
    const group = span?.querySelector<HTMLElement>(`[data-group="${calendar.group}"]`);
    if (!span || !group) return;
    const [y = "", m = "", d = ""] = date.split("-");
    groupParts(group).forEach((part, index) => {
      part.textContent = [y, m, d][index] ?? "";
    });
    const isStarting = calendar.group === 0 && !!span.querySelector("[data-group='1']");
    applyNumber(calendar.unitId);
    if (isStarting) {
      focusInput(calendar.unitId, 3, "all");
      return;
    }
    const unitId = calendar.unitId;
    internalFocusRef.current = true;
    el.focus({ preventScroll: true });
    internalFocusRef.current = false;
    setCalendar(null);
    leaveUnit(unitId, "after");
  };
  const calendarOpen =
    focusedRef.current &&
    !!calendar &&
    active?.kind === "chip" &&
    active.unitId === calendar.unitId &&
    active.input !== undefined;

  const hasContent = value !== "" || filters.length > 0 || unitsRef.current.size > 0;
  const onPickerHover = (index: number) => {
    const row = rows[index];
    if (row) setHighlight({ id: row.id });
  };
  const activeRow =
    pickerOpen && activeIndex >= 0 ? pickerRowId(PICKER_ID, activeIndex) : undefined;

  return (
    <div
      ref={barRef}
      className={styles.bar}
      data-parity="search-bar"
      data-pointer-focus={pointerFocus || undefined}
      // Capture: before the field's own handler focuses it.
      onPointerDownCapture={() => {
        setPointerFocus(true);
        pointerDownAtRef.current = performance.now();
      }}
    >
      <span className={styles.icon} data-parity="search-icon">
        <s-icon type="search" color="subdued"></s-icon>
      </span>
      <div className={styles.input}>
        <div
          className={styles.wrapper}
          data-overflow-left={overflow.left}
          data-overflow-right={overflow.right}
        >
          <div
            ref={editableRef}
            className={styles.editable}
            data-parity="search-editable"
            role="combobox"
            aria-label={labels.placeholder}
            aria-expanded={pickerOpen}
            aria-controls={pickerOpen ? pickerIds.join(" ") : undefined}
            aria-describedby={HELP_ID}
            aria-autocomplete="list"
            aria-activedescendant={activeRow}
            tabIndex={0}
            contentEditable
            suppressContentEditableWarning
            data-placeholder={labels.placeholder}
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            onInput={emitText}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            onCopy={onCopy}
            onCut={onCut}
            onScroll={measureOverflow}
            onFocus={onFocus}
            onBlur={onBlur}
            onPointerDown={onPointerDown}
            onClick={onClick}
          />
        </div>
        <span id={HELP_ID} className={styles.visuallyHidden}>
          {labels.a11y.help}
        </span>
        <span className={styles.visuallyHidden} aria-live="polite" data-parity="announcer">
          {announcement}
        </span>
        {hasContent && (
          <span className={styles.clear} data-parity="search-clear-wrap">
            <button
              type="button"
              className={styles.clearButton}
              data-parity="search-clear"
              aria-label={labels.clear}
              // Keep the field focused: the button only shows while it is.
              onPointerDown={(event) => event.preventDefault()}
              onClick={clear}
            >
              <s-icon type="x-circle" color="subdued"></s-icon>
            </button>
          </span>
        )}
      </div>
      {calendarOpen && calendar && (
        <DateCalendar anchor={anchor} value={calendar.value} onPick={onCalendarPick} />
      )}
      {pickerOpen && (
        <Picker
          id={PICKER_ID}
          label={pickerNames.main}
          sectionLabels={pickerNames.sections}
          multiselectable={pickerNames.multiselectable}
          rows={rows}
          activeIndex={activeIndex}
          anchor={anchor}
          enterLabel={labels.enter}
          onActiveChange={onPickerHover}
          onPick={pick}
          onEndReached={onValuesEnd}
          loadingLabel={labels.a11y.loading}
        />
      )}
    </div>
  );
};

// The unit across a gap from the caret: touching it, or with only spaces
// between, so the first Backspace opens it rather than deleting the space.
const gapUnit = (root: HTMLElement, side: "left" | "right") => {
  const touching = unitBesideCaret(root, side);
  if (touching) return touching;
  const selection = document.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return null;
  const { startContainer, startOffset } = selection.getRangeAt(0);
  const blank = (text: string) => text.replace(/[\s\u00a0]/g, "") === "";
  let neighbour: Node | null;
  if (startContainer === root) {
    // At the field's level, look through a space-only node.
    const near = root.childNodes[side === "left" ? startOffset - 1 : startOffset] ?? null;
    if (near?.nodeType !== Node.TEXT_NODE || !blank(near.textContent ?? "")) return null;
    neighbour = side === "left" ? near.previousSibling : near.nextSibling;
  } else {
    if (startContainer.parentNode !== root || startContainer.nodeType !== Node.TEXT_NODE)
      return null;
    const text = startContainer.textContent ?? "";
    if (!blank(side === "left" ? text.slice(0, startOffset) : text.slice(startOffset))) return null;
    neighbour = side === "left" ? startContainer.previousSibling : startContainer.nextSibling;
  }
  return isUnitSpan(neighbour) ? neighbour : null;
};

// The caret's position in the field, or null when it has none there.
const caretRect = (el: HTMLElement) => {
  const selection = document.getSelection();
  const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  if (!range || !el.contains(range.startContainer)) return null;
  const rect = range.getBoundingClientRect();
  if (rect.left > 0 || rect.width > 0) return { left: rect.left };
  // A caret between elements has no box: measure the field up to it.
  const probe = document.createRange();
  probe.setStart(el, 0);
  probe.setEnd(range.startContainer, range.startOffset);
  const box = probe.getBoundingClientRect();
  return box.width > 0 ? { left: box.right } : null;
};
