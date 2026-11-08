import { ColumnsPopover } from "./components/ColumnsPopover";
import { IndexBar } from "./components/IndexBar";
import { SaveControls } from "./components/SaveControls";
import { SearchField } from "./components/SearchField";
import { ViewFiltersButton } from "./components/ViewFiltersButton";
import { ViewModals } from "./components/ViewModals";
import { ViewSwitcher } from "./components/ViewSwitcher";
import type { IndexFilterBarProps } from "./useIndexFilters";

/**
 * The admin's index search and filter bar, whole: views, the search field
 * with its filters, the columns and sort menu, the "Show view filters" eye,
 * Reset view and Save, and the save modals. Drawn from `useIndexFilters`:
 *
 *   const bar = useIndexFilters({ fields, sortOptions, columns });
 *   <IndexFilterBar {...bar.props} />
 */
export const IndexFilterBar = ({
  id,
  labels,
  readOnly,
  views,
  search,
  columns,
  viewFilters,
  save,
  modals,
}: IndexFilterBarProps) => (
  <>
    <IndexBar
      views={
        views && (
          <ViewSwitcher
            popoverId={`${id}-views`}
            titles={views.titles}
            selected={views.selected}
            onSelect={views.onSelect}
            onAction={views.onAction}
            readOnly={readOnly}
            labels={labels.views}
          />
        )
      }
      actions={
        <>
          {columns && (
            <ColumnsPopover
              popoverId={`${id}-columns`}
              sortOptions={columns.sortOptions}
              sort={columns.sort}
              onSortChange={columns.onSortChange}
              columns={columns.columns}
              onReorder={columns.onReorder}
              onToggle={columns.onToggle}
              labels={labels.columns}
            />
          )}
          {viewFilters && (
            <ViewFiltersButton
              revealed={viewFilters.revealed}
              onToggle={viewFilters.onToggle}
              labels={{ show: labels.views.showViewFilters, hide: labels.views.hideViewFilters }}
            />
          )}
          {save && (
            <SaveControls
              idPrefix={id}
              dirty={save.dirty}
              onAll={save.onAll}
              onReset={save.onReset}
              onSaveAsNew={save.onSaveAsNew}
              onUpdate={save.onUpdate}
              readOnly={readOnly}
              labels={labels.views}
            />
          )}
        </>
      }
    >
      <SearchField
        value={search.value}
        onChange={search.onChange}
        fields={search.fields}
        filters={search.filters}
        onFiltersChange={search.onFiltersChange}
        usedFields={search.usedFields}
        labels={search.labels}
      />
    </IndexBar>
    {modals && (
      <ViewModals
        idPrefix={id}
        request={modals.request}
        labelFor={modals.labelFor}
        titleTaken={modals.titleTaken}
        onCreate={modals.onCreate}
        onRename={modals.onRename}
        onDuplicate={modals.onDuplicate}
        onDelete={modals.onDelete}
        labels={labels}
        onToast={modals.onToast}
        onError={modals.onError}
      />
    )}
  </>
);
