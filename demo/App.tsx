import { useEffect, useState } from "react";
import { BASE, Footer } from "./DemoPage";
import { Inventory } from "./pages/Inventory";
import { Orders } from "./pages/Orders";
import { Products } from "./pages/Products";

const PAGES = [
  {
    route: "products",
    title: "Products",
    about: "List filters, saved views, columns and sort, like the admin's Products.",
    icon: "product",
  },
  {
    route: "inventory",
    title: "Inventory",
    about: "Number and text filters, like the admin's Inventory.",
    icon: "inventory",
  },
  {
    route: "orders",
    title: "Orders",
    about: "Date, currency, weight, text and read-only filters, like the admin's Orders.",
    icon: "order",
  },
] as const;

const readDebug = () => {
  try {
    return localStorage.getItem("demo-debug") === "true";
  } catch {
    return false;
  }
};

/**
 * The demo: a welcome page, then Shopify-admin-style index pages built with
 * the bar on sample data, each at its own path (/products, /inventory,
 * /orders). Links between them load the page afresh, so each starts clean.
 */
export const App = () => {
  const route = window.location.pathname.slice(BASE.length).replace(/\/$/, "");
  const page = PAGES.find((p) => p.route === route);
  useEffect(() => {
    document.title = page ? `${page.title} · Search & Filters Bar` : "Search & Filters Bar";
  }, [page]);
  const [debug, setDebug] = useState(readDebug);
  useEffect(() => {
    try {
      localStorage.setItem("demo-debug", String(debug));
    } catch {
      // The toggle still works for the visit.
    }
  }, [debug]);

  if (!page) {
    return (
      <s-page heading="Search & Filters Bar" inlineSize="small">
        <s-stack gap="base">
          <s-stack gap="small-200">
            <s-paragraph color="subdued">
              The Shopify admin's index search and filter bar, for embedded apps built with React
              and Polaris 2.0 web components: every filter type, saved views, columns and sort.
            </s-paragraph>
          </s-stack>
          <s-section padding="none">
            {/* Rows sit flush in the card, dividers edge to edge (Bridgeful's
                settings rows). One wrapper so the dividers aren't direct section
                children: s-section adds a bottom margin to slotted dividers. */}
            <s-box>
              {PAGES.map((p, i) => (
                <div key={p.route}>
                  {i > 0 && <s-divider></s-divider>}
                  <s-clickable
                    padding="small-100"
                    href={`${BASE}${p.route}`}
                    accessibilityLabel={p.title}
                  >
                    <s-grid gridTemplateColumns="auto 1fr auto" alignItems="center" gap="base">
                      <s-icon type={p.icon}></s-icon>
                      <s-box>
                        <s-text type="strong">{p.title}</s-text>
                        <s-paragraph color="subdued">{p.about}</s-paragraph>
                      </s-box>
                      <s-icon type="chevron-right"></s-icon>
                    </s-grid>
                  </s-clickable>
                </div>
              ))}
            </s-box>
          </s-section>
          <Footer />
        </s-stack>
      </s-page>
    );
  }

  const Page = { products: Products, inventory: Inventory, orders: Orders }[page.route];
  return <Page debug={debug} onDebugChange={setDebug} />;
};
