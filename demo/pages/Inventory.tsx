import {
  type FilterField,
  IndexCard,
  IndexFilterBar,
  localStorageViews,
  type SavedView,
  SortableHeader,
  useIndexFilters,
} from "@ljsstudios/index-filter-bar";
import { useMemo, useState } from "react";
import { DebugPanel } from "../DebugPanel";
import { BASE, DemoPage } from "../DemoPage";
import { applyFilters, sortRows } from "../lib/applyFilters";
import {
  LOCATIONS,
  type Location,
  ORDERED_VARIANTS,
  PRODUCTS,
  type Product,
  VARIANTS,
  type Variant,
} from "../lib/data";
import { listField, numberField, textField } from "../lib/fields";
import { ProductCell } from "../ProductCell";

const PAGE_SIZE = 50;

// Inventory's filters, in the admin's order.
const FIELDS: FilterField[] = [
  listField(
    "vendor",
    "Product vendor",
    PRODUCTS.map((p) => p.vendor),
  ),
  listField(
    "productType",
    "Product type",
    PRODUCTS.map((p) => p.productType),
  ),
  listField("status", "Product status", [
    { value: "active", label: "Active" },
    { value: "draft", label: "Draft" },
    { value: "archived", label: "Archived" },
  ]),
  textField("bin", "Bin name"),
  listField(
    "tag",
    "Tag",
    PRODUCTS.flatMap((p) => p.tags),
  ),
  listField(
    "salesChannel",
    "Sales channel",
    PRODUCTS.flatMap((p) => p.salesChannels),
  ),
  numberField("available", "Available"),
  numberField("incoming", "Incoming"),
  numberField("onHand", "On hand"),
  numberField("committed", "Committed"),
  numberField("unavailable", "Unavailable"),
  listField(
    "fulfillability",
    "Fulfillability",
    [
      { value: "fulfillable", label: "Fulfillable" },
      { value: "not_fulfillable", label: "Not fulfillable" },
    ],
    { single: true },
  ),
  textField("sku", "SKU"),
  textField("barcode", "Barcode"),
  listField(
    "barcodeStatus",
    "Barcode status",
    [
      { value: "has_barcode", label: "Has barcode" },
      { value: "no_barcode", label: "No barcode" },
    ],
    { single: true },
  ),
];

type Row = { product: Product; variant: Variant; location: Location };

const accessors = {
  vendor: (r: Row) => r.product.vendor,
  productType: (r: Row) => r.product.productType,
  status: (r: Row) => r.product.status,
  bin: (r: Row) => r.variant.stock[r.location].bin,
  tag: (r: Row) => r.product.tags,
  salesChannel: (r: Row) => r.product.salesChannels,
  available: (r: Row) => r.variant.stock[r.location].available,
  incoming: (r: Row) => r.variant.stock[r.location].incoming,
  onHand: (r: Row) => r.variant.stock[r.location].onHand,
  committed: (r: Row) => r.variant.stock[r.location].committed,
  unavailable: (r: Row) => r.variant.stock[r.location].unavailable,
  fulfillability: (r: Row) => (r.variant.fulfillable ? "fulfillable" : "not_fulfillable"),
  sku: (r: Row) => r.variant.sku,
  barcode: (r: Row) => r.variant.barcode,
  barcodeStatus: (r: Row) => (r.variant.barcode ? "has_barcode" : "no_barcode"),
};

// The admin's Inventory columns, Bin name hidden until shown.
const COLUMNS = [
  { key: "sku", label: "SKU" },
  { key: "unavailable", label: "Unavailable" },
  { key: "committed", label: "Committed" },
  { key: "available", label: "Available" },
  { key: "onHand", label: "On hand" },
  { key: "incoming", label: "Incoming" },
  { key: "bin", label: "Bin name", hidden: true },
];
const NUMERIC = new Set(["unavailable", "committed", "available", "onHand", "incoming"]);

const ascDesc = { ascLabel: "Ascending", descLabel: "Descending" };
const SORTS = [
  { field: "product", label: "Product", ...ascDesc },
  { field: "sku", label: "SKU", ...ascDesc },
  { field: "onHand", label: "On hand", ...ascDesc },
  { field: "available", label: "Available", ...ascDesc },
  { field: "committed", label: "Committed", ...ascDesc },
  { field: "incoming", label: "Incoming", ...ascDesc },
  { field: "unavailable", label: "Unavailable", ...ascDesc },
  { field: "bin", label: "Bin name", ...ascDesc },
];
const SORT_VALUES = {
  product: (r: Row) => `${r.product.title} ${r.variant.title}`,
  sku: (r: Row) => r.variant.sku,
  onHand: accessors.onHand,
  available: accessors.available,
  committed: accessors.committed,
  incoming: accessors.incoming,
  unavailable: accessors.unavailable,
  bin: accessors.bin,
};

