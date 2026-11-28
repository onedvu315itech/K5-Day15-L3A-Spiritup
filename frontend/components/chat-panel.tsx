"use client";

import { useState } from "react";
import { formatDateTime } from "@/lib/format";
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
    <section aria-label="Hỏi đáp chung với Roa" className="flex flex-col gap-3">
      <div className="rounded-[8px] border border-hairline bg-canvas-soft px-3 py-2 text-[13px] text-ink-muted">
        Hội thoại chung của cả nhóm. Roa trả lời dựa trên phiên bản hiện tại và không tự sửa lịch trình.
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
            Chưa có câu hỏi nào. Hãy hỏi Roa về thời gian di chuyển, chi phí hoặc phương án dự phòng khi trời mưa.
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isAgent = msg.role === "agent";
            return (
              <div
                key={msg.id}
                className={`rounded-[12px] border p-3.5 text-[14px] ${
                  isAgent
                    ? "border-hairline bg-surface shadow-notion-1"
                    : "border-hairline bg-canvas-soft"
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[12px] text-ink-muted">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                    {isAgent ? (
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 rounded-full bg-accent-purple ring-1 ring-accent-purple-deep/40"
                      />
                    ) : null}
                    {isAgent ? "Roa" : msg.author_name ?? "Thành viên"}
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
                    className="mt-2.5 inline-flex min-h-9 items-center rounded-[8px] border border-hairline bg-surface px-3 py-1 text-[13px] font-medium text-primary hover:bg-canvas-soft transition-colors"
                  >
                    Gửi góp ý cho nhóm trưởng
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
          Hỏi Roa về lịch trình
        </label>
        <textarea
          id="roa-chat-input"
          name="message"
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ví dụ: Ngày 2 đi lại tổng bao lâu?…"
          className="notion-input w-full px-3 py-2 text-[15px]"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] text-ink-faint">Nhấn Enter để gửi</span>
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="min-h-10 rounded-[8px] bg-primary active:bg-primary-active px-4 py-1.5 text-[14px] font-medium text-on-primary disabled:opacity-60 transition-colors"
          >
            {sending ? "Roa đang trả lời…" : "Gửi câu hỏi"}
          </button>
        </div>
      </form>
    </section>
  );
}
