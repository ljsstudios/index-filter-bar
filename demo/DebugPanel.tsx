import type { useIndexFilters } from "@ljsstudios/index-filter-bar";
import { useEffect, useState } from "react";

/**
 * What the page reads from the bar right now, as the page's own code would
 * see it: switch it on from the demo's header.
 */
export const DebugPanel = ({
  bar,
  rows,
}: {
  bar: ReturnType<typeof useIndexFilters>;
  rows: number;
}) => {
  // The bar writes the URL in its own effect, after this one: read it a tick later.
  const [url, setUrl] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setUrl(window.location.search));
    return () => clearTimeout(timer);
  });
  return (
    <s-section heading="Debug: the bar's state">
      <pre
        style={{
          margin: 0,
          fontSize: 12,
          lineHeight: "18px",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {JSON.stringify(
          {
            query: bar.query,
            pending: bar.pending,
            filters: bar.filters,
            sort: bar.sort,
            visibleColumns: bar.visibleColumns,
            view: bar.view,
            hasFilters: bar.hasFilters,
            url,
            rows,
          },
          null,
          2,
        )}
      </pre>
    </s-section>
  );
};
