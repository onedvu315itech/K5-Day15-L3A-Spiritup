"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { StatusBanner } from "@/components/status-banner";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { getTripSession, saveTripSession } from "@/lib/storage";
import { ApiError, type InvitePreviewResponse } from "@/lib/types";

function JoinTripContent() {
  const params = useParams<{ inviteCode: string }>();
  const router = useRouter();
  const inviteCode = decodeURIComponent(params?.inviteCode ?? "");

  const [preview, setPreview] = useState<InvitePreviewResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(inviteCode));
  const [loadError, setLoadError] = useState<string | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!inviteCode) return;
    let cancelled = false;
    api
      .getInvitePreview(inviteCode)
      .then((res) => {
        if (!cancelled) {
          setPreview(res);
          setLoadError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setLoadError(
            err instanceof Error
              ? err.message
              : "Không tải được thông tin lời mời.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [inviteCode]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = displayName.trim();
    if (!trimmed) {
      setSubmitError("Hãy nhập tên hiển thị để cả nhóm nhận ra bạn.");
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      const joined = await api.joinTrip(inviteCode, trimmed);
      const existing = getTripSession(joined.trip_id);
      if (!existing || existing.memberId !== joined.member.id) {
        saveTripSession({
          tripId: joined.trip_id,
          title: preview?.trip.title ?? "Chuyến đi Partaway",
          destination: preview?.trip.destination ?? "Đà Lạt",
          startDate: preview?.trip.start_date ?? "",
          endDate: preview?.trip.end_date ?? "",
          token: joined.token,
          memberId: joined.member.id,
          displayName: joined.member.display_name,
          role: joined.member.role,
          inviteCode,
          updatedAt: new Date().toISOString(),
        });
      }
      router.push(`/trips/${encodeURIComponent(joined.trip_id)}`);
    } catch (err) {
      if (err instanceof ApiError && err.code === "name_taken") {
        setSubmitError(err.message);
      } else {
        setSubmitError(
          err instanceof Error ? err.message : "Không thể tham gia chuyến đi.",
        );
      }
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6 space-y-6">
      {loading ? (
        <div className="rounded-[16px] border border-hairline bg-surface p-8 text-center text-[15px] text-ink-muted shadow-notion-1">
          Đang tải thông tin lời mời…
        </div>
      ) : loadError || !preview ? (
        <div className="rounded-[16px] border border-hairline bg-surface p-6 shadow-notion-1 space-y-4">
          <StatusBanner
            tone="error"
            message={loadError ?? "Không tìm thấy link mời."}
          />
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-full bg-primary active:bg-primary-active px-5 py-2 text-[15px] font-medium text-on-primary transition-colors"
          >
            Quay về trang chủ
          </Link>
        </div>
      ) : (
        <div className="rounded-[16px] border border-hairline bg-surface p-6 sm:p-8 shadow-notion-1 space-y-6">
          <div className="space-y-2 border-b border-hairline pb-4">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-canvas-soft px-3 py-1 type-eyebrow text-primary">
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent-teal" />
              Lời mời tham gia chuyến đi
            </span>
            <h1 className="type-heading-2 text-ink pt-1">
              {preview.trip.title}
            </h1>
            <p className="text-[14px] text-ink-muted tabular-nums">
              {preview.trip.destination} · {formatDate(preview.trip.start_date)} –{" "}
              {formatDate(preview.trip.end_date)} · Hiện có{" "}
              {preview.member_count} thành viên
            </p>
          </div>

          <form onSubmit={(e) => void handleJoin(e)} className="space-y-4">
            <div>
              <label
                htmlFor="join-display-name"
                className="block text-[14px] font-semibold text-ink mb-1.5"
              >
                Tên hiển thị của bạn *
              </label>
              <input
                id="join-display-name"
                name="display_name"
                type="text"
                required
                autoComplete="name"
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  if (submitError) setSubmitError(null);
                }}
                aria-invalid={submitError ? "true" : "false"}
                aria-describedby={submitError ? "join-error" : "join-hint"}
                placeholder="Ví dụ: Minh Anh…"
                className="notion-input min-h-11 w-full px-3 py-2 text-[15px]"
              />
              <span
                id="join-hint"
                className="mt-1.5 block text-[13px] text-ink-muted"
              >
                Tên này dùng để hiển thị khi bạn bỏ phiếu đề xuất, gửi góp ý hoặc hỏi Roa.
              </span>
              {submitError ? (
                <p
                  id="join-error"
                  role="status"
                  aria-live="polite"
                  className="mt-1.5 text-[13px] font-medium text-accent-orange-deep"
                >
                  {submitError}
                </p>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="min-h-12 w-full rounded-full bg-primary active:bg-primary-active active:scale-[0.98] px-5 py-3 text-[16px] font-medium text-on-primary disabled:opacity-60 transition-[transform,background-color]"
            >
              {submitting ? "Đang tham gia…" : "Tham gia chuyến đi"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default function JoinTripPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-lg px-4 py-12 text-center text-[15px] text-ink-muted">
          Đang tải thông tin lời mời…
        </div>
      }
    >
      <JoinTripContent />
    </Suspense>
  );
}
