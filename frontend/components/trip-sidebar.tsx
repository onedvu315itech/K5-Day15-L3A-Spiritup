"use client";

import { useState } from "react";
import { formatDate, formatDateTime, formatVnd } from "@/lib/format";
import type { TripInfo, TripMember, VersionListItem } from "@/lib/types";

interface TripSidebarProps {
  trip: TripInfo;
  members: TripMember[];
  myMemberId: string;
  isLeader: boolean;
  versions: VersionListItem[];
  viewingVersion: number;
  newSuggestionsCount?: number;
  onSelectVersion: (versionNo: number) => void;
  onCompareVersion: (versionNo: number) => void;
  onRevertVersion: (versionNo: number) => void;
  onOpenSuggestionInbox?: () => void;
}

export function TripSidebar({
  trip,
  members,
  myMemberId,
  isLeader,
  versions,
  viewingVersion,
  newSuggestionsCount = 0,
  onSelectVersion,
  onCompareVersion,
  onRevertVersion,
  onOpenSuggestionInbox,
}: TripSidebarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyInvite = async () => {
    const inviteUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/join/${trip.invite_code}`
        : `/join/${trip.invite_code}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <aside aria-label="Thông tin và lịch sử chuyến đi" className="space-y-4">
      {/* Trip overview card */}
      <div className="rounded-[12px] border border-hairline bg-surface p-5 space-y-3.5">
        <div>
          <h2 className="type-title text-ink break-words">{trip.destination}</h2>
          <p className="mt-0.5 text-[13px] text-ink-muted tabular-nums">
            {formatDate(trip.start_date)} – {formatDate(trip.end_date)} · Dự kiến {trip.group_size} người
          </p>
        </div>

        <div className="rounded-[8px] border border-hairline bg-canvas-soft p-3 text-[13px] space-y-1.5">
          <div className="flex justify-between gap-2">
            <span className="text-ink-muted">Ngân sách mục tiêu</span>
            <span className="font-semibold text-ink tabular-nums">
              {formatVnd(trip.budget_per_person)}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-ink-muted">Phiên bản hiện tại</span>
            <span className="font-semibold text-primary tabular-nums">
              v{trip.current_version}
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => void handleCopyInvite()}
            className="min-h-10 w-full rounded-[8px] border border-hairline bg-surface px-3 py-1.5 text-[13px] font-medium text-primary hover:bg-canvas-soft transition-colors"
          >
            {copied ? "Đã chép link mời" : "Sao chép link mời nhóm"}
          </button>
          <p
            role="status"
            aria-live="polite"
            className="text-[12px] text-ink-muted text-center"
          >
            Mã mời:{" "}
            <span translate="no" className="font-mono font-semibold text-ink">
              {trip.invite_code}
            </span>
          </p>
        </div>

        {isLeader && onOpenSuggestionInbox ? (
          <button
            type="button"
            onClick={onOpenSuggestionInbox}
            className="min-h-10 w-full rounded-[8px] border border-hairline bg-canvas-soft px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-hairline/50 transition-colors flex items-center justify-between"
          >
            <span>Hộp góp ý thành viên</span>
            <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-on-primary tabular-nums">
              {newSuggestionsCount}
            </span>
          </button>
        ) : null}
      </div>

      {/* Members */}
      <div className="rounded-[12px] border border-hairline bg-surface p-4 space-y-2.5">
        <h3 className="text-[14px] font-semibold text-ink">
          Thành viên ({members.length})
        </h3>
        <ul className="space-y-1.5 text-[13px]">
          {members.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-2 rounded-[5px] bg-canvas-soft px-2.5 py-1.5"
            >
              <span className="truncate font-medium text-ink">
                {m.display_name}
                {m.id === myMemberId ? " (Bạn)" : ""}
              </span>
              <span
                className={`shrink-0 rounded-[5px] px-2 py-0.5 text-[11px] font-semibold ${
                  m.role === "leader"
                    ? "bg-surface text-primary border border-hairline"
                    : "text-ink-muted"
                }`}
              >
                {m.role === "leader" ? "Nhóm trưởng" : "Thành viên"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Version history */}
      <div className="rounded-[12px] border border-hairline bg-surface p-4 space-y-2.5">
        <h3 className="text-[14px] font-semibold text-ink">Lịch sử phiên bản</h3>
        {versions.length === 0 ? (
          <p className="text-[13px] text-ink-muted">Chưa có phiên bản nào.</p>
        ) : (
          <ul className="space-y-2">
            {versions.map((ver) => {
              const isViewing = ver.version_no === viewingVersion;
              const isCurrent = ver.version_no === trip.current_version;
              return (
                <li
                  key={ver.version_no}
                  className={`rounded-[8px] border p-3 text-[13px] space-y-1.5 ${
                    isViewing
                      ? "border-primary bg-surface shadow-notion-1"
                      : "border-hairline bg-canvas-soft"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-ink tabular-nums">
                      v{ver.version_no} {isCurrent ? "(Hiện tại)" : ""}
                    </span>
                    <span className="text-[11px] text-ink-faint tabular-nums">
                      {formatDateTime(ver.created_at)}
                    </span>
                  </div>
                  <p className="text-[12px] text-ink-muted break-words">
                    {ver.summary}
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {!isViewing ? (
                      <button
                        type="button"
                        onClick={() => onSelectVersion(ver.version_no)}
                        className="rounded-[5px] border border-hairline bg-surface px-2.5 py-1 text-[12px] font-medium text-ink hover:bg-canvas-soft transition-colors"
                      >
                        Xem bản này
                      </button>
                    ) : null}
                    {!isCurrent ? (
                      <button
                        type="button"
                        onClick={() => onCompareVersion(ver.version_no)}
                        className="rounded-[5px] border border-hairline bg-surface px-2.5 py-1 text-[12px] font-medium text-primary hover:bg-canvas-soft transition-colors"
                      >
                        So với hiện tại
                      </button>
                    ) : null}
                    {isLeader && !isCurrent ? (
                      <button
                        type="button"
                        onClick={() => onRevertVersion(ver.version_no)}
                        className="rounded-[5px] border border-hairline bg-surface px-2.5 py-1 text-[12px] font-semibold text-primary hover:bg-primary hover:text-on-primary transition-colors"
                      >
                        Khôi phục
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
