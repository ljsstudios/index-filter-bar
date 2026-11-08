import {
  type FilterField,
  type FilterValue,
  IndexCard,
  IndexFilterBar,
  localStorageViews,
  type SavedView,
  SortableHeader,
  useIndexFilters,
} from "@ljsstudios/index-filter-bar";
import { useCallback, useMemo, useRef, useState } from "react";
import { DebugPanel } from "../DebugPanel";
import { DemoPage } from "../DemoPage";
import { applyFilters, sortRows } from "../lib/applyFilters";
import { ORDERS, type Order, PRODUCTS, VARIANTS, variantName } from "../lib/data";
import {
  currencyField,
  dateField,
  FULFILL_BY_DATES,
  listField,
  measurementField,
  numberField,
  PAST_DATES,
  textField,
} from "../lib/fields";

const PAGE_SIZE = 50;
const yesNo = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];
const each = <K extends keyof Order>(key: K) => ORDERS.map((o) => String(o[key])).filter(Boolean);

/**
 * The Product filter's values come from a "server", 25 at a time and searched
 * there, as the admin's long lists do: fetchMoreValues and hasNextPage.
 */
const useProductChoices = () => {
  const [state, setState] = useState<{ values: FilterValue[]; search: string; more: boolean }>({
    values: [],
    search: "",
    more: true,
  });
  const stateRef = useRef(state);
  stateRef.current = state;
  const fetchMoreValues = useCallback(async (search: string) => {
    // A slow network, so the loading row shows.
    await new Promise((resolve) => setTimeout(resolve, 500));
    const previous = stateRef.current;
    const fresh = search !== previous.search;
    const matches = PRODUCTS.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()));
    const from = fresh ? 0 : previous.values.length;
    const page = matches.slice(from, from + 25).map((p) => ({ value: p.id, label: p.title }));
    setState({
      values: fresh ? page : [...previous.values, ...page],
      search,
      more: from + 25 < matches.length,
    });
  }, []);
  return { values: state.values, hasNextPage: state.more, fetchMoreValues };
};

// Orders' columns, as the admin's: Order always first, four hidden.
const COLUMNS = [
  { key: "date", label: "Date" },
  { key: "customer", label: "Customer" },
  { key: "fulfillBy", label: "Fulfill by" },
  { key: "channel", label: "Channel" },
  { key: "total", label: "Total" },
  { key: "paymentStatus", label: "Payment status" },
  { key: "fulfillmentStatus", label: "Fulfillment status" },
  { key: "items", label: "Items" },
  { key: "deliveryStatus", label: "Delivery status" },
  { key: "deliveryMethod", label: "Delivery method" },
  { key: "tags", label: "Tags" },
  { key: "destination", label: "Destination", hidden: true },
  { key: "returnStatus", label: "Return status", hidden: true },
  { key: "poNumber", label: "PO number", hidden: true },
  { key: "labelStatus", label: "Label status", hidden: true },
];

const az = { ascLabel: "A-Z", descLabel: "Z-A" };
const lowHigh = { ascLabel: "Lowest to highest", descLabel: "Highest to lowest" };
const oldNew = { ascLabel: "Oldest first", descLabel: "Newest first" };
const SORTS = [
  { field: "order", label: "Order", ...lowHigh },
  { field: "date", label: "Date", ...oldNew },
  { field: "customer", label: "Customer", ...az },
  { field: "channel", label: "Channel", ...az },
  { field: "total", label: "Total", ...lowHigh },
  { field: "fulfillmentStatus", label: "Fulfillment status", ...az },
  { field: "paymentStatus", label: "Payment status", ...az },
  { field: "items", label: "Items", ...lowHigh },
  { field: "destination", label: "Destination", ...az },
  { field: "poNumber", label: "PO number", ...az },
  { field: "fulfillBy", label: "Fulfill by", ...oldNew },
  { field: "labelStatus", label: "Label status", ...az },
];
const SORT_VALUES = {
  order: (o: Order) => Number(o.id),
  date: (o: Order) => o.createdAt,
  customer: (o: Order) => o.customer,
  channel: (o: Order) => o.channel,
  total: (o: Order) => o.total,
  fulfillmentStatus: (o: Order) => o.fulfillmentStatus,
  paymentStatus: (o: Order) => o.paymentStatus,
  items: (o: Order) => o.items,
  destination: (o: Order) => o.destination,
  poNumber: (o: Order) => o.poNumber,
  fulfillBy: (o: Order) => o.fulfillBy,
  labelStatus: (o: Order) => o.labelStatus,
};

