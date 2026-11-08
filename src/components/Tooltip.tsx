import {
  type ReactElement,
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import styles from "./Tooltip.module.css";

/**
 * The least room kept between the tooltip and the frame's edge. The admin's
 * keeps 16px from its window, whose content area ends 4px in, so inside the
 * app's frame that is 12px (measured on Products, the eye's tooltip).
 */
const EDGE = 12;

interface TooltipProps {
  content: string;
  /** The one element the tooltip labels; it keeps its own aria-label. */
  children: ReactElement;
}

/**
 * The admin's dark tooltip (s-internal-tooltip), centred 4px above its
 * trigger. Not `s-tooltip`: inside an app Polaris renders tooltips white.
 * Rendered in a portal at fixed coordinates so a clipping parent (the
 * Reset / Save slide-in) cannot cut it off, and moved along to stay inside
 * the window, as the admin's does by the bar's end. Decorative: the trigger
 * carries the same words as its accessible name.
 */
export const Tooltip = ({ content, children }: TooltipProps) => {
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  // Centred on the trigger, then nudged in from either edge of the window.
  useLayoutEffect(() => {
    const tooltip = tooltipRef.current;
    if (!position || !tooltip) return;
    const width = tooltip.offsetWidth;
    const room = document.documentElement.clientWidth;
    const left = Math.max(EDGE, Math.min(position.left - width / 2, room - EDGE - width));
    tooltip.style.left = `${Math.round(left)}px`;
  }, [position]);

  const show = useCallback(() => {
    const trigger = wrapperRef.current?.firstElementChild;
    if (!trigger) return;
    const box = trigger.getBoundingClientRect();
    setPosition({ left: box.left + box.width / 2, top: box.top - 4 });
  }, []);
  const hide = useCallback(() => setPosition(null), []);

  return (
    <span
      ref={wrapperRef}
      className={styles.wrapper}
      onPointerEnter={show}
      onPointerLeave={hide}
      onFocus={show}
      onBlur={hide}
      onPointerDown={hide}
    >
      {children}
      {position &&
        createPortal(
          <div
            ref={tooltipRef}
            className={styles.tooltip}
            style={{ left: position.left, top: position.top }}
            data-parity="tooltip"
            aria-hidden="true"
          >
            {content as ReactNode}
          </div>,
          document.body,
        )}
    </span>
  );
};
