"use client";

import { useState } from "react";
import { formatDateTime } from "@/lib/format";
import { useLocale } from "@/lib/i18n";
import type { ChatMessage } from "@/lib/types";
import { StatusBanner } from "./status-banner";

interface ChatPanelProps {
  messages: ChatMessage[];
  isLeader: boolean;
  onSend: (text: string) => Promise<void>;
  onCreateSuggestionFromChat?: (prefill: string) => void;
}

export function ChatPanel({
  messages,
  isLeader,
  onSend,
  onCreateSuggestionFromChat,
}: ChatPanelProps) {
  const { t } = useLocale();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  return (
    <section aria-label={t("Hỏi đáp chung với Roa", "Shared Q&A with Roa")} className="flex flex-col gap-3">
      <div className="rounded-[8px] border border-hairline bg-canvas-soft px-3 py-2 text-[13px] text-ink-muted">
        {t(
          "Hội thoại chung của cả nhóm. Roa trả lời dựa trên phiên bản hiện tại và không tự sửa lịch trình.",
          "Shared group conversation. Roa answers based on the current version and never edits the plan.",
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

                {isAgent &&
                msg.suggest_feedback &&
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
