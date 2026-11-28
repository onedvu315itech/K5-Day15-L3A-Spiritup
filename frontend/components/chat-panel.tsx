"use client";

import { useState } from "react";
import { formatDateTime, formatSignedVnd } from "@/lib/format";
import { useLocale } from "@/lib/i18n";
import type { ChatMessage, DiffChange, DraftProposalResponse } from "@/lib/types";
import { StatusBanner } from "./status-banner";

function describeDraftChange(
  change: DiffChange,
  t: (vi: string, en: string) => string,
): string {
  if (change.type === "moved") {
    return t(
      `Chuyển "${change.name}": Ngày ${change.from.day} (${change.from.start}) → Ngày ${change.to.day} (${change.to.start})`,
      `Move "${change.name}": Day ${change.from.day} (${change.from.start}) → Day ${change.to.day} (${change.to.start})`,
    );
  }
  if (change.type === "added") {
    return t(
      `Thêm "${change.name}" (Ngày ${change.day})`,
      `Add "${change.name}" (Day ${change.day})`,
    );
  }
  if (change.type === "removed") {
    return t(
      `Xoá "${change.name}" (Ngày ${change.day})`,
      `Remove "${change.name}" (Day ${change.day})`,
    );
  }
  const fieldsText = Object.keys(change.fields).join(", ");
  return t(
    `Sửa "${change.name ?? change.item_id}" (${fieldsText || "thông tin"})`,
    `Edit "${change.name ?? change.item_id}" (${fieldsText || "details"})`,
  );
}

interface ChatPanelProps {
  messages: ChatMessage[];
  isLeader: boolean;
  currentVersion?: number;
  onSend: (text: string) => Promise<void>;
  onCreateSuggestionFromChat?: (prefill: string) => void;
  onCreateProposalFromDraft?: (draft: DraftProposalResponse) => Promise<{ number: number }>;
  onApplyDraftDirectly?: (draft: DraftProposalResponse) => Promise<{ new_version: number }>;
}

