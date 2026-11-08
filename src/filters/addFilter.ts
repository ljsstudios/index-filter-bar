import styles from "./AddFilter.module.css";

/**
 * The admin's add-filter "+": a non-editable span at the end of the field holding a 20px
 * button, with a white "Add new filter" tooltip on a tail after 400ms of
 * hover. Built outside React like the units, since it lives among them in
 * the contenteditable.
 */

const NBSP = " ";
const SVG = "http://www.w3.org/2000/svg";
const TOOLTIP_DELAY = 400;

export const findAddButton = (root: HTMLElement) =>
  root.querySelector<HTMLSpanElement>(":scope > [data-type='add-filter-button']");

/** Takes the "+" out, leaving a space where it stood. */
export const removeAddButton = (root: HTMLElement) => {
  const span = findAddButton(root);
  if (!span) return false;
  const previous = span.previousSibling;
  if (!(previous?.nodeType === Node.TEXT_NODE && /[\s ]/.test(previous.textContent ?? ""))) {
    span.before(document.createTextNode(NBSP));
  }
  span.remove();
  return true;
};

const svg = (attributes: Record<string, string>, paths: Array<Record<string, string>>) => {
  const el = document.createElementNS(SVG, "svg");
  for (const [name, value] of Object.entries(attributes)) el.setAttribute(name, value);
  for (const path of paths) {
    const p = document.createElementNS(SVG, "path");
    for (const [name, value] of Object.entries(path)) p.setAttribute(name, value);
    el.append(p);
  }
  return el;
};

/** Puts the "+" at the end of the field, after a space; returns it. */
export const appendAddButton = (
  root: HTMLElement,
  { label, onClick }: { label: string; onClick: () => void },
) => {
  // At the end already, the field scrolls to keep it in view.
  const atEnd = root.scrollWidth <= root.clientWidth + root.scrollLeft + 28;
  const last = root.lastChild;
  if (!(last?.nodeType === Node.TEXT_NODE && /[\s ]$/.test(last.textContent ?? ""))) {
    root.append(document.createTextNode(NBSP));
  }

  const span = document.createElement("span");
  span.dataset.type = "add-filter-button";
  span.contentEditable = "false";
  const button = document.createElement("button");
  button.type = "button";
  button.tabIndex = -1;
  button.className = styles.button ?? "";
  button.dataset.parity = "add-filter";
  button.setAttribute("aria-label", label);
  button.append(
    svg(
      {
        viewBox: "0 0 16 16",
        width: "16",
        height: "16",
        fill: "currentColor",
        "aria-hidden": "true",
      },
      [
        {
          d: "M4.25 8a.75.75 0 0 1 .75-.75h2.25v-2.25a.75.75 0 0 1 1.5 0v2.25h2.25a.75.75 0 0 1 0 1.5h-2.25v2.25a.75.75 0 0 1-1.5 0v-2.25h-2.25a.75.75 0 0 1-.75-.75",
        },
        {
          "fill-rule": "evenodd",
          d: "M8 15a7 7 0 1 0 0-14 7 7 0 0 0 0 14m0-1.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 1 0 0 11",
        },
      ],
    ),
  );

  let tooltip: HTMLDivElement | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let observer: MutationObserver | null = null;
  const hide = () => {
    clearTimeout(timer);
    timer = undefined;
    observer?.disconnect();
    observer = null;
    if (!tooltip) return;
    tooltip.remove();
    tooltip = null;
    window.removeEventListener("scroll", hide, { capture: true });
    window.removeEventListener("resize", hide);
  };
  const show = () => {
    if (tooltip || !button.isConnected) return;
    tooltip = document.createElement("div");
    tooltip.className = styles.tooltip ?? "";
    tooltip.dataset.parity = "add-filter-tooltip";
    tooltip.setAttribute("role", "tooltip");
    tooltip.textContent = label;
    tooltip.append(
      svg(
        {
          class: styles.tail ?? "",
          width: "19",
          height: "11",
          fill: "none",
          "aria-hidden": "true",
        },
        [
          {
            d: "m0 2 6.967 7.25a3 3 0 0 0 4.243.083L18.829 2h-1.442l-6.87 6.612a2 2 0 0 1-2.83-.055L1.387 2H0Z",
            fill: "#d4d4d4",
          },
          {
            d: "M1.387 0h16v2l-6.87 6.612a2 2 0 0 1-2.83-.055L1.387 2V0Z",
            fill: "#ffffff",
          },
        ],
      ),
    );
    const rect = button.getBoundingClientRect();
    tooltip.style.left = `${rect.left + rect.width / 2}px`;
    tooltip.style.top = `${rect.top - 10}px`;
    document.body.append(tooltip);
    window.addEventListener("scroll", hide, { capture: true });
    window.addEventListener("resize", hide);
  };

  button.addEventListener("mouseenter", () => {
    // The tooltip goes with the button if the field drops it.
    if (!observer && span.parentNode) {
      observer = new MutationObserver(() => {
        if (!span.isConnected) hide();
      });
      observer.observe(span.parentNode, { childList: true });
    }
    clearTimeout(timer);
    timer = setTimeout(show, TOOLTIP_DELAY);
  });
  button.addEventListener("mouseleave", hide);
  // The field keeps focus and its caret.
  button.addEventListener("mousedown", (event) => event.preventDefault());
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    hide();
    onClick();
  });

  span.append(button);
  root.append(span);
  if (atEnd) root.scrollLeft = root.scrollWidth;
  return span;
};
