"use client";

import { useState } from "react";
import { formatDateTime, formatSignedVnd } from "@/lib/format";
import type { DiffChange, Proposal, VoteValue } from "@/lib/types";
import { ConfirmDialog } from "./confirm-dialog";
import { StatusBanner } from "./status-banner";

const STATUS_BADGES: Record<
  Proposal["status"],
  { label: string; dot: string; style: string }
> = {
  open: {
    label: "Đang mở",
    dot: "bg-primary",
    style: "bg-canvas-soft text-ink border-hairline",
  },
  applied: {
    label: "Đã áp dụng",
    dot: "bg-accent-green",
    style: "bg-canvas-soft text-ink border-hairline",
  },
  reference: {
    label: "Để tham khảo",
    dot: "bg-ink-faint",
    style: "bg-canvas-soft text-ink-muted border-hairline",
  },
  stale: {
    label: "Đã cũ (trùng mục)",
    dot: "bg-accent-orange",
    style: "bg-canvas-soft text-accent-orange-deep border-hairline",
  },
  withdrawn: {
    label: "Đã rút",
    dot: "bg-ink-faint",
    style: "bg-canvas-soft text-ink-muted border-hairline",
  },
};

const ORIGIN_LABELS: Record<Proposal["origin"], string> = {
  manual: "Nhóm trưởng sửa",
  agent: "Roa soạn",
  suggestion: "Từ góp ý",
};

function describeChange(change: DiffChange): string {
  if (change.type === "moved") {
    return `Chuyển "${change.name}": Ngày ${change.from.day} (${change.from.start}) sang Ngày ${change.to.day} (${change.to.start})`;
  }
  if (change.type === "added") {
    return `Thêm "${change.name}" vào Ngày ${change.day}`;
  }
  if (change.type === "removed") {
    return `Xoá "${change.name}" ở Ngày ${change.day}`;
  }
  const fieldsText = Object.keys(change.fields).join(", ");
  return `Sửa "${change.name ?? change.item_id}" (${fieldsText || "thông tin"})`;
}

interface ProposalPanelProps {
  proposals: Proposal[];
  isLeader: boolean;
  onVote: (proposalId: string, value: VoteValue) => Promise<void>;
  onApply: (proposalId: string) => Promise<void>;
  onClose: (proposalId: string) => Promise<void>;
  onWithdraw: (proposalId: string) => Promise<void>;
}