const accessors = {
  orderStatus: (o: Order) => o.orderStatus,
  paymentStatus: (o: Order) => o.paymentStatus,
  fulfillmentStatus: (o: Order) => o.fulfillmentStatus,
  deliveryStatus: (o: Order) => o.deliveryStatus,
  returnStatus: (o: Order) => o.returnStatus,
  labelStatus: (o: Order) => o.labelStatus,
  chargebackStatus: (o: Order) => o.chargebackStatus,
  total: (o: Order) => o.total,
  deliveryMethod: (o: Order) => o.deliveryMethod,
  destination: (o: Order) => o.destination,
  addressValidation: (o: Order) => o.addressValidation,
  items: (o: Order) => o.items,
  weight: (o: Order) => o.weightLb,
  product: (o: Order) => o.lines.map((line) => line.productId),
  discountCode: (o: Order) => o.discountCode,
  app: (o: Order) => o.app,
  channel: (o: Order) => o.channel,
  b2b: (o: Order) => (o.b2b ? "yes" : "no"),
  payoutActionRequired: (o: Order) => (o.payoutActionRequired ? "yes" : "no"),
  fraudRisk: (o: Order) => o.fraudRisk,
  customerRequest: (o: Order) => o.customerRequest,
  cardLast4: (o: Order) => o.cardLast4,
  shopifyProtect: (o: Order) => o.shopifyProtect,
  tag: (o: Order) => o.tags,
  date: (o: Order) => o.createdAt,
  fulfillBy: (o: Order) => o.fulfillBy,
  variant: (o: Order) => o.lines.map((line) => line.variantId),
};

// The admin's own Orders views.
const DEFAULT_VIEWS: SavedView[] = [
  { title: "All", sort: "date desc", query: "", filters: [] },
  {
    title: "Unfulfilled",
    sort: "date desc",
    query: "",
    filters: [
      {
        field: "fulfillmentStatus",
        operator: "is",
        values: ["Unfulfilled", "Partially fulfilled"],
      },
      { field: "orderStatus", operator: "is", values: ["Open"] },
    ],
  },
  {
    title: "Unpaid",
    sort: "date desc",
    query: "",
    filters: [
      {
        field: "paymentStatus",
        operator: "is",
        values: ["Pending", "Authorized", "Partially paid"],
      },
    ],
  },
  {
    title: "Open",
    sort: "date desc",
    query: "",
    filters: [{ field: "orderStatus", operator: "is", values: ["Open"] }],
  },
  {
    title: "Archived",
    sort: "date desc",
    query: "",
    filters: [{ field: "orderStatus", operator: "is", values: ["Archived"] }],
  },
];

const PAYMENT_TONE: Record<string, "neutral" | "warning" | "caution" | undefined> = {
  Paid: "neutral",
  Refunded: "neutral",
  "Partially refunded": "neutral",
  Voided: "neutral",
  Pending: "warning",
  Authorized: "warning",
  "Partially paid": "warning",
};
const FULFILLMENT_TONE: Record<string, "neutral" | "warning" | "caution" | undefined> = {
  Fulfilled: "neutral",
  Unfulfilled: "caution",
  "Partially fulfilled": "warning",
  "On hold": "warning",
};

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const when = (date: Date) =>
  `${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })} at ${date
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .toLowerCase()}`;

