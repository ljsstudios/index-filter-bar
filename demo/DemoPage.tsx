import type { ReactNode } from "react";

/** Where the demo is served from: "/" locally, the repo's path on GitHub Pages. */
export const BASE = import.meta.env.BASE_URL;

// fontSize is App Home v1.1's; @shopify/polaris-types 2.0.0 doesn't list it yet.
const SMALL = { fontSize: "small" } as object;

export const Footer = () => (
  <s-text color="subdued" {...SMALL}>
    Products come from{" "}
    <s-link href="https://mock.shop" target="_blank">
      mock.shop
    </s-link>
    , Shopify's free sample Storefront API. Statuses, dates, stock and orders are generated from
    them. Not affiliated with Shopify.
  </s-text>
);

/**
 * A demo index page: its heading with a link back to the demos, the debug
 * switch (and any page actions) in the sticky header, then the page.
 */
export const DemoPage = ({
  title,
  debug,
  onDebugChange,
  actions,
  children,
}: {
  title: string;
  debug: boolean;
  onDebugChange: (debug: boolean) => void;
  /** More header actions, before Debug: slot them "secondary-actions". */
  actions?: ReactNode;
  children: ReactNode;
}) => (
  <s-page heading={title} inlineSize="large">
    <s-link slot="breadcrumb-actions" href={BASE}>
      Demos
    </s-link>
    {actions}
    <s-button slot="secondary-actions" onClick={() => onDebugChange(!debug)}>
      {debug ? "Hide debug" : "Show debug"}
    </s-button>
    <s-stack gap="base">
      {children}
      <Footer />
    </s-stack>
  </s-page>
);
