"use client";

import { useState } from "react";
import { formatDate, formatDurationMinutes, formatVnd } from "@/lib/format";
import type {
  DraftProposalResponse,
  PlanComputed,
  PlanData,
  PlanItem,
  PlanItemKind,
  PlanOp,
} from "@/lib/types";
import { StatusBanner } from "./status-banner";

const KIND_META: Record<PlanItemKind, { label: string; dot: string }> = {
  food: { label: "Ăn uống", dot: "bg-accent-orange" },
  cafe: { label: "Cà phê", dot: "bg-accent-teal" },
  sight: { label: "Tham quan", dot: "bg-accent-purple ring-1 ring-accent-purple-deep/30" },
  hotel: { label: "Lưu trú", dot: "bg-accent-green" },
  activity: { label: "Trải nghiệm", dot: "bg-accent-pink" },
  move: { label: "Di chuyển", dot: "bg-accent-sky" },
  other: { label: "Khác", dot: "bg-accent-brown" },
};

const SOURCE_LABELS: Record<string, string> = {
  google: "Google Places",
  tiktok: "TikTok",
  instagram: "Instagram",
  manual: "Nhóm thêm",
};

interface TripTimelineProps {
  plan: PlanData;
  computed: PlanComputed;
  versionNo: number;
  isCurrent: boolean;
  isLeader: boolean;
  initialEditRequest?: {
    suggestionId?: string;
    prefillText?: string;
  } | null;
  onReturnToCurrent?: () => void;
  onDraftWithRoa: (
    requestText: string,
    suggestionId?: string | null,
  ) => Promise<DraftProposalResponse>;
  onSubmitProposal: (payload: {
    base_version: number;
    ops: PlanOp[];
    summary: string;
    reason?: string;
    origin: "manual" | "agent" | "suggestion";
    suggestion_id?: string | null;
    expires_at?: string | null;
  }) => Promise<void>;
  onOpenSuggestionModal?: (day: number, item?: PlanItem) => void;
}