export function ProposalPanel({
  proposals,
  isLeader,
  onVote,
  onApply,
  onClose,
  onWithdraw,
}: ProposalPanelProps) {
  const [filter, setFilter] = useState<"open" | "closed">("open");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<Proposal | null>(null);

  const visible = proposals.filter((p) =>
    filter === "open" ? p.status === "open" : p.status !== "open",
  );

  const runAction = async (id: string, fn: () => Promise<void>) => {
    setErrorMsg(null);
    setBusyId(id);
    try {
      await fn();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Thao tác thất bại.");
    } finally {
      setBusyId(null);
    }
  };

  const handleApplyClick = (proposal: Proposal) => {
    if (!proposal.votes.majority) {
      setConfirmTarget(proposal);
      return;
    }
    void runAction(proposal.id, () => onApply(proposal.id));
  };

  return (
    <section aria-label="Đề xuất và bỏ phiếu" className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div
          role="tablist"
          aria-label="Lọc đề xuất"
          className="inline-flex rounded-[8px] border border-hairline bg-canvas-soft p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={filter === "open"}
            onClick={() => setFilter("open")}
            className={`min-h-9 rounded-[5px] px-3 py-1 text-[13px] font-medium transition-colors ${
              filter === "open"
                ? "bg-surface text-ink shadow-notion-1"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            Đang mở ({proposals.filter((p) => p.status === "open").length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === "closed"}
            onClick={() => setFilter("closed")}
            className={`min-h-9 rounded-[5px] px-3 py-1 text-[13px] font-medium transition-colors ${
              filter === "closed"
                ? "bg-surface text-ink shadow-notion-1"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            Đã đóng ({proposals.filter((p) => p.status !== "open").length})
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

      {visible.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-hairline bg-canvas-soft p-8 text-center text-[15px] text-ink-muted">
          {filter === "open"
            ? "Hiện chưa có đề xuất nào đang chờ biểu quyết."
            : "Chưa có đề xuất nào đã đóng."}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((proposal) => {
            const badge = STATUS_BADGES[proposal.status];
            const voteStats = proposal.votes_at_decision ?? proposal.votes;
            const totalMembers = proposal.votes.total_members || 1;
            const agreeWidth = Math.min(
              100,
              Math.round((voteStats.agree / totalMembers) * 100),
            );
            const isBusy = busyId === proposal.id;

            return (
              <article
                key={proposal.id}
                className="rounded-[12px] border border-hairline bg-surface p-4 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-ink-muted">
                      <span className="font-semibold text-ink tabular-nums">
                        Đề xuất #{proposal.number}
                      </span>
                      <span>· {ORIGIN_LABELS[proposal.origin]}</span>
                      <span className="tabular-nums">· Từ v{proposal.base_version}</span>
                    </div>
                    <h3 className="mt-1 text-[15px] font-semibold text-ink break-words">
                      {proposal.summary}
                    </h3>
                  </div>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 type-eyebrow ${badge.style}`}
                  >
                    <span
                      aria-hidden="true"
                      className={`h-1.5 w-1.5 rounded-full ${badge.dot}`}
                    />
                    {badge.label}
                  </span>
                </div>

                {proposal.reason ? (
                  <p className="text-[13px] text-ink-muted">{proposal.reason}</p>
                ) : null}

                {proposal.suggestion ? (
                  <p className="text-[12px] font-medium text-primary">
                    Từ góp ý của {proposal.suggestion.author}
                  </p>
                ) : null}

                {/* Diff preview */}
                <div className="rounded-[8px] border border-hairline bg-canvas-soft p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="font-semibold text-ink">
                      Thay đổi dự kiến
                    </span>
                    <span className="font-medium text-ink-muted tabular-nums">
                      {formatSignedVnd(proposal.preview.cost_delta_per_person)}
                    </span>
                  </div>
                  {proposal.preview.changes.length === 0 ? (
                    <p className="text-[12px] text-ink-muted">
                      Khôi phục nội dung phiên bản v{proposal.target_version}
                    </p>
                  ) : (
                    <ul className="space-y-1 text-[12px] text-ink-secondary">
                      {proposal.preview.changes.map((c, idx) => (
                        <li key={`${c.item_id}-${idx}`}>• {describeChange(c)}</li>
                      ))}
                    </ul>
                  )}
                </div>

                {proposal.warnings.length > 0 ? (
                  <div className="space-y-1">
                    {proposal.warnings.map((w, idx) => (
                      <p
                        key={idx}
                        className="rounded-[5px] border border-hairline bg-canvas-soft px-2.5 py-1.5 text-[12px] text-accent-orange-deep"
                      >
                        {w.message}
                      </p>
                    ))}
                  </div>
                ) : null}

                {/* Public Vote Bar */}
                <div className="space-y-2 border-t border-hairline pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
                    <span className="font-semibold text-ink tabular-nums">
                      {voteStats.agree} đồng ý · {voteStats.disagree} không đồng ý (cần {voteStats.required})
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                      <span
                        aria-hidden="true"
                        className={`h-2 w-2 rounded-full ${
                          voteStats.majority ? "bg-accent-green" : "bg-accent-orange"
                        }`}
                      />
                      {voteStats.majority ? "Đạt đa số" : "Chưa đạt đa số"}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-canvas-soft">
                    <div
                      className="h-full bg-primary transition-[width]"
                      style={{ width: `${agreeWidth}%` }}
                    />
                  </div>
                  {proposal.voters && proposal.voters.length > 0 ? (
                    <p className="text-[12px] text-ink-muted">
                      Đã bỏ phiếu:{" "}
                      {proposal.voters
                        .map(
                          (v) =>
                            `${v.member.display_name} (${
                              v.value === "agree" ? "Đồng ý" : "Không"
                            })`,
                        )
                        .join(", ")}
                    </p>
                  ) : null}
                  {voteStats.pending.length > 0 ? (
                    <p className="text-[12px] text-ink-faint">
                      Chưa bỏ phiếu: {voteStats.pending.join(", ")}
                    </p>
                  ) : null}
                  {proposal.expires_at ? (
                    <p className="text-[12px] text-ink-muted tabular-nums">
                      Hạn: {formatDateTime(proposal.expires_at)}
                    </p>
                  ) : null}
                </div>

                {/* Member voting controls */}
                {proposal.status === "open" ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      disabled={isBusy}
                      aria-pressed={proposal.my_vote === "agree"}
                      onClick={() =>
                        void runAction(proposal.id, () =>
                          onVote(proposal.id, "agree"),
                        )
                      }
                      className={`min-h-10 flex-1 rounded-[8px] border px-3 py-1.5 text-[13px] font-medium transition-colors disabled:opacity-60 ${
                        proposal.my_vote === "agree"
                          ? "border-primary bg-primary text-on-primary"
                          : "border-hairline bg-surface text-ink hover:bg-canvas-soft"
                      }`}
                    >
                      Đồng ý
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      aria-pressed={proposal.my_vote === "disagree"}
                      onClick={() =>
                        void runAction(proposal.id, () =>
                          onVote(proposal.id, "disagree"),
                        )
                      }
                      className={`min-h-10 flex-1 rounded-[8px] border px-3 py-1.5 text-[13px] font-medium transition-colors disabled:opacity-60 ${
                        proposal.my_vote === "disagree"
                          ? "border-ink-secondary bg-ink-secondary text-on-primary"
                          : "border-hairline bg-surface text-ink hover:bg-canvas-soft"
                      }`}
                    >
                      Không đồng ý
                    </button>
                  </div>
                ) : null}

                {/* Leader-only decision controls */}
                {isLeader && proposal.status === "open" ? (
                  <div className="flex flex-wrap gap-2 border-t border-hairline pt-2.5">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleApplyClick(proposal)}
                      className="min-h-10 rounded-[8px] bg-primary active:bg-primary-active px-3.5 py-1.5 text-[13px] font-medium text-on-primary disabled:opacity-60 transition-colors"
                    >
                      {isBusy ? "Đang áp dụng…" : "Áp dụng"}
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() =>
                        void runAction(proposal.id, () => onClose(proposal.id))
                      }
                      className="min-h-10 rounded-[8px] border border-hairline bg-surface px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-canvas-soft disabled:opacity-60 transition-colors"
                    >
                      Đóng để tham khảo
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() =>
                        void runAction(proposal.id, () =>
                          onWithdraw(proposal.id),
                        )
                      }
                      className="min-h-10 rounded-[8px] border border-hairline bg-surface px-3 py-1.5 text-[13px] font-medium text-ink-muted hover:text-accent-orange-deep hover:bg-canvas-soft disabled:opacity-60 transition-colors"
                    >
                      Rút đề xuất
                    </button>
                  </div>
                ) : null}

                {proposal.applied_version ? (
                  <p className="text-[12px] font-semibold text-primary tabular-nums">
                    Đã tạo phiên bản v{proposal.applied_version}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        title="Áp dụng khi chưa đạt đa số?"
        description={
          confirmTarget
            ? `Đề xuất #${confirmTarget.number} mới có ${confirmTarget.votes.agree}/${confirmTarget.votes.required} phiếu đồng ý cần thiết. Bạn vẫn muốn áp dụng để tạo phiên bản mới chứ?`
            : ""
        }
        confirmLabel="Áp dụng ngay"
        cancelLabel="Để nhóm bỏ phiếu thêm"
        busy={Boolean(confirmTarget && busyId === confirmTarget.id)}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={() => {
          if (!confirmTarget) return;
          const targetId = confirmTarget.id;
          setConfirmTarget(null);
          void runAction(targetId, () => onApply(targetId));
        }}
      />
    </section>
  );
}