export const Orders = ({
  debug,
  onDebugChange,
}: {
  debug: boolean;
  onDebugChange: (debug: boolean) => void;
}) => {
  const productChoices = useProductChoices();

  // Orders' filters, in the admin's order. Product's values come a page at a
  // time from the "server"; Product variant is read-only, set by a link from
  // Inventory, as Purchase orders' is in the admin.
  const fields = useMemo(
    (): FilterField[] => [
      {
        key: "variant",
        name: "Product variant",
        readOnly: true,
        multi: false,
        values: VARIANTS.map(({ product, variant }) => ({
          value: variant.id,
          label: variantName(product, variant),
        })),
        operators: [{ value: "is", label: "Is", chipLabel: "Product variant is" }],
      },
      listField("orderStatus", "Order status", ["Open", "Archived", "Cancelled"]),
      listField("paymentStatus", "Payment status", each("paymentStatus")),
      listField("fulfillmentStatus", "Fulfillment status", each("fulfillmentStatus")),
      listField("deliveryStatus", "Delivery status", each("deliveryStatus")),
      listField("returnStatus", "Return status", each("returnStatus")),
      listField("labelStatus", "Label status", each("labelStatus")),
      listField("chargebackStatus", "Chargeback and inquiry status", each("chargebackStatus")),
      currencyField("total", "Order total", "USD $"),
      listField("deliveryMethod", "Delivery method", each("deliveryMethod")),
      listField("destination", "Destination", each("destination")),
      listField("addressValidation", "Address validation", each("addressValidation")),
      numberField("items", "Number of items"),
      measurementField("weight", "Total product weight", "lb"),
      {
        ...listField("product", "Product", []),
        values: productChoices.values,
        hasNextPage: productChoices.hasNextPage,
        fetchMoreValues: productChoices.fetchMoreValues,
      },
      textField("discountCode", "Discount code"),
      listField("app", "App", each("app")),
      listField("channel", "Channel", each("channel")),
      listField("b2b", "B2B", yesNo, { single: true }),
      listField("payoutActionRequired", "Payout action required", yesNo, { single: true }),
      listField("fraudRisk", "Fraud risk", each("fraudRisk")),
      listField("customerRequest", "Customer request", each("customerRequest")),
      textField("cardLast4", "Credit card (last 4 digits)", { placeholder: "xxxx", maxLength: 4 }),
      listField("shopifyProtect", "Shopify Protect", each("shopifyProtect")),
      listField(
        "tag",
        "Tagged with",
        ORDERS.flatMap((o) => o.tags),
      ),
      dateField("date", "Date", PAST_DATES),
      dateField("fulfillBy", "Fulfill by", FULFILL_BY_DATES),
    ],
    [productChoices],
  );

  const [stored] = useState(() => localStorageViews("demo-orders-views", DEFAULT_VIEWS));
  const bar = useIndexFilters({
    id: "orders",
    fields,
    sortOptions: SORTS,
    defaultSort: "date desc",
    columns: COLUMNS,
    ...stored,
  });

  const rows = useMemo(
    () =>
      sortRows(
        applyFilters(ORDERS, {
          query: bar.query,
          filters: bar.filters,
          fields,
          accessors,
          searchIn: (o) =>
            [o.name, o.customer, o.discountCode, ...o.tags, ...o.lines.map((l) => l.title)].join(
              " ",
            ),
        }),
        bar.sort,
        SORT_VALUES,
      ),
    [bar.query, bar.filters, bar.sort, fields],
  );

  const [pageState, setPageState] = useState({ key: "", page: 0 });
  const listKey = JSON.stringify([bar.query, bar.filters, bar.sort]);
  const page = pageState.key === listKey ? pageState.page : 0;
  const setPage = (next: number) => setPageState({ key: listKey, page: next });
  const shown = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <DemoPage title="Orders" debug={debug} onDebugChange={onDebugChange}>
      <s-stack gap="small-100">
        <IndexFilterBar {...bar.props} />
        {rows.length === 0 ? (
          <IndexCard>
            <s-box padding="large-300">
              <s-stack gap="base" alignItems="center">
                <s-heading>No orders found</s-heading>
                <s-paragraph>Try changing the filters or search term for this view.</s-paragraph>
                {bar.hasFilters && (
                  <s-button variant="primary" onClick={bar.clear}>
                    Clear search and filters
                  </s-button>
                )}
              </s-stack>
            </s-box>
          </IndexCard>
        ) : (
          <s-table
            paginate
            loading={bar.pending || undefined}
            hasPreviousPage={page > 0 || undefined}
            hasNextPage={(page + 1) * PAGE_SIZE < rows.length || undefined}
            onPreviousPage={() => setPage(page - 1)}
            onNextPage={() => setPage(page + 1)}
          >
            <s-table-header-row>
              <s-table-header listSlot="primary">
                <SortableHeader
                  field="order"
                  label="Order"
                  sortSelected={[bar.sort]}
                  onSort={([next]) => next && bar.setSort(next)}
                />
              </s-table-header>
              {bar.visibleColumns.map((key) => {
                const sortable = SORTS.some((s) => s.field === key);
                const label = COLUMNS.find((c) => c.key === key)?.label ?? key;
                const numeric = key === "total" || key === "items";
                return (
                  <s-table-header
                    key={key}
                    listSlot="labeled"
                    format={key === "total" ? "currency" : numeric ? "numeric" : "base"}
                  >
                    {sortable ? (
                      <SortableHeader
                        field={key}
                        label={label}
                        sortSelected={[bar.sort]}
                        onSort={([next]) => next && bar.setSort(next)}
                        numeric={numeric}
                        sortType={key === "date" || key === "fulfillBy" ? "date" : undefined}
                      />
                    ) : (
                      label
                    )}
                  </s-table-header>
                );
              })}
            </s-table-header-row>
            <s-table-body>
              {shown.map((order) => (
                <s-table-row key={order.id}>
                  <s-table-cell>
                    <s-text type="strong">{order.name}</s-text>
                  </s-table-cell>
                  {bar.visibleColumns.map((key) => (
                    <s-table-cell key={key}>{cell(order, key)}</s-table-cell>
                  ))}
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

const cell = (order: Order, key: string) => {
  switch (key) {
    case "date":
      return when(order.createdAt);
    case "fulfillBy":
      return order.fulfillmentStatus === "Fulfilled" ? "" : when(order.fulfillBy);
    case "total":
      return usd.format(order.total);
    case "paymentStatus":
      return <s-badge tone={PAYMENT_TONE[order.paymentStatus]}>{order.paymentStatus}</s-badge>;
    case "fulfillmentStatus":
      return (
        <s-badge tone={FULFILLMENT_TONE[order.fulfillmentStatus]}>
          {order.fulfillmentStatus}
        </s-badge>
      );
    case "items":
      return `${order.items} ${order.items === 1 ? "item" : "items"}`;
    case "deliveryStatus":
      return order.deliveryStatus;
    case "tags":
      return order.tags.join(", ");
    default:
      return String(order[key as keyof Order] ?? "");
  }
};