export function TripTimeline({
  plan,
  computed,
  versionNo,
  isCurrent,
  isLeader,
  initialEditRequest,
  onReturnToCurrent,
  onDraftWithRoa,
  onSubmitProposal,
  onOpenSuggestionModal,
}: TripTimelineProps) {
  const [selectedDay, setSelectedDay] = useState<number>(plan.days[0]?.day ?? 1);
  const [editMode, setEditMode] = useState<boolean>(Boolean(initialEditRequest));
  const [pendingOps, setPendingOps] = useState<PlanOp[]>([]);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [addingItem, setAddingItem] = useState(false);

  const [summary, setSummary] = useState(
    initialEditRequest?.prefillText ?? "",
  );
  const [reason, setReason] = useState("");
  const [origin, setOrigin] = useState<"manual" | "agent" | "suggestion">(
    initialEditRequest?.suggestionId ? "suggestion" : "manual",
  );
  const [suggestionId, setSuggestionId] = useState<string | null>(
    initialEditRequest?.suggestionId ?? null,
  );
  const [expiresAt, setExpiresAt] = useState("");

  const [roaPrompt, setRoaPrompt] = useState(
    initialEditRequest?.prefillText ?? "",
  );
  const [roaDrafting, setRoaDrafting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editCost, setEditCost] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editTargetDay, setEditTargetDay] = useState<number>(selectedDay);

  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<PlanItemKind>("cafe");
  const [newStart, setNewStart] = useState("15:00");
  const [newEnd, setNewEnd] = useState("16:30");
  const [newAddress, setNewAddress] = useState("");
  const [newCost, setNewCost] = useState("70000");
  const [newReason, setNewReason] = useState("");

  const activeDayObj =
    plan.days.find((d) => d.day === selectedDay) ?? plan.days[0];
  const activeDayMetrics = computed.per_day.find(
    (d) => d.day === activeDayObj?.day,
  );

  const openEditorForItem = (item: PlanItem, dayNo: number) => {
    setEditingItemId(item.id);
    setEditStart(item.start);
    setEditEnd(item.end);
    setEditCost(String(item.cost_per_person));
    setEditNote(item.note);
    setEditTargetDay(dayNo);
    setErrorMsg(null);
  };

  const handleSaveItemOps = (item: PlanItem, currentDay: number) => {
    if (editEnd <= editStart) {
      setErrorMsg("Giờ kết thúc phải lớn hơn giờ bắt đầu.");
      return;
    }
    const costNum = Number(editCost);
    if (!Number.isFinite(costNum) || costNum < 0) {
      setErrorMsg("Chi phí dự kiến phải là số không âm.");
      return;
    }

    const nextOps: PlanOp[] = [];
    if (editTargetDay !== currentDay) {
      const destDay = plan.days.find((d) => d.day === editTargetDay);
      const lastInDest = destDay?.items[destDay.items.length - 1];
      nextOps.push({
        op: "move_item",
        item_id: item.id,
        to_day: editTargetDay,
        after_id: lastInDest?.id ?? null,
      });
    }
    if (
      editStart !== item.start ||
      editEnd !== item.end ||
      costNum !== item.cost_per_person ||
      editNote !== item.note
    ) {
      nextOps.push({
        op: "update_item",
        item_id: item.id,
        set: {
          start: editStart,
          end: editEnd,
          cost_per_person: Math.round(costNum),
          note: editNote.trim(),
        },
      });
    }

    if (nextOps.length > 0) {
      setPendingOps((prev) => [...prev, ...nextOps]);
      if (!summary.trim()) {
        setSummary(`Cập nhật mục "${item.name}"`);
      }
    }
    setEditingItemId(null);
    setErrorMsg(null);
  };

  const handleRemoveItem = (item: PlanItem) => {
    setPendingOps((prev) => [
      ...prev,
      { op: "remove_item", item_id: item.id },
    ]);
    if (!summary.trim()) {
      setSummary(`Xoá "${item.name}" khỏi lịch trình`);
    }
  };

  const handleAddNewItem = () => {
    if (!activeDayObj) return;
    if (!newName.trim() || newEnd <= newStart) {
      setErrorMsg("Cần nhập tên địa điểm và giờ kết thúc sau giờ bắt đầu.");
      return;
    }
    const costVal = Math.max(0, Math.round(Number(newCost) || 0));
    const lastId =
      activeDayObj.items[activeDayObj.items.length - 1]?.id ?? null;

    setPendingOps((prev) => [
      ...prev,
      {
        op: "add_item",
        day: activeDayObj.day,
        after_id: lastId,
        item: {
          start: newStart,
          end: newEnd,
          kind: newKind,
          name: newName.trim(),
          place_id: null,
          address: newAddress.trim() || "Đà Lạt",
          lat: null,
          lng: null,
          cost_per_person: costVal,
          reason: newReason.trim() || "Bổ sung theo nhu cầu nhóm",
          note: "",
          sources: [{ type: "manual", ref: "leader" }],
        },
      },
    ]);
    if (!summary.trim()) {
      setSummary(`Thêm "${newName.trim()}" vào ngày ${activeDayObj.day}`);
    }
    setNewName("");
    setNewAddress("");
    setNewReason("");
    setAddingItem(false);
    setErrorMsg(null);
  };

  const handleAskRoaDraft = async () => {
    if (!roaPrompt.trim()) {
      setErrorMsg("Hãy nhập yêu cầu để Roa soạn đề xuất.");
      return;
    }
    setErrorMsg(null);
    setRoaDrafting(true);
    try {
      const draft = await onDraftWithRoa(roaPrompt.trim(), suggestionId);
      setPendingOps(draft.ops);
      setSummary(draft.summary);
      setReason(draft.reason);
      setOrigin(suggestionId ? "suggestion" : "agent");
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Không thể nhờ Roa soạn đề xuất.",
      );
    } finally {
      setRoaDrafting(false);
    }
  };

  const handleSubmitProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pendingOps.length === 0) {
      setErrorMsg("Chưa có thay đổi nào để gửi thành đề xuất.");
      return;
    }
    if (!summary.trim()) {
      setErrorMsg("Hãy viết tóm tắt ngắn cho đề xuất trước khi gửi.");
      return;
    }
    setErrorMsg(null);
    setSubmitting(true);
    try {
      await onSubmitProposal({
        base_version: versionNo,
        ops: pendingOps,
        summary: summary.trim(),
        reason: reason.trim() || undefined,
        origin,
        suggestion_id: suggestionId,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      });
      setPendingOps([]);
      setSummary("");
      setReason("");
      setRoaPrompt("");
      setSuggestionId(null);
      setExpiresAt("");
      setEditMode(false);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Không gửi được đề xuất.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const exitEditMode = () => {
    setEditMode(false);
    setPendingOps([]);
    setEditingItemId(null);
    setAddingItem(false);
    setErrorMsg(null);
  };

  return (
    <section aria-label="Lịch trình chuyến đi" className="space-y-4 min-w-0">
      {!isCurrent ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-hairline bg-surface px-4 py-3 text-[14px] text-ink shadow-notion-1">
          <p className="flex items-center gap-2">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent-orange" />
            <span>
              Đang xem lịch sử phiên bản <strong>v{versionNo}</strong> (chỉ đọc).
            </span>
          </p>
          {onReturnToCurrent ? (
            <button
              type="button"
              onClick={onReturnToCurrent}
              className="min-h-9 rounded-[8px] border border-hairline bg-surface px-3.5 py-1 text-[13px] font-medium text-ink hover:bg-canvas-soft transition-colors"
            >
              Quay về bản hiện tại
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Summary metrics from backend */}
      <div className="grid grid-cols-1 gap-4 rounded-[12px] border border-hairline bg-surface p-5 sm:grid-cols-3">
        <div>
          <p className="text-[12px] text-ink-muted">Tổng chi phí / người</p>
          <p className="mt-1 text-[20px] font-semibold tracking-[-0.125px] text-ink tabular-nums">
            {formatVnd(computed.total_cost_per_person)}
          </p>
        </div>
        <div>
          <p className="text-[12px] text-ink-muted">
            Ngày {activeDayObj?.day ?? 1} · di chuyển ước tính
          </p>
          <p className="mt-1 text-[20px] font-semibold tracking-[-0.125px] text-ink tabular-nums">
            {formatDurationMinutes(activeDayMetrics?.travel_minutes ?? 0)}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
          {isLeader && isCurrent ? (
            editMode ? (
              <button
                type="button"
                onClick={exitEditMode}
                className="min-h-10 rounded-[8px] border border-hairline bg-surface px-3.5 py-2 text-[14px] font-medium text-ink hover:bg-canvas-soft transition-colors"
              >
                Thoát chế độ sửa
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setEditMode(true)}
                className="min-h-10 rounded-[8px] bg-primary active:bg-primary-active px-4 py-2 text-[14px] font-medium text-on-primary transition-colors"
              >
                Sửa &amp; tạo đề xuất
              </button>
            )
          ) : null}
          {!isLeader && isCurrent && onOpenSuggestionModal ? (
            <button
              type="button"
              onClick={() => onOpenSuggestionModal(activeDayObj?.day ?? 1)}
              className="min-h-10 rounded-[8px] border border-hairline bg-surface px-3.5 py-2 text-[14px] font-medium text-ink hover:bg-canvas-soft transition-colors"
            >
              Gửi góp ý ngày {activeDayObj?.day ?? 1}
            </button>
          ) : null}
        </div>
      </div>

      {/* Leader Edit Mode Toolbar */}
      {isLeader && isCurrent && editMode ? (
        <div className="rounded-[12px] border border-hairline bg-surface p-5 space-y-4 shadow-notion-1">
          <div className="flex flex-wrap items-center justify-between gap-2 border-l-2 border-primary pl-3">
            <div>
              <p className="text-[15px] font-semibold text-ink">
                Đang sửa từ phiên bản v{versionNo}
              </p>
              <p className="text-[13px] text-ink-muted">
                Thay đổi được gom thành thao tác để gửi nhóm bỏ phiếu, không sửa đè bản hiện tại.
              </p>
            </div>
            <span className="rounded-full border border-hairline bg-canvas-soft px-3 py-1 type-eyebrow text-primary tabular-nums">
              {pendingOps.length} thao tác chờ gửi
            </span>
          </div>

          {/* Ask Roa to draft ops */}
          <div className="rounded-[8px] border border-hairline bg-canvas-soft p-3.5 space-y-2">
            <label
              htmlFor="roa-draft-input"
              className="block text-[13px] font-semibold text-ink"
            >
              Nhờ Roa soạn đề xuất thay đổi (tuỳ chọn)
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="roa-draft-input"
                type="text"
                value={roaPrompt}
                onChange={(e) => setRoaPrompt(e.target.value)}
                placeholder="Ví dụ: Đưa Dinh Bảo Đại III sang sáng ngày 2…"
                className="notion-input min-h-11 flex-1 px-3 py-1.5 text-[15px]"
              />
              <button
                type="button"
                disabled={roaDrafting}
                onClick={() => void handleAskRoaDraft()}
                className="min-h-11 shrink-0 rounded-[8px] border border-hairline bg-surface px-4 py-2 text-[14px] font-medium text-primary hover:bg-canvas-soft disabled:opacity-60 transition-colors"
              >
                {roaDrafting ? "Roa đang soạn…" : "Nhờ Roa soạn"}
              </button>
            </div>
          </div>

          {errorMsg ? (
            <StatusBanner
              tone="error"
              message={errorMsg}
              onDismiss={() => setErrorMsg(null)}
            />
          ) : null}

          {pendingOps.length > 0 ? (
            <form
              onSubmit={(e) => void handleSubmitProposal(e)}
              className="space-y-3 rounded-[8px] border border-hairline bg-canvas-soft p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-[14px] font-semibold text-ink">
                  Bản nháp đề xuất ({pendingOps.length} thao tác)
                </p>
                <button
                  type="button"
                  onClick={() => setPendingOps([])}
                  className="text-[13px] font-medium text-accent-orange-deep hover:underline"
                >
                  Xoá hết thao tác
                </button>
              </div>
              <ul className="space-y-1.5 text-[13px] text-ink-secondary">
                {pendingOps.map((op, index) => (
                  <li
                    key={`${op.op}-${index}`}
                    className="flex items-center justify-between gap-2 rounded-[5px] border border-hairline bg-surface px-3 py-1.5"
                  >
                    <span className="truncate">
                      {op.op === "add_item" &&
                        `Thêm "${op.item.name}" vào ngày ${op.day}`}
                      {op.op === "update_item" && `Cập nhật mục ${op.item_id}`}
                      {op.op === "remove_item" && `Xoá mục ${op.item_id}`}
                      {op.op === "move_item" &&
                        `Chuyển mục ${op.item_id} sang ngày ${op.to_day}`}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingOps((prev) =>
                          prev.filter((_, idx) => idx !== index),
                        )
                      }
                      className="shrink-0 text-[12px] text-ink-muted hover:text-accent-orange-deep"
                    >
                      Bỏ
                    </button>
                  </li>
                ))}
              </ul>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="prop-summary"
                    className="block text-[13px] font-semibold text-ink mb-1"
                  >
                    Tóm tắt đề xuất *
                  </label>
                  <input
                    id="prop-summary"
                    type="text"
                    required
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Ví dụ: Chuyển Dinh Bảo Đại III sang ngày 2…"
                    className="notion-input min-h-11 w-full px-3 py-1.5 text-[15px]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="prop-expires"
                    className="block text-[13px] font-semibold text-ink mb-1"
                  >
                    Hạn biểu quyết (tuỳ chọn)
                  </label>
                  <input
                    id="prop-expires"
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                    className="notion-input min-h-11 w-full px-3 py-1.5 text-[15px]"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="prop-reason"
                  className="block text-[13px] font-semibold text-ink mb-1"
                >
                  Lý do (tuỳ chọn)
                </label>
                <input
                  id="prop-reason"
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Vì sao đề xuất thay đổi này…"
                  className="notion-input min-h-11 w-full px-3 py-1.5 text-[15px]"
                />
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="min-h-11 rounded-[8px] bg-primary active:bg-primary-active px-4 py-2 text-[15px] font-medium text-on-primary disabled:opacity-60 transition-colors"
                >
                  {submitting
                    ? "Đang gửi đề xuất…"
                    : "Gửi đề xuất cho cả nhóm"}
                </button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}

      {/* Backend warnings */}
      {computed.warnings.length > 0 ? (
        <div className="space-y-2">
          {computed.warnings.map((w, i) => (
            <StatusBanner
              key={`${w.item_id}-${i}`}
              tone="warning"
              message={w.message}
            />
          ))}
        </div>
      ) : null}

      {/* Day selector tabs */}
      <div
        role="tablist"
        aria-label="Chọn ngày trong lịch trình"
        className="flex gap-2 overflow-x-auto pb-1"
      >
        {plan.days.map((day) => {
          const isActive = day.day === activeDayObj?.day;
          const dayCost =
            computed.per_day.find((d) => d.day === day.day)?.cost_per_person ?? 0;
          return (
            <button
              key={day.day}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setSelectedDay(day.day)}
              className={`min-h-11 shrink-0 rounded-[8px] border px-4 py-2 text-left transition-colors ${
                isActive
                  ? "border-primary bg-primary text-on-primary"
                  : "border-hairline bg-surface text-ink hover:bg-canvas-soft"
              }`}
            >
              <span className="block text-[14px] font-semibold">
                Ngày {day.day} · {formatDate(day.date)}
              </span>
              <span
                className={`block text-[12px] tabular-nums ${
                  isActive ? "text-on-primary/85" : "text-ink-muted"
                }`}
              >
                {formatVnd(dayCost)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active day timeline card */}
      {activeDayObj ? (
        <div className="rounded-[12px] border border-hairline bg-surface p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline pb-4">
            <div>
              <h2 className="type-heading-3 text-ink">
                Ngày {activeDayObj.day}: {activeDayObj.title}
              </h2>
              <p className="mt-0.5 text-[14px] text-ink-muted">
                {formatDate(activeDayObj.date)} · Phương tiện: {plan.transport}
              </p>
            </div>
            {isLeader && isCurrent && editMode ? (
              <button
                type="button"
                onClick={() => setAddingItem((v) => !v)}
                className="min-h-10 rounded-[8px] border border-hairline bg-surface px-3.5 py-1.5 text-[14px] font-medium text-primary hover:bg-canvas-soft transition-colors"
              >
                {addingItem ? "Đóng form thêm" : "+ Thêm điểm mới"}
              </button>
            ) : null}
          </div>

          {isLeader && isCurrent && editMode && addingItem ? (
            <div className="mt-4 rounded-[8px] border border-hairline bg-canvas-soft p-4 space-y-3">
              <p className="text-[14px] font-semibold text-ink">
                Thêm địa điểm vào Ngày {activeDayObj.day}
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="new-item-name"
                    className="block text-[13px] font-medium text-ink mb-1"
                  >
                    Tên địa điểm *
                  </label>
                  <input
                    id="new-item-name"
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Ví dụ: Quán nướng Chu…"
                    className="notion-input min-h-11 w-full px-3 py-1.5 text-[15px]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="new-item-kind"
                    className="block text-[13px] font-medium text-ink mb-1"
                  >
                    Loại hoạt động
                  </label>
                  <select
                    id="new-item-kind"
                    value={newKind}
                    onChange={(e) => setNewKind(e.target.value as PlanItemKind)}
                    className="notion-input min-h-11 w-full px-3 py-1.5 text-[15px]"
                  >
                    {Object.entries(KIND_META).map(([k, meta]) => (
                      <option key={k} value={k}>
                        {meta.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="new-item-start"
                    className="block text-[13px] font-medium text-ink mb-1"
                  >
                    Bắt đầu
                  </label>
                  <input
                    id="new-item-start"
                    type="time"
                    value={newStart}
                    onChange={(e) => setNewStart(e.target.value)}
                    className="notion-input min-h-11 w-full px-3 py-1.5 text-[15px] tabular-nums"
                  />
                </div>
                <div>
                  <label
                    htmlFor="new-item-end"
                    className="block text-[13px] font-medium text-ink mb-1"
                  >
                    Kết thúc
                  </label>
                  <input
                    id="new-item-end"
                    type="time"
                    value={newEnd}
                    onChange={(e) => setNewEnd(e.target.value)}
                    className="notion-input min-h-11 w-full px-3 py-1.5 text-[15px] tabular-nums"
                  />
                </div>
                <div>
                  <label
                    htmlFor="new-item-cost"
                    className="block text-[13px] font-medium text-ink mb-1"
                  >
                    Chi phí / người (VND)
                  </label>
                  <input
                    id="new-item-cost"
                    type="text"
                    inputMode="numeric"
                    value={newCost}
                    onChange={(e) => setNewCost(e.target.value)}
                    className="notion-input min-h-11 w-full px-3 py-1.5 text-[15px] tabular-nums"
                  />
                </div>
                <div>
                  <label
                    htmlFor="new-item-address"
                    className="block text-[13px] font-medium text-ink mb-1"
                  >
                    Địa chỉ
                  </label>
                  <input
                    id="new-item-address"
                    type="text"
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    placeholder="Số nhà, đường, phường…"
                    className="notion-input min-h-11 w-full px-3 py-1.5 text-[15px]"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="new-item-reason"
                  className="block text-[13px] font-medium text-ink mb-1"
                >
                  Lý do chọn
                </label>
                <input
                  id="new-item-reason"
                  type="text"
                  value={newReason}
                  onChange={(e) => setNewReason(e.target.value)}
                  placeholder="Phù hợp ngân sách, gần điểm trước…"
                  className="notion-input min-h-11 w-full px-3 py-1.5 text-[15px]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleAddNewItem}
                  className="min-h-10 rounded-[8px] bg-primary active:bg-primary-active px-4 py-2 text-[14px] font-medium text-on-primary transition-colors"
                >
                  Thêm vào bản nháp đề xuất
                </button>
              </div>
            </div>
          ) : null}

          {activeDayObj.items.length === 0 ? (
            <p className="py-10 text-center text-[15px] text-ink-muted">
              Ngày {activeDayObj.day} chưa có hoạt động nào.
            </p>
          ) : (
            <ol className="mt-5 space-y-4 border-l border-hairline pl-5 ml-2">
              {activeDayObj.items.map((item) => {
                const itemWarnings = computed.warnings.filter(
                  (w) => w.item_id === item.id,
                );
                const isEditingThis = editingItemId === item.id;
                const kindMeta = KIND_META[item.kind];

                return (
                  <li key={item.id} className="relative">
                    <span
                      aria-hidden="true"
                      className={`absolute -left-[25px] top-4 h-2.5 w-2.5 rounded-full ${kindMeta.dot}`}
                    />

                    <div className="rounded-[12px] border border-hairline bg-surface p-4 space-y-2.5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-[12px] text-ink-muted">
                            <span className="font-semibold text-primary tabular-nums">
                              {item.start} – {item.end}
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-[5px] bg-canvas-soft px-2 py-0.5 font-medium text-ink-secondary">
                              <span
                                aria-hidden="true"
                                className={`h-1.5 w-1.5 rounded-full ${kindMeta.dot}`}
                              />
                              {kindMeta.label}
                            </span>
                            {item.sources.map((src, sIdx) => (
                              <span
                                key={`${src.type}-${sIdx}`}
                                className="rounded-[4px] border border-hairline bg-surface px-2 py-0.5 text-[11px] text-ink-muted"
                              >
                                {SOURCE_LABELS[src.type] ?? src.type}
                              </span>
                            ))}
                          </div>
                          <h3 className="mt-1.5 text-[17px] font-semibold tracking-[-0.125px] text-ink break-words">
                            {item.name}
                          </h3>
                          <p className="text-[13px] text-ink-muted break-words">
                            {item.address}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-[15px] font-semibold text-ink tabular-nums">
                            {formatVnd(item.cost_per_person)}
                          </span>
                          <span className="block text-[12px] text-ink-faint">
                            / người
                          </span>
                        </div>
                      </div>

                      {item.reason ? (
                        <p className="text-[14px] text-ink-secondary">
                          <span className="font-semibold text-ink">Lý do:</span>{" "}
                          {item.reason}
                        </p>
                      ) : null}

                      {item.note ? (
                        <p className="text-[13px] text-ink-muted">
                          Ghi chú: {item.note}
                        </p>
                      ) : null}

                      {itemWarnings.map((w, idx) => (
                        <p
                          key={idx}
                          className="flex items-center gap-2 rounded-[5px] border border-hairline bg-canvas-soft px-3 py-1.5 text-[13px] font-medium text-accent-orange-deep"
                        >
                          <span
                            aria-hidden="true"
                            className="h-2 w-2 shrink-0 rounded-full bg-accent-orange"
                          />
                          <span>{w.message}</span>
                        </p>
                      ))}

                      {isCurrent ? (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {isLeader && editMode ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  openEditorForItem(item, activeDayObj.day)
                                }
                                className="min-h-9 rounded-[8px] border border-hairline bg-surface px-3 py-1 text-[13px] font-medium text-ink hover:bg-canvas-soft transition-colors"
                              >
                                Chỉnh mục này
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(item)}
                                className="min-h-9 rounded-[8px] border border-hairline bg-surface px-3 py-1 text-[13px] font-medium text-accent-orange-deep hover:bg-canvas-soft transition-colors"
                              >
                                Đánh dấu xoá
                              </button>
                            </>
                          ) : null}

                          {!isLeader && onOpenSuggestionModal ? (
                            <button
                              type="button"
                              onClick={() =>
                                onOpenSuggestionModal(activeDayObj.day, item)
                              }
                              className="min-h-9 rounded-[8px] border border-hairline bg-surface px-3 py-1 text-[13px] font-medium text-ink-muted hover:text-primary hover:bg-canvas-soft transition-colors"
                            >
                              Góp ý mục này
                            </button>
                          ) : null}
                        </div>
                      ) : null}

                      {isEditingThis ? (
                        <div className="mt-3 rounded-[8px] border border-hairline bg-canvas-soft p-3.5 space-y-3">
                          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                            <div>
                              <label
                                htmlFor={`start-${item.id}`}
                                className="block text-[12px] font-medium text-ink mb-1"
                              >
                                Giờ bắt đầu
                              </label>
                              <input
                                id={`start-${item.id}`}
                                type="time"
                                value={editStart}
                                onChange={(e) => setEditStart(e.target.value)}
                                className="notion-input min-h-10 w-full px-2.5 py-1.5 text-[14px] tabular-nums"
                              />
                            </div>
                            <div>
                              <label
                                htmlFor={`end-${item.id}`}
                                className="block text-[12px] font-medium text-ink mb-1"
                              >
                                Giờ kết thúc
                              </label>
                              <input
                                id={`end-${item.id}`}
                                type="time"
                                value={editEnd}
                                onChange={(e) => setEditEnd(e.target.value)}
                                className="notion-input min-h-10 w-full px-2.5 py-1.5 text-[14px] tabular-nums"
                              />
                            </div>
                            <div>
                              <label
                                htmlFor={`cost-${item.id}`}
                                className="block text-[12px] font-medium text-ink mb-1"
                              >
                                Chi phí / người (VND)
                              </label>
                              <input
                                id={`cost-${item.id}`}
                                type="text"
                                inputMode="numeric"
                                value={editCost}
                                onChange={(e) => setEditCost(e.target.value)}
                                className="notion-input min-h-10 w-full px-2.5 py-1.5 text-[14px] tabular-nums"
                              />
                            </div>
                            <div>
                              <label
                                htmlFor={`day-${item.id}`}
                                className="block text-[12px] font-medium text-ink mb-1"
                              >
                                Chuyển sang ngày
                              </label>
                              <select
                                id={`day-${item.id}`}
                                value={editTargetDay}
                                onChange={(e) =>
                                  setEditTargetDay(Number(e.target.value))
                                }
                                className="notion-input min-h-10 w-full px-2.5 py-1.5 text-[14px]"
                              >
                                {plan.days.map((d) => (
                                  <option key={d.day} value={d.day}>
                                    Ngày {d.day} ({formatDate(d.date)})
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div>
                            <label
                              htmlFor={`note-${item.id}`}
                              className="block text-[12px] font-medium text-ink mb-1"
                            >
                              Ghi chú
                            </label>
                            <input
                              id={`note-${item.id}`}
                              type="text"
                              value={editNote}
                              onChange={(e) => setEditNote(e.target.value)}
                              className="notion-input min-h-10 w-full px-2.5 py-1.5 text-[14px]"
                            />
                          </div>

                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingItemId(null)}
                              className="min-h-10 rounded-[8px] border border-hairline bg-surface px-3 py-1.5 text-[13px] font-medium text-ink-muted hover:text-ink transition-colors"
                            >
                              Đóng
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleSaveItemOps(item, activeDayObj.day)
                              }
                              className="min-h-10 rounded-[8px] bg-primary active:bg-primary-active px-3.5 py-1.5 text-[13px] font-medium text-on-primary transition-colors"
                            >
                              Lưu vào nháp đề xuất
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      ) : null}
    </section>
  );
}