// The admin's own Inventory views.
const DEFAULT_VIEWS: SavedView[] = [
  { title: "All", sort: "product asc", query: "", filters: [] },
  {
    title: "Incoming",
    sort: "product asc",
    query: "",
    filters: [{ field: "incoming", operator: "gt", values: ["0"] }],
  },
  {
    title: "Not Fulfillable",
    sort: "product asc",
    query: "",
    filters: [{ field: "fulfillability", operator: "is", values: ["not_fulfillable"] }],
  },
];

export const Inventory = ({
  debug,
  onDebugChange,
}: {
  debug: boolean;
  onDebugChange: (debug: boolean) => void;
}) => {
  const [location, setLocation] = useState<Location>(LOCATIONS[0]);
  const [stored] = useState(() => localStorageViews("demo-inventory-views", DEFAULT_VIEWS));
  const bar = useIndexFilters({
    id: "inventory",
    fields: FIELDS,
    sortOptions: SORTS,
    defaultSort: "product asc",
    columns: COLUMNS,
    ...stored,
  });

  const rows = useMemo(
    () =>
      sortRows(
        applyFilters(
          VARIANTS.map(({ product, variant }) => ({ product, variant, location })),
          {
            query: bar.query,
            filters: bar.filters,
            fields: FIELDS,
            accessors,
            searchIn: (r) =>
              [r.product.title, r.variant.title, r.variant.sku, r.variant.barcode].join(" "),
          },
        ),
        bar.sort,
        SORT_VALUES,
      ),
    [bar.query, bar.filters, bar.sort, location],
  );

  const [pageState, setPageState] = useState({ key: "", page: 0 });
  const listKey = JSON.stringify([bar.query, bar.filters, bar.sort, location]);
  const page = pageState.key === listKey ? pageState.page : 0;
  const setPage = (next: number) => setPageState({ key: listKey, page: next });
  const shown = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // The admin picks one location at a time, from the page header.
  const locationPicker = (
    <>
      <s-button
        slot="secondary-actions"
        icon="location"
        commandFor="inventory-location"
        command="--toggle"
      >
        {location}
      </s-button>
      <s-popover id="inventory-location">
        <s-stack padding="small-200" gap="none">
          {LOCATIONS.map((name) => (
            <s-button
              key={name}
              variant="tertiary"
              commandFor="inventory-location"
              command="--hide"
              icon={name === location ? "check" : undefined}
              onClick={() => setLocation(name)}
            >
              {name}
            </s-button>
          ))}
        </s-stack>
      </s-popover>
    </>
  );

  return (
    <DemoPage
      title="Inventory"
      debug={debug}
      onDebugChange={onDebugChange}
      actions={locationPicker}
    >
      <s-stack gap="small-100">
        <IndexFilterBar {...bar.props} />
        {rows.length === 0 ? (
          <IndexCard>
            <s-box padding="large-300">
              <s-stack gap="base" alignItems="center">
                <s-heading>No inventory found</s-heading>
                <s-paragraph>Try changing the filters or search term.</s-paragraph>
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
                  field="product"
                  label="Product"
                  sortSelected={[bar.sort]}
                  onSort={([next]) => next && bar.setSort(next)}
                />
              </s-table-header>
              {bar.visibleColumns.map((key) => (
                <s-table-header
                  key={key}
                  listSlot="labeled"
                  format={NUMERIC.has(key) ? "numeric" : "base"}
                >
                  <SortableHeader
                    field={key}
                    label={COLUMNS.find((c) => c.key === key)?.label ?? key}
                    sortSelected={[bar.sort]}
                    onSort={([next]) => next && bar.setSort(next)}
                    numeric={NUMERIC.has(key)}
                  />
                </s-table-header>
              ))}
            </s-table-header-row>
            <s-table-body>
              {shown.map((row) => (
                <s-table-row key={row.variant.id}>
                  <s-table-cell>
                    <ProductCell
                      image={row.product.image}
                      title={row.product.title}
                      variantTitle={row.variant.title}
                      // A variant with orders opens them, filtered read-only to it.
                      href={
                        ORDERED_VARIANTS.has(row.variant.id)
                          ? `${BASE}orders?variant=${row.variant.id}`
                          : undefined
                      }
                    />
                  </s-table-cell>
                  {bar.visibleColumns.map((key) => (
                    <s-table-cell key={key}>{cell(row, key)}</s-table-cell>
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

const cell = (row: Row, key: string) => {
  const stock = row.variant.stock[row.location];
  switch (key) {
    case "sku":
      return row.variant.sku || <s-text color="subdued">No SKU</s-text>;
    case "bin":
      return stock.bin;
    default:
      return String(
        stock[key as "available" | "committed" | "unavailable" | "onHand" | "incoming"],
      );
  }
};
