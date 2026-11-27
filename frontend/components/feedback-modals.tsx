"use client";

import { useEffect, useId, useRef, useState } from "react";
import { formatDateTime, formatSignedVnd } from "@/lib/format";
import type {
  PlanData,
  PlanItem,
  Suggestion,
  SuggestionCategory,
  VersionDiffResponse,
} from "@/lib/types";
import { StatusBanner } from "./status-banner";

const CATEGORY_LABELS: Record<SuggestionCategory, string> = {
  replace: "Thay địa điểm",
  change_time: "Đổi giờ",
  add: "Thêm mới",
  remove: "Bớt mục",
  other: "Khác",
};

interface SuggestionFormDialogProps {
  open: boolean;
  plan: PlanData;
  currentVersion: number;
  defaultDay: number;
  defaultItem?: PlanItem | null;
  defaultContent?: string;
  onClose: () => void;
  onSubmit: (payload: {
    day: number | null;
    item_id: string | null;
    category: SuggestionCategory;
    content: string;
    based_on_version: number;
  }) => Promise<void>;
}

export function SuggestionFormDialog({
  open,
  plan,
  currentVersion,
  defaultDay,
  defaultItem,
  defaultContent = "",
  onClose,
  onSubmit,
}: SuggestionFormDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [day, setDay] = useState<number>(defaultDay);
  const [itemId, setItemId] = useState<string>(defaultItem?.id ?? "");
  const [category, setCategory] = useState<SuggestionCategory>("replace");
  const [content, setContent] = useState(defaultContent);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => {
      dialog.returnValue = "";
      onClose();
    };
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  const itemsInDay =
    plan.days.find((d) => d.day === day)?.items ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setErrorMsg("Hãy nhập nội dung góp ý.");
      return;
    }
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await onSubmit({
        day,
        item_id: itemId || null,
        category,
        content: content.trim(),
        based_on_version: currentVersion,
      });
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Không gửi được góp ý.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <dialog ref={dialogRef} aria-labelledby={titleId} className="w-full">
      <form onSubmit={(e) => void handleSubmit(e)} className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <h1 id={titleId} className="type-heading-3 text-ink">
            Gửi góp ý cho nhóm trưởng
          </h1>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[8px] border border-hairline bg-surface px-3 py-1 text-[13px] font-medium text-ink-muted hover:text-ink hover:bg-canvas-soft"
          >
            Đóng
          </button>
        </div>

        {errorMsg ? <StatusBanner tone="error" message={errorMsg} /> : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="sug-day"
              className="block text-[13px] font-semibold text-ink mb-1"
            >
              Ngày liên quan
            </label>
            <select
              id="sug-day"
              value={day}
              onChange={(e) => {
                setDay(Number(e.target.value));
                setItemId("");
              }}
              className="notion-input min-h-11 w-full px-3 py-1.5 text-[15px]"
            >
              {plan.days.map((d) => (
                <option key={d.day} value={d.day}>
                  Ngày {d.day}: {d.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="sug-cat"
              className="block text-[13px] font-semibold text-ink mb-1"
            >
              Loại góp ý
            </label>
            <select
              id="sug-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value as SuggestionCategory)}
              className="notion-input min-h-11 w-full px-3 py-1.5 text-[15px]"
            >
              {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor="sug-item"
            className="block text-[13px] font-semibold text-ink mb-1"
          >
            Mục trong ngày (tuỳ chọn)
          </label>
          <select
            id="sug-item"
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            className="notion-input min-h-11 w-full px-3 py-1.5 text-[15px]"
          >
            <option value="">Cả ngày / không chọn mục cụ thể</option>
            {itemsInDay.map((it) => (
              <option key={it.id} value={it.id}>
                {it.start} · {it.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="sug-content"
            className="block text-[13px] font-semibold text-ink mb-1"
          >
            Nội dung góp ý *
          </label>
          <textarea
            id="sug-content"
            required
            rows={3}
            maxLength={1000}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Ví dụ: Đổi bữa trưa ngày 2 sang quán chay vì Toàn ăn chay…"
            className="notion-input w-full px-3 py-2 text-[15px]"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-[8px] border border-hairline bg-surface px-4 py-2 text-[15px] font-medium text-ink hover:bg-canvas-soft"
          >
            Huỷ
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="min-h-11 rounded-[8px] bg-primary active:bg-primary-active px-4 py-2 text-[15px] font-medium text-on-primary disabled:opacity-60"
          >
            {submitting ? "Đang gửi…" : "Gửi góp ý"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

interface SuggestionInboxDialogProps {
  open: boolean;
  suggestions: Suggestion[];
  onClose: () => void;
  onConvertToEdit: (suggestion: Suggestion) => void;
  onHandle: (
    suggestionId: string,
    status: "noted" | "declined",
    note?: string,
  ) => Promise<void>;
}

export function SuggestionInboxDialog({
  open,
  suggestions,
  onClose,
  onConvertToEdit,
  onHandle,
}: SuggestionInboxDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => {
      dialog.returnValue = "";
      onClose();
    };
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  const handleAction = async (
    id: string,
    status: "noted" | "declined",
    note?: string,
  ) => {
    setErrorMsg(null);
    setBusyId(id);
    try {
      await onHandle(id, status, note);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Không xử lý được góp ý.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <dialog ref={dialogRef} aria-labelledby={titleId} className="w-full">
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <h1 id={titleId} className="type-heading-3 text-ink">
            Hộp góp ý của thành viên
          </h1>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="rounded-[8px] border border-hairline bg-surface px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-canvas-soft"
          >
            Đóng
          </button>
        </div>

        {errorMsg ? <StatusBanner tone="error" message={errorMsg} /> : null}

        {suggestions.length === 0 ? (
          <p className="py-6 text-center text-[15px] text-ink-muted">
            Chưa có góp ý nào từ thành viên.
          </p>
        ) : (
          <ul className="space-y-3 max-h-[60dvh] overflow-y-auto pr-1">
            {suggestions.map((sug) => (
              <li
                key={sug.id}
                className="rounded-[12px] border border-hairline bg-canvas-soft p-4 space-y-2 text-[14px]"
              >
                <div className="flex items-center justify-between gap-2 text-[12px] text-ink-muted">
                  <span className="font-semibold text-ink">
                    {sug.author.display_name} · {CATEGORY_LABELS[sug.category]}
                    {sug.day ? ` · Ngày ${sug.day}` : ""}
                  </span>
                  <span className="tabular-nums text-ink-faint">
                    {formatDateTime(sug.created_at)}
                  </span>
                </div>
                {sug.item_name ? (
                  <p className="text-[12px] font-semibold text-primary">
                    Mục: {sug.item_name}
                  </p>
                ) : null}
                <p className="text-ink-secondary break-words">{sug.content}</p>

                {sug.status === "new" ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      disabled={busyId === sug.id}
                      onClick={() => onConvertToEdit(sug)}
                      className="min-h-9 rounded-[8px] bg-primary active:bg-primary-active px-3 py-1.5 text-[13px] font-medium text-on-primary"
                    >
                      Tạo đề xuất từ góp ý này
                    </button>
                    <button
                      type="button"
                      disabled={busyId === sug.id}
                      onClick={() => void handleAction(sug.id, "noted")}
                      className="min-h-9 rounded-[8px] border border-hairline bg-surface px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-canvas-soft"
                    >
                      Ghi nhận
                    </button>
                    <button
                      type="button"
                      disabled={busyId === sug.id}
                      onClick={() =>
                        void handleAction(
                          sug.id,
                          "declined",
                          "Chưa phù hợp với lịch chung",
                        )
                      }
                      className="min-h-9 rounded-[8px] border border-hairline bg-surface px-3 py-1.5 text-[13px] font-medium text-accent-orange-deep hover:bg-canvas-soft"
                    >
                      Từ chối
                    </button>
                  </div>
                ) : (
                  <p className="text-[12px] text-ink-muted">
                    Trạng thái: <strong>{sug.status}</strong>
                    {sug.proposal ? ` (Đề xuất #${sug.proposal.number})` : ""}
                    {sug.leader_note ? ` — ${sug.leader_note}` : ""}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </dialog>
  );
}

interface VersionDiffDialogProps {
  diff: VersionDiffResponse | null;
  onClose: () => void;
}

export function VersionDiffDialog({ diff, onClose }: VersionDiffDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (diff && !dialog.open) dialog.showModal();
    else if (!diff && dialog.open) dialog.close();
  }, [diff]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => {
      dialog.returnValue = "";
      onClose();
    };
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  return (
    <dialog ref={dialogRef} aria-labelledby={titleId} className="w-full">
      <div className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <h1 id={titleId} className="type-heading-3 text-ink">
            {diff
              ? `So sánh v${diff.from} với v${diff.to}`
              : "So sánh phiên bản"}
          </h1>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="rounded-[8px] border border-hairline bg-surface px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-canvas-soft"
          >
            Đóng
          </button>
        </div>

        {diff ? (
          <>
            <p className="text-[14px] text-ink-muted tabular-nums">
              Chênh lệch chi phí:{" "}
              <strong className="text-ink">
                {formatSignedVnd(diff.cost_delta_per_person)}
              </strong>
            </p>
            {diff.changes.length === 0 ? (
              <p className="text-[14px] text-ink-muted">
                Hai phiên bản không có khác biệt về mục lịch trình.
              </p>
            ) : (
              <ul className="space-y-2 text-[14px]">
                {diff.changes.map((c, idx) => (
                  <li
                    key={`${c.item_id}-${idx}`}
                    className="rounded-[8px] border border-hairline bg-canvas-soft px-3 py-2 text-ink-secondary"
                  >
                    {c.type === "added" && `Thêm "${c.name}" (Ngày ${c.day})`}
                    {c.type === "removed" && `Xoá "${c.name}" (Ngày ${c.day})`}
                    {c.type === "moved" &&
                      `Dời "${c.name}" từ Ngày ${c.from.day} (${c.from.start}) sang Ngày ${c.to.day} (${c.to.start})`}
                    {c.type === "updated" &&
                      `Cập nhật "${c.name ?? c.item_id}"`}
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}
      </div>
    </dialog>
  );
}
