import {
  IndexCard,
  IndexFilterBar,
  mergeLabels,
  SortableHeader,
  useIndexFilters,
} from "@ljsstudios/index-filter-bar";
import { useMemo } from "react";
import { DebugPanel } from "../DebugPanel";
import { DemoPage } from "../DemoPage";
import { applyFilters, sortRows } from "../lib/applyFilters";
import { ORDERS, type Order } from "../lib/data";

const DAY = 24 * 60 * 60 * 1000;

// Each customer's orders, for working out who is in a segment.
const BY_CUSTOMER = new Map<string, Order[]>();
for (const order of ORDERS) {
  BY_CUSTOMER.set(order.customer, [...(BY_CUSTOMER.get(order.customer) ?? []), order]);
}
const CUSTOMERS = [...BY_CUSTOMER.values()];

interface Segment {
  id: string;
  name: string;
  /** Share of the customers in it, 0 to 100. */
  percent: number;
  createdBy: string;
  /** "Created" or "Edited", with when. */
  activity: "Created" | "Edited";
  lastActivity: Date;
}

const segment = (
  id: string,
  name: string,
  inIt: (orders: Order[]) => boolean,
  createdBy: string,
  activity: Segment["activity"],
  daysAgo: number,
): Segment => ({
  id,
  name,
  percent: Math.round((CUSTOMERS.filter(inIt).length / CUSTOMERS.length) * 100),
  createdBy,
  activity,
  lastActivity: new Date(Date.now() - daysAgo * DAY),
});

const since = (orders: Order[], days: number) =>
  orders.some((order) => order.createdAt.getTime() > Date.now() - days * DAY);

// The admin's starting segments, then a few a merchant might make.
const SEGMENTS: Segment[] = [
  segment(
    "1",
    "Customers who have purchased at least once",
    (o) => o.length > 0,
    "Shopify",
    "Created",
    24,
  ),
  segment(
    "2",
    "Customers who have purchased more than once",
    (o) => o.length > 1,
    "Shopify",
    "Created",
    24,
  ),
  segment(
    "3",
    "Customers who ordered in the last 30 days",
    (o) => since(o, 30),
    "Shopify",
    "Created",
    24,
  ),
  segment(
    "4",
    "Spent over $200",
    (o) => o.reduce((sum, order) => sum + order.total, 0) > 200,
    "Staff",
    "Edited",
    3,
  ),
  segment(
    "5",
    "Used a discount code",
    (o) => o.some((order) => order.discountCode !== ""),
    "Staff",
    "Created",
    9,
  ),
  segment(
    "6",
    "Shop floor and pop-up buyers",
    (o) => o.some((order) => order.channel === "Point of Sale"),
    "Staff",
    "Edited",
    1,
  ),
  segment(
    "7",
    "Express delivery customers",
    (o) => o.some((order) => order.deliveryMethod === "Express"),
    "Staff",
    "Created",
    16,
  ),
  segment(
    "8",
    "Orders over 10 lb",
    (o) => o.some((order) => order.weightLb > 10),
    "Staff",
    "Created",
    40,
  ),
];

// The admin's Segments sorts by last activity alone.
const SORTS = [
  {
    field: "lastActivity",
    label: "Last activity",
    ascLabel: "Oldest first",
    descLabel: "Newest first",
  },
];
const SORT_VALUES = { lastActivity: (s: Segment) => s.lastActivity };

const LABELS = mergeLabels({ search: { placeholder: "Search segments" } });

const formatDate = (date: Date) =>
  date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/**
 * Segments, as the admin's Customers → Segments: a search without filters,
 * a sort button without columns, and no saved views.
 */
export const Segments = ({
  debug,
  onDebugChange,
}: {
  debug: boolean;
  onDebugChange: (debug: boolean) => void;
}) => {
  const bar = useIndexFilters({
    id: "segments",
    sortOptions: SORTS,
    defaultSort: "lastActivity desc",
    savedViews: false,
    labels: LABELS,
  });

  const rows = useMemo(
    () =>
      sortRows(
        applyFilters(SEGMENTS, {
          query: bar.query,
          filters: [],
          fields: [],
          accessors: {},
          searchIn: (s) => s.name,
        }),
        bar.sort,
        SORT_VALUES,
      ),
    [bar.query, bar.sort],
  );

  return (
    <DemoPage title="Segments" debug={debug} onDebugChange={onDebugChange}>
      <s-stack gap="small-100">
        <IndexFilterBar {...bar.props} />
        {rows.length === 0 ? (
          <IndexCard>
            <s-box padding="large-300">
              <s-stack gap="base" alignItems="center">
                <s-heading>No segments found</s-heading>
                <s-paragraph>Try changing the search term.</s-paragraph>
                <s-button variant="primary" onClick={bar.clear}>
                  Clear search
                </s-button>
              </s-stack>
            </s-box>
          </IndexCard>
        ) : (
          <s-table loading={bar.pending || undefined}>
            <s-table-header-row>
              <s-table-header listSlot="primary">Name</s-table-header>
              <s-table-header listSlot="labeled" format="numeric">
                % of customers
              </s-table-header>
              <s-table-header listSlot="labeled">
                <SortableHeader
                  field="lastActivity"
                  label="Last activity"
                  sortSelected={[bar.sort]}
                  onSort={([next]) => next && bar.setSort(next)}
                  sortType="date"
                />
              </s-table-header>
              <s-table-header listSlot="labeled">Created by</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {rows.map((s) => (
                <s-table-row key={s.id}>
                  <s-table-cell>{s.name}</s-table-cell>
                  <s-table-cell>{`${s.percent}%`}</s-table-cell>
                  <s-table-cell>{`${s.activity} on ${formatDate(s.lastActivity)}`}</s-table-cell>
                  <s-table-cell>{s.createdBy}</s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
        {debug && <DebugPanel bar={bar} rows={rows.length} />}
      </s-stack>
    </DemoPage>
  );
};
