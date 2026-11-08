import { useEffect, useState } from "react";
import { useOverlayEvents } from "../internal/useOverlayEvents";
import { defaultLabels, format, type IndexFilterBarLabels } from "../labels";
import { MAX_VIEW_TITLE } from "../state/savedViews";

export type ViewModalKind = "create" | "rename" | "duplicate" | "delete";

/** What to open: a fresh object each time, so asking twice opens it twice. */
export interface ViewModalRequest {
  kind: ViewModalKind;
  index: number;
}

interface ViewModalsProps {
  idPrefix: string;
  request: ViewModalRequest | null;
  /** A view's title as shown (All in the merchant's language). */
  labelFor: (index: number) => string;
  titleTaken: (title: string, except?: number) => boolean;
  onCreate: (title: string) => Promise<void>;
  onRename: (index: number, title: string) => Promise<void>;
  onDuplicate: (index: number, title: string) => Promise<void>;
  onDelete: (index: number) => Promise<void>;
  labels?: Pick<IndexFilterBarLabels, "views" | "viewModals">;
  /** Shown after a save lands: in a Shopify app, `shopify.toast.show`. */
  onToast?: (message: string) => void;
  /** A save failed: the modal stays open with its banner; report it here. */
  onError?: (error: unknown, action: ViewModalKind) => void;
}

type FieldEvent = Event & { currentTarget: { value: string } };

/** An `s-modal` by id, opened and closed by its own methods (no App Bridge needed). */
const overlay = (id: string) =>
  document.getElementById(id) as
    | (HTMLElement & { showOverlay(): void; hideOverlay(): void })
    | null;

/**
 * The saved views' modals: one name modal for Save as new view, Rename and
 * Duplicate, and a delete confirmation. Each stays open with its button
 * loading until the write lands; a failed write keeps it open with a critical
 * banner, a success closes it and calls `onToast`.
 */
export const ViewModals = ({
  idPrefix,
  request,
  labelFor,
  titleTaken,
  onCreate,
  onRename,
  onDuplicate,
  onDelete,
  labels = defaultLabels,
  onToast,
  onError,
}: ViewModalsProps) => {
  const viewLabels = labels.views;
  const modalLabels = labels.viewModals;
  const nameModalId = `${idPrefix}-view-name-modal`;
  const deleteModalId = `${idPrefix}-view-delete-modal`;
  const [active, setActive] = useState<ViewModalRequest | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: the request alone opens a modal; labelFor and the labels change identity per render.
  useEffect(() => {
    if (!request) return;
    setActive(request);
    setFailed(false);
    if (request.kind === "delete") {
      overlay(deleteModalId)?.showOverlay();
      return;
    }
    setName(
      request.kind === "rename"
        ? labelFor(request.index)
        : request.kind === "duplicate"
          ? format(modalLabels.copyOf, { name: labelFor(request.index) })
          : "",
    );
    overlay(nameModalId)?.showOverlay();
  }, [request]);

  // The field takes focus with its text selected, ready to type over, as
  // the admin's Rename and Duplicate do.
  const nameModalRef = useOverlayEvents({
    onShow: () =>
      requestAnimationFrame(() => {
        const field = document.querySelector<HTMLElement & { select?: () => void }>(
          `#${nameModalId} s-text-field`,
        );
        field?.focus();
        field?.select?.();
        field?.shadowRoot?.querySelector("input")?.select();
      }),
  });

  const trimmed = name.trim();
  const taken =
    trimmed !== "" && titleTaken(trimmed, active?.kind === "rename" ? active.index : undefined);
  // Rename saves nothing until the name changes.
  const unchanged = active?.kind === "rename" && trimmed === labelFor(active.index);

  const run = async (modalId: string, action: () => Promise<void>, toast: string) => {
    setBusy(true);
    setFailed(false);
    try {
      await action();
      overlay(modalId)?.hideOverlay();
      onToast?.(toast);
    } catch (error) {
      if (active) onError?.(error, active.kind);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const confirmName = () => {
    if (!active || trimmed === "" || taken) return;
    if (active.kind === "rename") {
      void run(nameModalId, () => onRename(active.index, trimmed), modalLabels.renamedToast);
    } else if (active.kind === "duplicate") {
      void run(nameModalId, () => onDuplicate(active.index, trimmed), modalLabels.createdToast);
    } else {
      void run(nameModalId, () => onCreate(trimmed), modalLabels.createdToast);
    }
  };

  // The admin's wording for each: Save view as / View name / Discard, Rename
  // view / Name / Cancel, Duplicate view / Name / Create view.
  const heading =
    active?.kind === "rename"
      ? viewLabels.rename
      : active?.kind === "duplicate"
        ? viewLabels.duplicate
        : modalLabels.saveAsHeading;
  const creating = active?.kind === "create";

  return (
    <>
      <s-modal id={nameModalId} heading={heading} ref={nameModalRef}>
        <s-stack gap="base">
          {failed ? (
            <s-banner
              tone="critical"
              heading={modalLabels.saveFailed}
              dismissible
              onDismiss={() => setFailed(false)}
            ></s-banner>
          ) : null}
          <s-text-field
            label={creating ? modalLabels.viewNameLabel : modalLabels.nameLabel}
            value={name}
            maxLength={MAX_VIEW_TITLE}
            error={taken ? modalLabels.nameTaken : undefined}
            onInput={(e: FieldEvent) => setName(e.currentTarget.value)}
          ></s-text-field>
        </s-stack>
        <s-button
          slot="primary-action"
          variant="primary"
          loading={busy || undefined}
          disabled={trimmed === "" || taken || unchanged || undefined}
          onClick={confirmName}
        >
          {active?.kind === "duplicate" ? modalLabels.createView : modalLabels.save}
        </s-button>
        <s-button
          slot="secondary-actions"
          commandFor={nameModalId}
          command="--hide"
          disabled={busy || undefined}
        >
          {creating ? modalLabels.discard : modalLabels.cancel}
        </s-button>
      </s-modal>

      <s-modal id={deleteModalId} heading={modalLabels.deleteHeading}>
        <s-stack gap="base">
          {failed ? (
            <s-banner
              tone="critical"
              heading={modalLabels.saveFailed}
              dismissible
              onDismiss={() => setFailed(false)}
            ></s-banner>
          ) : null}
          <s-paragraph>
            {format(modalLabels.deleteBody, { name: active ? labelFor(active.index) : "" })}
          </s-paragraph>
        </s-stack>
        <s-button
          slot="primary-action"
          variant="primary"
          tone="critical"
          loading={busy || undefined}
          onClick={() => {
            if (active)
              void run(deleteModalId, () => onDelete(active.index), modalLabels.deletedToast);
          }}
        >
          {viewLabels.delete}
        </s-button>
        <s-button
          slot="secondary-actions"
          commandFor={deleteModalId}
          command="--hide"
          disabled={busy || undefined}
        >
          {modalLabels.cancel}
        </s-button>
      </s-modal>
    </>
  );
};
