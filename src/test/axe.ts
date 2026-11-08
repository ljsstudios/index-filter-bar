import axe from "axe-core";

/**
 * Runs axe (WCAG 2.0-2.2 A and AA, plus best practice) over a rendered
 * element and returns the violations as readable lines, so a test can
 * `expect(await axeViolations(container)).toEqual([])` and see what failed.
 *
 * Colour contrast and target size need real layout, which happy-dom doesn't
 * have; they are checked live in Chrome.
 */
export const axeViolations = async (element: Element): Promise<string[]> => {
  const result = await axe.run(element, {
    runOnly: {
      type: "tag",
      values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"],
    },
    rules: {
      "color-contrast": { enabled: false },
      "target-size": { enabled: false },
      // A component on its own has no page around it.
      region: { enabled: false },
      "page-has-heading-one": { enabled: false },
      "landmark-one-main": { enabled: false },
    },
  });
  return result.violations.flatMap((violation) =>
    violation.nodes.map((node) => `${violation.id}: ${node.target.join(" ")}`),
  );
};
