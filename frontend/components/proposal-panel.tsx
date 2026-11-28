"use client";

import { useState } from "react";
import { formatDateTime, formatSignedVnd } from "@/lib/format";
import { useLocale } from "@/lib/i18n";
import type { DiffChange, Proposal, VoteValue } from "@/lib/types";
import { ConfirmDialog } from "./confirm-dialog";
import { StatusBanner } from "./status-banner";

const STATUS_BADGES: Record<
  Proposal["status"],
  { label: string; labelEn: string; dot: string; style: string }
> = {
  open: {
    label: "Đang mở",
    labelEn: "Open",
    dot: "bg-secondary",
    style: "bg-canvas-soft text-secondary border-secondary/25",
  },
  applied: {
    label: "Đã áp dụng",
    labelEn: "Applied",
    dot: "bg-success",
    style: "bg-canvas-soft text-success border-success/25",
  },
  reference: {
    label: "Để tham khảo",
    labelEn: "Reference",
    dot: "bg-ink-faint",
    style: "bg-canvas-soft text-ink-muted border-hairline",
  },
  stale: {
    label: "Đã cũ (trùng mục)",
    labelEn: "Stale",
    dot: "bg-warning",
    style: "bg-canvas-soft text-warning border-warning/30",
  },
  withdrawn: {
    label: "Đã rút",
    labelEn: "Withdrawn",
    dot: "bg-ink-faint",
    style: "bg-canvas-soft text-ink-muted border-hairline",
  },
};

const ORIGIN_LABELS: Record<Proposal["origin"], { vi: string; en: string }> = {
  manual: { vi: "Nhóm trưởng sửa", en: "Leader edit" },
  agent: { vi: "Roa soạn", en: "Drafted by Roa" },
  suggestion: { vi: "Từ góp ý", en: "From feedback" },
};