export function ChatPanel({
  messages,
  isLeader,
  currentVersion,
  onSend,
  onCreateSuggestionFromChat,
  onCreateProposalFromDraft,
  onApplyDraftDirectly,
}: ChatPanelProps) {
  const { t } = useLocale();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busyDraftId, setBusyDraftId] = useState<number | null>(null);
  const [draftDoneMap, setDraftDoneMap] = useState<Record<number, string>>({});

  const submitMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || sending) return;
    setErrorMsg(null);
    setSending(true);
    try {
      await onSend(trimmed);
      setInput("");
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Không gửi được câu hỏi cho Roa.",
      );
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void submitMessage();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      if (e.nativeEvent.isComposing) return;
      e.preventDefault();
      void submitMessage();
    }
  };

  const findRelatedMemberContent = (index: number): string => {
    for (let i = index - 1; i >= 0; i -= 1) {
      if (messages[i].role === "member") return messages[i].content;
    }
    return "";
  };

  const handleDraftAction = async (
    msgId: number,
    fn: () => Promise<string>,
  ) => {
    setErrorMsg(null);
    setBusyDraftId(msgId);
    try {
      const doneText = await fn();
      setDraftDoneMap((prev) => ({ ...prev, [msgId]: doneText }));
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Không thể thực hiện thay đổi lịch trình.",
      );
    } finally {
      setBusyDraftId(null);
    }
  };

  return (
    <section aria-label={t("Hỏi đáp chung với Roa", "Shared Q&A with Roa")} className="flex flex-col gap-3">
      <div className="rounded-[8px] border border-hairline bg-canvas-soft px-3 py-2 text-[13px] text-ink-muted">
        {t(
          "Hội thoại chung của cả nhóm. Roa trả lời dựa trên phiên bản hiện tại và soạn thay đổi chờ bạn duyệt.",
          "Shared group conversation. Roa answers based on the current version and drafts edits for your approval.",
        )}
      </div>

      {errorMsg ? (
        <StatusBanner
          tone="error"
          message={errorMsg}
          onDismiss={() => setErrorMsg(null)}
        />
      ) : null}

      <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <div className="rounded-[16px] border border-dashed border-hairline bg-canvas-soft p-8 text-center text-[15px] text-ink-muted">
            {t(
              "Chưa có câu hỏi nào. Hãy hỏi Roa về thời gian di chuyển, chi phí hoặc phương án dự phòng khi trời mưa.",
              "No questions yet. Ask Roa about transit time, budget, or rainy-day backups.",
            )}
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isAgent = msg.role === "agent";
            return (
              <div
                key={msg.id}
                className={`rounded-[12px] border p-3.5 text-[14px] ${
                  isAgent
                    ? "border-hairline bg-surface shadow-card"
                    : "border-hairline bg-canvas-soft"
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[12px] text-ink-muted">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                    {isAgent ? (
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 rounded-full bg-secondary"
                      />
                    ) : null}
                    {isAgent ? "Roa" : msg.author_name ?? t("Thành viên", "Member")}
                  </span>
                  <span className="tabular-nums text-ink-faint">
                    {msg.plan_version ? `v${msg.plan_version} · ` : ""}
                    {formatDateTime(msg.created_at)}
                  </span>
                </div>
                <p className="mt-1.5 whitespace-pre-wrap break-words text-ink-secondary leading-relaxed">
                  {msg.content}
                </p>

                {isAgent && msg.draft_proposal ? (() => {
                  const draft = msg.draft_proposal;
                  const doneText = draftDoneMap[msg.id];
                  const isBusy = busyDraftId === msg.id;
                  const isStaleVersion =
                    currentVersion != null && draft.base_version !== currentVersion;
                  return (
                    <div className="mt-3 rounded-[8px] border border-secondary/30 bg-canvas-soft p-3 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
                        <span className="font-semibold text-secondary">
                          {t("Bản nháp sửa lịch", "Draft itinerary edit")} (v{draft.base_version})
                        </span>
                        <span className="font-medium text-ink-muted tabular-nums">
                          {formatSignedVnd(draft.preview.cost_delta_per_person)}
                        </span>
                      </div>
                      <p className="text-[13px] font-medium text-ink">{draft.summary}</p>
                      {draft.preview.changes.length > 0 ? (
                        <ul className="space-y-0.5 text-[12px] text-ink-secondary">
                          {draft.preview.changes.map((c, cIdx) => (
                            <li key={`${c.item_id}-${cIdx}`}>• {describeDraftChange(c, t)}</li>
                          ))}
                        </ul>
                      ) : null}
                      {draft.warnings.length > 0 ? (
                        <ul className="space-y-0.5 text-[12px] text-warning">
                          {draft.warnings.map((w, wIdx) => (
                            <li key={wIdx}>⚠ {w.message}</li>
                          ))}
                        </ul>
                      ) : null}

                      {doneText ? (
                        <p className="text-[12px] font-semibold text-success">
                          ✓ {doneText}
                        </p>
                      ) : isStaleVersion ? (
                        <p className="text-[12px] text-ink-muted">
                          {t(
                            `Lịch đã chuyển sang v${currentVersion}; hãy nhắn lại nếu muốn soạn tiếp trên bản mới.`,
                            `Plan is now on v${currentVersion}; send another message to draft from the latest version.`,
                          )}
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {isLeader && onApplyDraftDirectly ? (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                void handleDraftAction(msg.id, async () => {
                                  const res = await onApplyDraftDirectly(draft);
                                  return t(
                                    `Đã cập nhật lịch trình thành v${res.new_version}`,
                                    `Updated itinerary to v${res.new_version}`,
                                  );
                                })
                              }
                              className="inline-flex min-h-9 items-center rounded-[5px] bg-primary active:bg-primary-active px-3 py-1.5 text-[13px] font-semibold text-on-primary disabled:opacity-60 transition-colors"
                            >
                              {isBusy
                                ? t("Đang cập nhật…", "Applying…")
                                : t(
                                    `Áp dụng thành v${draft.base_version + 1}`,
                                    `Apply as v${draft.base_version + 1}`,
                                  )}
                            </button>
                          ) : null}
                          {onCreateProposalFromDraft ? (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                void handleDraftAction(msg.id, async () => {
                                  const prop = await onCreateProposalFromDraft(draft);
                                  return t(
                                    `Đã tạo đề xuất #${prop.number} cho nhóm`,
                                    `Created proposal #${prop.number}`,
                                  );
                                })
                              }
                              className="inline-flex min-h-9 items-center rounded-[5px] border border-hairline bg-surface px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-canvas-soft disabled:opacity-60 transition-colors"
                            >
                              {isLeader
                                ? t("Gửi đề xuất cho nhóm", "Create group proposal")
                                : t("Tạo đề xuất cho nhóm", "Create group proposal")}
                            </button>
                          ) : null}
                        </div>
                      )}
                    </div>
                  );
                })() : null}

                {isAgent &&
                msg.suggest_feedback &&
                !msg.draft_proposal &&
                !isLeader &&
                onCreateSuggestionFromChat ? (
                  <button
                    type="button"
                    onClick={() =>
                      onCreateSuggestionFromChat(findRelatedMemberContent(idx))
                    }
                    className="mt-2.5 inline-flex min-h-9 items-center rounded-[5px] border border-secondary/35 bg-surface px-3 py-1 text-[13px] font-medium text-secondary hover:bg-canvas-soft transition-colors"
                  >
                    {t("Gửi góp ý cho nhóm trưởng", "Send feedback to leader")}
                  </button>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-2 border-t border-hairline pt-3"
      >
        <label
          htmlFor="roa-chat-input"
          className="block text-[13px] font-semibold text-ink"
        >
          {t("Hỏi Roa về lịch trình", "Ask Roa about the itinerary")}
        </label>
        <textarea
          id="roa-chat-input"
          name="message"
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t(
            "Ví dụ: Ngày 2 đi lại tổng bao lâu?…",
            "Example: How long is total transit on Day 2?…",
          )}
          className="nomad-input w-full px-3 py-2 text-[15px]"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] text-ink-faint">
            {t("Nhấn Enter để gửi", "Press Enter to send")}
          </span>
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="min-h-10 rounded-[5px] bg-primary active:bg-primary-active px-4 py-1.5 text-[14px] font-semibold text-on-primary disabled:opacity-60 transition-colors"
          >
            {sending
              ? t("Roa đang trả lời…", "Roa is replying…")
              : t("Gửi câu hỏi", "Send question")}
          </button>
        </div>
      </form>
    </section>
  );
}
