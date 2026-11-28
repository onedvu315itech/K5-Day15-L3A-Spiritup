"use client";

import { useEffect, useId, useRef, useState } from "react";
import { formatDateTime, formatSignedVnd } from "@/lib/format";
import { useLocale } from "@/lib/i18n";
import type {
  PlanData,
  PlanItem,
  Suggestion,
  SuggestionCategory,
  VersionDiffResponse,
} from "@/lib/types";
import { StatusBanner } from "./status-banner";

const CATEGORY_LABELS: Record<SuggestionCategory, { vi: string; en: string }> = {
  replace: { vi: "Thay địa điểm", en: "Replace place" },
  change_time: { vi: "Đổi giờ", en: "Change time" },
  add: { vi: "Thêm mới", en: "Add item" },
  remove: { vi: "Bớt mục", en: "Remove item" },
  other: { vi: "Khác", en: "Other" },
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
  const { locale, t } = useLocale();
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
            {t("Gửi góp ý cho nhóm trưởng", "Send feedback to leader")}
          </h1>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[8px] border border-hairline bg-surface px-3 py-1 text-[13px] font-medium text-ink-muted hover:text-ink hover:bg-canvas-soft"
          >
            {t("Đóng", "Close")}
          </button>
        </div>

        {errorMsg ? <StatusBanner tone="error" message={errorMsg} /> : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="sug-day"
              className="block text-[13px] font-semibold text-ink mb-1"
            >
              {t("Ngày liên quan", "Related day")}
            </label>
            <select
              id="sug-day"
              value={day}
              onChange={(e) => {
                setDay(Number(e.target.value));
                setItemId("");
              }}
              className="nomad-input min-h-11 w-full px-3 py-1.5 text-[15px]"
            >
              {plan.days.map((d) => (
                <option key={d.day} value={d.day}>
                  {t("Ngày", "Day")} {d.day}: {d.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="sug-cat"
              className="block text-[13px] font-semibold text-ink mb-1"
            >
              {t("Loại góp ý", "Category")}
            </label>
            <select
              id="sug-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value as SuggestionCategory)}
              className="nomad-input min-h-11 w-full px-3 py-1.5 text-[15px]"
            >
              {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {locale === "en" ? label.en : label.vi}
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
            {t("Mục trong ngày (tuỳ chọn)", "Item in day (optional)")}
          </label>
          <select
            id="sug-item"
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            className="nomad-input min-h-11 w-full px-3 py-1.5 text-[15px]"
          >
            <option value="">
              {t("Cả ngày / không chọn mục cụ thể", "Whole day / no specific item")}
            </option>
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
            {t("Nội dung góp ý *", "Feedback details *")}
          </label>
          <textarea
            id="sug-content"
            required
            rows={3}
            maxLength={1000}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t(
              "Ví dụ: Đổi bữa trưa ngày 2 sang quán chay vì Toàn ăn chay…",
              "Example: Swap Day 2 lunch to a vegetarian spot…",
            )}
            className="nomad-input w-full px-3 py-2 text-[15px]"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-[5px] border border-hairline bg-surface px-4 py-2 text-[15px] font-medium text-ink hover:bg-canvas-soft"
          >
            {t("Huỷ", "Cancel")}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="min-h-11 rounded-[5px] bg-primary active:bg-primary-active px-4 py-2 text-[15px] font-semibold text-on-primary disabled:opacity-60"
          >
            {submitting
              ? t("Đang gửi…", "Sending…")
              : t("Gửi góp ý", "Submit feedback")}
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
  const { locale, t } = useLocale();
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
            {t("Hộp góp ý của thành viên", "Member feedback inbox")}
          </h1>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="rounded-[5px] border border-hairline bg-surface px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-canvas-soft"
          >
            {t("Đóng", "Close")}
          </button>
        </div>

        {errorMsg ? <StatusBanner tone="error" message={errorMsg} /> : null}

        {suggestions.length === 0 ? (
          <p className="py-6 text-center text-[15px] text-ink-muted">
            {t("Chưa có góp ý nào từ thành viên.", "No feedback from members yet.")}
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
                    {sug.author.display_name} ·{" "}
                    {locale === "en"
                      ? CATEGORY_LABELS[sug.category].en
                      : CATEGORY_LABELS[sug.category].vi}
                    {sug.day ? ` · ${t("Ngày", "Day")} ${sug.day}` : ""}
                  </span>
                  <span className="tabular-nums text-ink-faint">
                    {formatDateTime(sug.created_at)}
                  </span>
                </div>
                {sug.item_name ? (
                  <p className="text-[12px] font-semibold text-secondary">
                    {t("Mục:", "Item:")} {sug.item_name}
                  </p>
                ) : null}
                <p className="text-ink-secondary break-words">{sug.content}</p>

                {sug.status === "new" ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      disabled={busyId === sug.id}
                      onClick={() => onConvertToEdit(sug)}
                      className="min-h-9 rounded-[5px] bg-primary active:bg-primary-active px-3 py-1.5 text-[13px] font-semibold text-on-primary"
                    >
                      {t("Tạo đề xuất từ góp ý này", "Create proposal")}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === sug.id}
                      onClick={() => void handleAction(sug.id, "noted")}
                      className="min-h-9 rounded-[5px] border border-hairline bg-surface px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-canvas-soft"
                    >
                      {t("Ghi nhận", "Mark noted")}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === sug.id}
                      onClick={() =>
                        void handleAction(
                          sug.id,
                          "declined",
                          t(
                            "Chưa phù hợp với lịch chung",
                            "Does not fit current schedule",
                          ),
                        )
                      }
                      className="min-h-9 rounded-[5px] border border-hairline bg-surface px-3 py-1.5 text-[13px] font-medium text-error hover:bg-canvas-soft"
                    >
                      {t("Từ chối", "Decline")}
                    </button>
                  </div>
                ) : (
                  <p className="text-[12px] text-ink-muted">
                    {t("Trạng thái:", "Status:")} <strong>{sug.status}</strong>
                    {sug.proposal
                      ? ` (${t("Đề xuất", "Proposal")} #${sug.proposal.number})`
                      : ""}
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
  const { t } = useLocale();
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
              ? `${t("So sánh", "Compare")} v${diff.from} ${t("với", "vs")} v${diff.to}`
              : t("So sánh phiên bản", "Compare versions")}
          </h1>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="rounded-[5px] border border-hairline bg-surface px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-canvas-soft"
          >
            {t("Đóng", "Close")}
          </button>
        </div>

        {diff ? (
          <>
            <p className="text-[14px] text-ink-muted tabular-nums">
              {t("Chênh lệch chi phí:", "Cost difference:")}{" "}
              <strong className="text-ink">
                {formatSignedVnd(diff.cost_delta_per_person)}
              </strong>
            </p>
            {diff.changes.length === 0 ? (
              <p className="text-[14px] text-ink-muted">
                {t(
                  "Hai phiên bản không có khác biệt về mục lịch trình.",
                  "No itinerary differences between these two versions.",
                )}
              </p>
            ) : (
              <ul className="space-y-2 text-[14px]">
                {diff.changes.map((c, idx) => (
                  <li
                    key={`${c.item_id}-${idx}`}
                    className="rounded-[8px] border border-hairline bg-canvas-soft px-3 py-2 text-ink-secondary"
                  >
                    {c.type === "added" &&
                      t(`Thêm "${c.name}" (Ngày ${c.day})`, `Add "${c.name}" (Day ${c.day})`)}
                    {c.type === "removed" &&
                      t(`Xoá "${c.name}" (Ngày ${c.day})`, `Remove "${c.name}" (Day ${c.day})`)}
                    {c.type === "moved" &&
                      t(
                        `Dời "${c.name}" từ Ngày ${c.from.day} (${c.from.start}) sang Ngày ${c.to.day} (${c.to.start})`,
                        `Move "${c.name}" from Day ${c.from.day} (${c.from.start}) to Day ${c.to.day} (${c.to.start})`,
                      )}
                    {c.type === "updated" &&
                      t(`Cập nhật "${c.name ?? c.item_id}"`, `Update "${c.name ?? c.item_id}"`)}
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
