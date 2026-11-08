# Search & Filters Bar

The Shopify admin's index search and filter bar, for embedded Shopify apps built with React and **Polaris 2.0 web components** (`polaris-2.0.js`, the `s-*` elements). It is not for the older Polaris React library (`@shopify/polaris`).

- **Every filter type the admin has:** list, number, date, text, currency, measurement and read-only.
- **Saved views** with Reset, Save, Update and Save as new. The "Show view filters" eye hides a view's own filters until it's needed.
- **Columns and sort:** reorder, hide and sort columns from the admin's columns menu.
- **The URL:** search, filters, sort and view are kept in readable params, so a refresh or a shared link lands on the same list.
- **Long value lists** load 25 at a time, from the page or a server.
- **Accessible:** named controls, announced filter changes, full keyboard use, and axe-checked against WCAG 2.2 AA.
- **Languages:** English, German, Spanish and French built in, and any other through a labels object.

It's matched to the admin's look and behaviour element by element, measured against the live admin.

**[Live demo](https://ljsstudios.github.io/index-filter-bar/)**: Products, Inventory, Orders and Segments pages on sample data. **[Documentation](https://index-filter-bar.mintlify.site)**.

## Install

```sh
npm install @ljsstudios/index-filter-bar
```

Requirements:
- **React** 18 or 19.
- **Polaris 2.0 web components** on the page. A Shopify app home already loads them:

  ```html
  <script src="https://cdn.shopify.com/shopifycloud/polaris-2.0.js"></script>
  ```
- **`@shopify/polaris-types`** (optional), for typed `s-*` elements in your own JSX.

## Quick start

```tsx
import { IndexFilterBar, useIndexFilters, type FilterField } from "@ljsstudios/index-filter-bar";
import "@ljsstudios/index-filter-bar/style.css";

const fields: FilterField[] = [
  {
    key: "vendor",
    name: "Vendor",
    multi: true,
    values: [
      { value: "acme", label: "Acme" },
      { value: "globex", label: "Globex" },
    ],
    operators: [
      { value: "is", label: "Is", chipLabel: "Vendor is" },
      { value: "is_not", label: "Is not", chipLabel: "Vendor is not" },
    ],
  },
];

export const ProductsPage = () => {
  const bar = useIndexFilters({
    fields,
    sortOptions: [{ field: "title", label: "Title", ascLabel: "A-Z", descLabel: "Z-A" }],
    columns: [
      { key: "vendor", label: "Vendor" },
      { key: "status", label: "Status" },
    ],
  });

  // Send bar.query, bar.filters and bar.sort to your API, and show bar.visibleColumns.
  const { data, isFetching } = useProducts(bar.query, bar.filters, bar.sort);

  return (
    <s-page heading="Products">
      <IndexFilterBar {...bar.props} />
      <s-table loading={isFetching || bar.pending}>{/* … */}</s-table>
    </s-page>
  );
};
```

The hook returns:

| | |
| --- | --- |
| `query` | The search text to send, 400ms after the last key (the admin's delay). |
| `pending` | True while typed text waits out that delay: `loading={isFetching \|\| bar.pending}` shows loading from the first key. |
| `filters` | The filters to apply: `{ field, operator, values, shape? }[]`. |
| `sort` | `"field direction"`, for example `"title asc"`. |
| `visibleColumns` | Column keys to show, in the merchant's order. |
| `view` | The selected view: `{ index, title, dirty }`. |
| `hasFilters`, `clear()` | For an empty state's "Clear search and filters". |
| `props` | Spread into `<IndexFilterBar>`. |

## Filter types

Each type is a `FilterField`. Where to compare it in the Shopify admin is in the last column.

| Type | What the merchant does | Admin example |
| --- | --- | --- |
| **List** (default) | Ticks one value (`multi: false`) or several (`multi: true`). | Products → Vendor, Status, Tag |
| **Number** | Types a number, or a range with Is between. | Inventory → Available, On hand |
| **Date** | Picks a preset, or types a date or range with a calendar. | Orders → Date, Fulfill by |
| **Text** | Types a value, optionally with a hint and a length. | Orders → Credit card (last 4 digits) |
| **Currency** | A number with the currency before it, starting as a range. | Orders → Order total |
| **Measurement** | A number with its unit after it, starting as a range. | Orders → Total product weight |
| **Read-only** | A grey chip the page sets, which can be removed but not opened or changed. | Purchase orders → Product variant |

See [filter types](https://index-filter-bar.mintlify.site/filter-types/overview) for each type's config, its conditions, and what its values look like.

## Saved views

Views are the merchant's named combinations of search, filters, sort and columns. All comes first and is the page's own default. Pass the stored views in, and store them when they change:

```tsx
const bar = useIndexFilters({
  fields,
  views: shop.savedViews, // All first
  onViewsChange: (views) => api.saveViews(views), // return a promise
  onToast: (message) => shopify.toast.show(message),
});
```

The save modals keep their spinner until the promise settles. A rejected promise keeps the modal open with an error banner. For prototypes, `localStorageViews(key, defaults)` keeps them in the browser. See [saved views](https://index-filter-bar.mintlify.site/guides/saved-views).

## Long value lists

A list shows its values 25 at a time and adds 25 more each time it's scrolled to the end, as the admin's do. When the values live on your server, give the field `fetchMoreValues(search)` and `hasNextPage`. The bar fetches the first page when the list opens empty, the next page at the end of the list, and a search 250ms after typing, with a loading row meanwhile. See [long lists](https://index-filter-bar.mintlify.site/filter-types/long-lists).

## Languages

Every word comes from a labels object, English by default. Locale files for German, Spanish and French ship with the package:

```tsx
import de from "@ljsstudios/index-filter-bar/locales/de.json";

const bar = useIndexFilters({ fields, labels: de });
```

Change single words with `mergeLabels({ views: { all: "Everything" } })`. See [languages](https://index-filter-bar.mintlify.site/guides/languages).

## Accessibility

Checked with axe (WCAG 2.2 AA) in the test suite and on the demo pages, and spot-checked with VoiceOver.
- **The search field:** a combobox with keyboard help.
- **The lists:** named for what they hold, with multi-select values marked selected.
- **Typed values:** named textboxes, such as "Order total (USD $), minimum".
- **Announcements:** each filter added, changed or removed is said.
- **Menus:** the views and Save menus move with the arrow keys, and columns reorder from the keyboard.
- **Targets:** remove buttons take clicks across 24px.

Two choices differ from the admin for WCAG:
- typed-value hints are drawn darker (4.5:1 contrast);
- the admin's field is a plain textbox, ours a combobox.

Keyboard reference: [keyboard](https://index-filter-bar.mintlify.site/guides/keyboard).

## Choosing the parts

Each part shows only when the page gives it what it needs: `savedViews: false` drops the views button, Reset, Save and the eye; sort options without columns give a sort button of its own; no `fields` gives a plain search. See [choosing the parts](https://index-filter-bar.mintlify.site/guides/customising).

## Lower-level parts

`IndexFilterBar` is the parts below, laid out as the admin's. Use them directly for your own layout:
- `IndexBar`
- `ViewSwitcher`
- `SearchField`
- `ColumnsPopover`
- `SortPopover` and `SortMenu`
- `ViewFiltersButton`
- `SaveControls`
- `ViewModals`
- `SortableHeader`, for `s-table` headers

The pure helpers are exported too: `splitViewFilters`, `encodeFilters`, `decodeFilters`, `readSavedViews`, `reconcileColumns`. See [helpers](https://index-filter-bar.mintlify.site/api/helpers).

## Known limits

- **Icon hover colour:** Polaris icons come in fixed colours, so the bar's icons don't darken on hover as the admin's do.
- **Critical red:** "Delete view" uses Polaris's critical tone, a shade brighter than the admin's.
- **Currency picker:** the admin's code has a currency picker for fields offering several currencies, but no admin page uses it, so it's left out.

## Development

```sh
pnpm install
pnpm demo        # the demo on http://localhost:5180
pnpm check       # typecheck, lint, knip, tests
pnpm build       # dist/
```

The demo's products come from [mock.shop](https://mock.shop), Shopify's free sample Storefront API (`pnpm data:fetch`). Stock and orders are generated from them (`pnpm data:generate`). See [CONTRIBUTING.md](CONTRIBUTING.md).

## Licence

MIT © LJS Studios Ltd. Not affiliated with or endorsed by Shopify. Shopify and Polaris are trademarks of Shopify Inc.
