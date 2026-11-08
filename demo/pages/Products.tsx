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
import { DemoPage } from "../DemoPage";
import { applyFilters, sortRows } from "../lib/applyFilters";
import { choices, PRODUCTS, type Product } from "../lib/data";

const PAGE_SIZE = 25;

const isOps = (name: string) => [
  { value: "is", label: "Is", chipLabel: `${name} is` },
  { value: "is_not", label: "Is not", chipLabel: `${name} is not` },
];
const list = (key: string, name: string, values: Iterable<string>): FilterField => ({
  key,
  name,
  multi: true,
  values: choices(values),
  operators: isOps(name),
});

// Products' filters: all lists, as the admin's Products page has them.
const FIELDS: FilterField[] = [
  {
    key: "status",
    name: "Status",
    multi: true,
    values: [
      { value: "active", label: "Active" },
      { value: "draft", label: "Draft" },
      { value: "archived", label: "Archived" },
    ],
    operators: isOps("Status"),
  },
  list(
    "vendor",
    "Vendor",
    PRODUCTS.map((p) => p.vendor),
  ),
  list(
    "productType",
    "Product type",
    PRODUCTS.map((p) => p.productType),
  ),
  list(
    "category",
    "Category",
    PRODUCTS.map((p) => p.category),
  ),
  list(
    "tag",
    "Tagged with",
    PRODUCTS.flatMap((p) => p.tags),
  ),
  list(
    "collection",
    "Collection",
    PRODUCTS.flatMap((p) => p.collections),
  ),
];

const ACCESSORS = {
  status: (p: Product) => p.status,
  vendor: (p: Product) => p.vendor,
  productType: (p: Product) => p.productType,
  category: (p: Product) => p.category,
  tag: (p: Product) => p.tags,
  collection: (p: Product) => p.collections,
};

const COLUMNS = [
  { key: "status", label: "Status" },
  { key: "inventory", label: "Inventory" },
  { key: "category", label: "Category" },
  { key: "productType", label: "Type" },
  { key: "vendor", label: "Vendor" },
  { key: "created", label: "Created", hidden: true },
];

const SORTS = [
  { field: "title", label: "Product title", ascLabel: "A-Z", descLabel: "Z-A" },
  { field: "created", label: "Created", ascLabel: "Oldest first", descLabel: "Newest first" },
  {
    field: "inventory",
    label: "Inventory",
    ascLabel: "Lowest to highest",
    descLabel: "Highest to lowest",
  },
  { field: "vendor", label: "Vendor", ascLabel: "A-Z", descLabel: "Z-A" },
];
const SORT_VALUES = {
  title: (p: Product) => p.title,
  created: (p: Product) => p.createdAt,
  inventory: (p: Product) => p.inventory,
  vendor: (p: Product) => p.vendor,
};

// The admin's own Products views.
const status = (value: string) => [{ field: "status", operator: "is", values: [value] }];
const DEFAULT_VIEWS: SavedView[] = [
  { title: "All", sort: "title asc", query: "", filters: [] },
  { title: "Active", sort: "title asc", query: "", filters: status("active") },
  { title: "Draft", sort: "title asc", query: "", filters: status("draft") },
  { title: "Archived", sort: "title asc", query: "", filters: status("archived") },
];

const STATUS_TONE = { active: "success", draft: "info", archived: "neutral" } as const;
const STATUS_LABEL = { active: "Active", draft: "Draft", archived: "Archived" } as const;

export const Products = ({
  debug,
  onDebugChange,
}: {
  debug: boolean;
  onDebugChange: (debug: boolean) => void;
}) => {
  const [stored] = useState(() => localStorageViews("demo-products-views", DEFAULT_VIEWS));
  const bar = useIndexFilters({
    id: "products",
    fields: FIELDS,
    sortOptions: SORTS,
    defaultSort: "title asc",
    columns: COLUMNS,
    ...stored,
  });

  const rows = useMemo(
    () =>
      sortRows(
        applyFilters(PRODUCTS, {
          query: bar.query,
          filters: bar.filters,
          fields: FIELDS,
          accessors: ACCESSORS,
          searchIn: (p) =>
            [p.title, p.vendor, p.productType, ...p.tags, ...p.variants.map((v) => v.sku)].join(
              " ",
            ),
        }),
        bar.sort,
        SORT_VALUES,
      ),
    [bar.query, bar.filters, bar.sort],
  );

  // Back to the first page whenever the list changes.
  const [pageState, setPageState] = useState({ key: "", page: 0 });
  const listKey = JSON.stringify([bar.query, bar.filters, bar.sort]);
  const page = pageState.key === listKey ? pageState.page : 0;
  const setPage = (next: number) => setPageState({ key: listKey, page: next });
  const shown = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <DemoPage title="Products" debug={debug} onDebugChange={onDebugChange}>
      <s-stack gap="small-100">
        <IndexFilterBar {...bar.props} />
        {rows.length === 0 ? (
          <IndexCard>
            <s-box padding="large-300">
              <s-stack gap="base" alignItems="center">
                <s-heading>No products found</s-heading>
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
                  field="title"
                  label="Product"
                  sortSelected={[bar.sort]}
                  onSort={([next]) => next && bar.setSort(next)}
                />
              </s-table-header>
              {bar.visibleColumns.map((key) => (
                <s-table-header key={key} listSlot="labeled">
                  {key === "inventory" || key === "created" || key === "vendor" ? (
                    <SortableHeader
                      field={key}
                      label={COLUMNS.find((c) => c.key === key)?.label ?? key}
                      sortSelected={[bar.sort]}
                      onSort={([next]) => next && bar.setSort(next)}
                      sortType={
                        key === "created" ? "date" : key === "inventory" ? "numeric" : "text"
                      }
                    />
                  ) : (
                    COLUMNS.find((c) => c.key === key)?.label
                  )}
                </s-table-header>
              ))}
            </s-table-header-row>
            <s-table-body>
              {shown.map((product) => (
                <s-table-row key={product.id}>
                  <s-table-cell>
                    <s-stack direction="inline" gap="small-200" alignItems="center">
                      {product.image && (
                        <s-thumbnail src={product.image} alt={product.title} size="small-200" />
                      )}
                      <s-text type="strong">{product.title}</s-text>
                    </s-stack>
                  </s-table-cell>
                  {bar.visibleColumns.map((key) => (
                    <s-table-cell key={key}>{cell(product, key)}</s-table-cell>
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

const cell = (product: Product, key: string) => {
  switch (key) {
    case "status":
      return <s-badge tone={STATUS_TONE[product.status]}>{STATUS_LABEL[product.status]}</s-badge>;
    case "inventory":
      return (
        <s-text tone={product.inventory === 0 ? "critical" : undefined}>
          {`${product.inventory} in stock${product.variants.length > 1 ? ` for ${product.variants.length} variants` : ""}`}
        </s-text>
      );
    case "created":
      return product.createdAt.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    default:
      return String(product[key as "vendor" | "category" | "productType"] ?? "");
  }
};
