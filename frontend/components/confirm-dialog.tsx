"use client";

import { useEffect, useId, useRef } from "react";
import { useLocale } from "@/lib/i18n";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = "primary",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useLocale();
  const resolvedCancelLabel = cancelLabel ?? t("Huỷ", "Cancel");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = "";
      onCancel();
    };
    const handleCancel = (e: Event) => {
      e.preventDefault();
      if (!busy) {
        onCancel();
      }
    };

    dialog.addEventListener("close", handleClose);
    dialog.addEventListener("cancel", handleCancel);
    return () => {
      dialog.removeEventListener("close", handleClose);
      dialog.removeEventListener("cancel", handleCancel);
    };
  }, [busy, onCancel]);

  const confirmClass =
    tone === "danger"
      ? "bg-error active:opacity-90 text-white"
      : "bg-primary active:bg-primary-active text-on-primary";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="w-full"
    >
      <div className="p-6">
        <h1 id={titleId} className="type-heading-3 text-ink">
          {title}
        </h1>
        <p id={descId} className="mt-2 text-[15px] text-ink-muted leading-relaxed">
          {description}
        </p>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            autoFocus
            disabled={busy}
            onClick={onCancel}
            className="min-h-11 rounded-[5px] border border-hairline bg-surface px-4 py-2 text-[15px] font-medium text-ink hover:bg-canvas-soft disabled:opacity-60 transition-colors"
          >
            {resolvedCancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`min-h-11 rounded-[5px] px-4 py-2 text-[15px] font-medium disabled:opacity-60 transition-colors ${confirmClass}`}
          >
            {busy ? "Đang xử lý…" : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
