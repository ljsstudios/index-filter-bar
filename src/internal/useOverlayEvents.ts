import { useCallback, useRef } from "react";

type OverlayEventHandler = (event: Event) => void;

interface OverlayEventHandlers {
  onShow?: OverlayEventHandler;
  onHide?: OverlayEventHandler;
}

/**
 * Show and hide listeners for an `s-popover` or `s-modal`, attached through a
 * callback ref rather than `onShow`/`onHide` props.
 *
 * An `on*` prop makes Polaris register one shared listener that looks the
 * handler up on the element's React props when the event fires. React drops
 * those props as the element unmounts but the listener stays, so a late
 * `hide` after a navigation throws on the detached node. These listeners go
 * with the element, and the latest handlers live in a ref so they are
 * registered once per mount and never go stale.
 */
export const useOverlayEvents = (handlers: OverlayEventHandlers) => {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  return useCallback((element: HTMLElement | null) => {
    if (!element) return;
    const onShow = (event: Event) => {
      if (event.target === element) handlersRef.current.onShow?.(event);
    };
    const onHide = (event: Event) => {
      if (event.target === element) handlersRef.current.onHide?.(event);
    };
    element.addEventListener("show", onShow);
    element.addEventListener("hide", onHide);
    return () => {
      element.removeEventListener("show", onShow);
      element.removeEventListener("hide", onHide);
    };
  }, []);
};
