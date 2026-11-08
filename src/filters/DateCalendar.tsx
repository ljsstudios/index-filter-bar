import { useEffect, useRef } from "react";
import styles from "./Picker.module.css";

interface DateCalendarProps {
  /** The popover's top-left corner, relative to the search field's bar. */
  anchor: { left: number; top: number };
  /** The focused group's date when it is a real one, read as the group took focus. */
  value?: string;
  onPick: (date: string) => void;
}

const yearMonth = (date: string) => date.slice(0, 7);

/**
 * The date unit's calendar: Polaris' own date picker, one month, single selection (a range
 * picks each end in turn), in a box 280 wide with 8px around it. Presses in
 * it never take focus from the date part (30): caught on the way down, since
 * the picker's own buttons stop the press before it bubbles back up.
 */
export const DateCalendar = ({ anchor, value, onPick }: DateCalendarProps) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const keepFocus = (event: Event) => event.preventDefault();
    el.addEventListener("mousedown", keepFocus, { capture: true });
    return () => el.removeEventListener("mousedown", keepFocus, { capture: true });
  }, []);
  return (
    <div
      ref={ref}
      className={styles.popover}
      style={{ left: anchor.left, top: anchor.top }}
      data-parity="date-calendar"
    >
      <div style={{ padding: 8, width: 280, boxSizing: "border-box" }}>
        <s-date-picker
          type="single"
          value={value || undefined}
          defaultView={value ? yearMonth(value) : undefined}
          onChange={(event: Event & { currentTarget: { value?: string } }) => {
            const picked = event.currentTarget.value ?? "";
            if (picked) onPick(picked);
          }}
        />
      </div>
    </div>
  );
};