function describeChange(
  change: DiffChange,
  t: (vi: string, en: string) => string,
): string {
  if (change.type === "moved") {
    return t(
      `Chuyển "${change.name}": Ngày ${change.from.day} (${change.from.start}) sang Ngày ${change.to.day} (${change.to.start})`,
      `Move "${change.name}": Day ${change.from.day} (${change.from.start}) to Day ${change.to.day} (${change.to.start})`,
    );
  }
  if (change.type === "added") {
    return t(
      `Thêm "${change.name}" vào Ngày ${change.day}`,
      `Add "${change.name}" on Day ${change.day}`,
    );
  }
  if (change.type === "removed") {
    return t(
      `Xoá "${change.name}" ở Ngày ${change.day}`,
      `Remove "${change.name}" from Day ${change.day}`,
    );
  }
  const fieldsText = Object.keys(change.fields).join(", ");
  return t(
    `Sửa "${change.name ?? change.item_id}" (${fieldsText || "thông tin"})`,
    `Edit "${change.name ?? change.item_id}" (${fieldsText || "details"})`,
  );
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
  const { locale, t } = useLocale();
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
    <section aria-label={t("Đề xuất và bỏ phiếu", "Proposals and voting")} className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div
          role="tablist"
          aria-label={t("Lọc đề xuất", "Filter proposals")}
          className="inline-flex rounded-[8px] border border-hairline bg-canvas-soft p-1"
        >
          <button
            type="button"
            role="tab"
            aria-selected={filter === "open"}
            onClick={() => setFilter("open")}
            className={`min-h-9 rounded-[5px] px-3 py-1 text-[13px] font-medium transition-colors ${
              filter === "open"
                ? "bg-surface text-ink shadow-card"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            {t("Đang mở", "Open")} ({proposals.filter((p) => p.status === "open").length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === "closed"}
            onClick={() => setFilter("closed")}
            className={`min-h-9 rounded-[5px] px-3 py-1 text-[13px] font-medium transition-colors ${
              filter === "closed"
                ? "bg-surface text-ink shadow-card"
                : "text-ink-muted hover:text-ink"
            }`}
          >
            {t("Đã đóng", "Closed")} ({proposals.filter((p) => p.status !== "open").length})
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
            ? t(
                "Hiện chưa có đề xuất nào đang chờ biểu quyết.",
                "No open proposals waiting for votes.",
              )
            : t("Chưa có đề xuất nào đã đóng.", "No closed proposals yet.")}
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
                        {t("Đề xuất", "Proposal")} #{proposal.number}
                      </span>
                      <span>
                        ·{" "}
                        {locale === "en"
                          ? ORIGIN_LABELS[proposal.origin].en
                          : ORIGIN_LABELS[proposal.origin].vi}
                      </span>
                      <span className="tabular-nums">
                        · {t("Từ", "From")} v{proposal.base_version}
                      </span>
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
                    {locale === "en" ? badge.labelEn : badge.label}
                  </span>
                </div>

                {proposal.reason ? (
                  <p className="text-[13px] text-ink-muted">{proposal.reason}</p>
                ) : null}

                {proposal.suggestion ? (
                  <p className="text-[12px] font-medium text-secondary">
                    {t("Từ góp ý của", "From feedback by")} {proposal.suggestion.author}
                  </p>
                ) : null}

                {/* Diff preview */}
                <div className="rounded-[8px] border border-hairline bg-canvas-soft p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="font-semibold text-ink">
                      {t("Thay đổi dự kiến", "Proposed changes")}
                    </span>
                    <span className="font-medium text-ink-muted tabular-nums">
                      {formatSignedVnd(proposal.preview.cost_delta_per_person)}
                    </span>
                  </div>
                  {proposal.preview.changes.length === 0 ? (
                    <p className="text-[12px] text-ink-muted">
                      {t(
                        `Khôi phục nội dung phiên bản v${proposal.target_version}`,
                        `Restore version v${proposal.target_version}`,
                      )}
                    </p>
                  ) : (
                    <ul className="space-y-1 text-[12px] text-ink-secondary">
                      {proposal.preview.changes.map((c, idx) => (
                        <li key={`${c.item_id}-${idx}`}>• {describeChange(c, t)}</li>
                      ))}
                    </ul>
                  )}
                </div>

                {proposal.warnings.length > 0 ? (
                  <div className="space-y-1">
                    {proposal.warnings.map((w, idx) => (
                      <p
                        key={idx}
                        className="rounded-[5px] border border-hairline bg-canvas-soft px-2.5 py-1.5 text-[12px] text-warning"
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
                      {voteStats.agree} {t("đồng ý", "agree")} · {voteStats.disagree}{" "}
                      {t("không đồng ý", "disagree")} ({t("cần", "need")}{" "}
                      {voteStats.required})
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
                      <span
                        aria-hidden="true"
                        className={`h-2 w-2 rounded-full ${
                          voteStats.majority ? "bg-success" : "bg-warning"
                        }`}
                      />
                      {voteStats.majority
                        ? t("Đạt đa số", "Majority reached")
                        : t("Chưa đạt đa số", "Below majority")}
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
                      {t("Đã bỏ phiếu:", "Voted:")}{" "}
                      {proposal.voters
                        .map(
                          (v) =>
                            `${v.member.display_name} (${
                              v.value === "agree"
                                ? t("Đồng ý", "Agree")
                                : t("Không", "Disagree")
                            })`,
                        )
                        .join(", ")}
                    </p>
                  ) : null}
                  {voteStats.pending.length > 0 ? (
                    <p className="text-[12px] text-ink-faint">
                      {t("Chưa bỏ phiếu:", "Pending:")} {voteStats.pending.join(", ")}
                    </p>
                  ) : null}
                  {proposal.expires_at ? (
                    <p className="text-[12px] text-ink-muted tabular-nums">
                      {t("Hạn:", "Deadline:")} {formatDateTime(proposal.expires_at)}
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
                      className={`min-h-10 flex-1 rounded-[5px] border px-3 py-1.5 text-[13px] font-medium transition-colors disabled:opacity-60 ${
                        proposal.my_vote === "agree"
                          ? "border-primary bg-primary text-on-primary"
                          : "border-hairline bg-surface text-ink hover:bg-canvas-soft"
                      }`}
                    >
                      {t("Đồng ý", "Agree")}
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
                      className={`min-h-10 flex-1 rounded-[5px] border px-3 py-1.5 text-[13px] font-medium transition-colors disabled:opacity-60 ${
                        proposal.my_vote === "disagree"
                          ? "border-ink-secondary bg-ink-secondary text-white"
                          : "border-hairline bg-surface text-ink hover:bg-canvas-soft"
                      }`}
                    >
                      {t("Không đồng ý", "Disagree")}
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
                      className="min-h-10 rounded-[5px] bg-primary active:bg-primary-active px-3.5 py-1.5 text-[13px] font-semibold text-on-primary disabled:opacity-60 transition-colors"
                    >
                      {isBusy
                        ? t("Đang áp dụng…", "Applying…")
                        : t("Áp dụng", "Apply")}
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() =>
                        void runAction(proposal.id, () => onClose(proposal.id))
                      }
                      className="min-h-10 rounded-[5px] border border-hairline bg-surface px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-canvas-soft disabled:opacity-60 transition-colors"
                    >
                      {t("Đóng để tham khảo", "Close for reference")}
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() =>
                        void runAction(proposal.id, () =>
                          onWithdraw(proposal.id),
                        )
                      }
                      className="min-h-10 rounded-[5px] border border-hairline bg-surface px-3 py-1.5 text-[13px] font-medium text-ink-muted hover:text-warning hover:bg-canvas-soft disabled:opacity-60 transition-colors"
                    >
                      {t("Rút đề xuất", "Withdraw")}
                    </button>
                  </div>
                ) : null}

                {proposal.applied_version ? (
                  <p className="text-[12px] font-semibold text-success tabular-nums">
                    {t("Đã tạo phiên bản", "Created version")} v{proposal.applied_version}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        title={t("Áp dụng khi chưa đạt đa số?", "Apply without majority?")}
        description={
          confirmTarget
            ? t(
                `Đề xuất #${confirmTarget.number} mới có ${confirmTarget.votes.agree}/${confirmTarget.votes.required} phiếu đồng ý cần thiết. Bạn vẫn muốn áp dụng để tạo phiên bản mới chứ?`,
                `Proposal #${confirmTarget.number} currently has ${confirmTarget.votes.agree}/${confirmTarget.votes.required} required votes. Do you still want to apply it as a new version?`,
              )
            : ""
        }
        confirmLabel={t("Áp dụng ngay", "Apply anyway")}
        cancelLabel={t("Để nhóm bỏ phiếu thêm", "Wait for more votes")}
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
