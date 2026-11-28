"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { StatusBanner } from "@/components/status-banner";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/i18n";
import { getTripSession, saveTripSession } from "@/lib/storage";
import { ApiError } from "@/lib/types";

export default function JoinAPlanPage() {
  const router = useRouter();
  const { t } = useLocale();

  const [memberName, setMemberName] = useState("");
  const [planCode, setPlanCode] = useState("");
  const [planSecretKey, setPlanSecretKey] = useState("");
  const [showSecretKey, setShowSecretKey] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    memberName?: string;
    planCode?: string;
    planSecretKey?: string;
  }>({});

  const validate = (): boolean => {
    const errors: {
      memberName?: string;
      planCode?: string;
      planSecretKey?: string;
    } = {};

    if (!memberName.trim()) {
      errors.memberName = t(
        "Vui lòng nhập tên thành viên.",
        "Please enter your member name.",
      );
    }

    if (!planCode.trim()) {
      errors.planCode = t(
        "Vui lòng nhập mã kế hoạch.",
        "Please enter the plan code.",
      );
    }

    if (!planSecretKey.trim()) {
      errors.planSecretKey = t(
        "Vui lòng nhập mã bí mật kế hoạch.",
        "Please enter the plan secret key.",
      );
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBannerError(null);

    if (!validate()) {
      setBannerError(
        t(
          "Vui lòng điền đầy đủ tên thành viên, mã kế hoạch và mã bí mật kế hoạch.",
          "Please fill in member name, plan code, and plan secret key.",
        ),
      );
      return;
    }

    const trimmedName = memberName.trim();
    const trimmedCode = planCode.trim();

    setSubmitting(true);
    try {
      const preview = await api.getInvitePreview(trimmedCode);
      const joined = await api.joinTrip(trimmedCode, trimmedName);

      const existing = getTripSession(joined.trip_id);
      if (!existing || existing.memberId !== joined.member.id) {
        saveTripSession({
          tripId: joined.trip_id,
          title: preview.trip.title,
          destination: preview.trip.destination,
          startDate: preview.trip.start_date,
          endDate: preview.trip.end_date,
          token: joined.token,
          memberId: joined.member.id,
          displayName: joined.member.display_name,
          role: joined.member.role,
          inviteCode: trimmedCode,
          updatedAt: new Date().toISOString(),
        });
      }

      router.push(`/trips/${encodeURIComponent(joined.trip_id)}`);
    } catch (err) {
      if (err instanceof ApiError && err.code === "name_taken") {
        setFieldErrors({ memberName: err.message });
        setBannerError(err.message);
      } else if (err instanceof ApiError && err.code === "not_found") {
        const msg = t(
          "Mã kế hoạch không đúng hoặc chuyến đi không tồn tại.",
          "Plan code is invalid or the trip was not found.",
        );
        setFieldErrors({ planCode: msg });
        setBannerError(msg);
      } else {
        setBannerError(
          err instanceof Error
            ? err.message
            : t(
                "Không thể tham gia kế hoạch. Vui lòng thử lại.",
                "Could not join the plan. Please try again.",
              ),
        );
      }
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6 sm:py-14">
      <div className="rounded-[16px] border border-hairline bg-surface p-6 sm:p-8 shadow-card space-y-6">
        <div className="space-y-2 border-b border-hairline pb-5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-canvas-soft px-3 py-1 type-eyebrow text-secondary">
            <span
              aria-hidden="true"
              className="h-1.5 w-1.5 rounded-full bg-secondary"
            />
            {t("Partaway · Tham gia kế hoạch", "Partaway · Join a plan")}
          </span>
          <h1 className="type-heading-1 text-ink pt-1">
            {t("Tham gia kế hoạch", "Join a plan")}
          </h1>
          <p className="text-[14px] text-ink-muted">
            {t(
              "Nhập tên thành viên, mã kế hoạch và mã bí mật kế hoạch do nhóm trưởng chia sẻ.",
              "Enter your member name, plan code, and plan secret key shared by your trip leader.",
            )}
          </p>
        </div>

        {bannerError ? (
          <StatusBanner
            tone="error"
            message={bannerError}
            onDismiss={() => setBannerError(null)}
          />
        ) : null}

        <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="join-member-name"
              className="block text-[14px] font-semibold text-ink"
            >
              {t("Tên thành viên *", "Member name *")}
            </label>
            <input
              id="join-member-name"
              name="member_name"
              type="text"
              required
              autoComplete="name"
              value={memberName}
              onChange={(e) => {
                setMemberName(e.target.value);
                if (fieldErrors.memberName) {
                  setFieldErrors((prev) => ({ ...prev, memberName: undefined }));
                }
              }}
              placeholder={t("Ví dụ: Minh Anh", "Example: Minh Anh")}
              aria-invalid={Boolean(fieldErrors.memberName)}
              aria-describedby={
                fieldErrors.memberName
                  ? "join-member-name-error"
                  : "join-member-name-hint"
              }
              className="nomad-input min-h-11 w-full px-3.5 py-2.5 text-[15px]"
            />
            <p
              id="join-member-name-hint"
              className="text-[13px] text-ink-muted"
            >
              {t(
                "Tên này hiển thị khi bạn bỏ phiếu đề xuất, gửi góp ý hoặc hỏi Roa.",
                "Shown when you vote on proposals, send feedback, or ask Roa.",
              )}
            </p>
            {fieldErrors.memberName ? (
              <p
                id="join-member-name-error"
                className="text-[13px] font-medium text-error"
              >
                {fieldErrors.memberName}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="join-plan-code"
              className="block text-[14px] font-semibold text-ink"
            >
              {t("Mã kế hoạch *", "Plan code *")}
            </label>
            <input
              id="join-plan-code"
              name="plan_code"
              type="text"
              required
              autoComplete="off"
              value={planCode}
              onChange={(e) => {
                setPlanCode(e.target.value);
                if (fieldErrors.planCode) {
                  setFieldErrors((prev) => ({ ...prev, planCode: undefined }));
                }
              }}
              placeholder={t(
                "Nhập mã kế hoạch (vd: dalat3n2d0)",
                "Enter plan code (e.g. dalat3n2d0)",
              )}
              aria-invalid={Boolean(fieldErrors.planCode)}
              aria-describedby={
                fieldErrors.planCode
                  ? "join-plan-code-error"
                  : "join-plan-code-hint"
              }
              className="nomad-input min-h-11 w-full px-3.5 py-2.5 text-[15px]"
            />
            <p
              id="join-plan-code-hint"
              className="text-[13px] text-ink-muted"
            >
              {t(
                "Mã mẫu để thử nhanh: dalat3n2d0",
                "Demo plan code to try: dalat3n2d0",
              )}
            </p>
            {fieldErrors.planCode ? (
              <p
                id="join-plan-code-error"
                className="text-[13px] font-medium text-error"
              >
                {fieldErrors.planCode}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="join-plan-secret-key"
              className="block text-[14px] font-semibold text-ink"
            >
              {t("Mã bí mật kế hoạch *", "Plan secret key *")}
            </label>
            <div className="relative">
              <input
                id="join-plan-secret-key"
                name="plan_secret_key"
                type={showSecretKey ? "text" : "password"}
                required
                autoComplete="off"
                value={planSecretKey}
                onChange={(e) => {
                  setPlanSecretKey(e.target.value);
                  if (fieldErrors.planSecretKey) {
                    setFieldErrors((prev) => ({
                      ...prev,
                      planSecretKey: undefined,
                    }));
                  }
                }}
                placeholder={t(
                  "Nhập mã bí mật kế hoạch",
                  "Enter plan secret key",
                )}
                aria-invalid={Boolean(fieldErrors.planSecretKey)}
                aria-describedby={
                  fieldErrors.planSecretKey
                    ? "join-plan-secret-key-error"
                    : undefined
                }
                className="nomad-input min-h-11 w-full pl-3.5 pr-12 py-2.5 text-[15px]"
              />
              <button
                type="button"
                onClick={() => setShowSecretKey((prev) => !prev)}
                aria-label={
                  showSecretKey
                    ? t("Ẩn mã bí mật kế hoạch", "Hide plan secret key")
                    : t("Hiện mã bí mật kế hoạch", "Show plan secret key")
                }
                className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-[5px] text-ink-muted hover:bg-canvas-soft hover:text-ink transition-colors"
              >
                {showSecretKey ? (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            {fieldErrors.planSecretKey ? (
              <p
                id="join-plan-secret-key-error"
                className="text-[13px] font-medium text-error"
              >
                {fieldErrors.planSecretKey}
              </p>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-[5px] bg-primary active:bg-primary-active px-5 py-2.5 text-[15px] font-semibold text-on-primary shadow-card transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting
              ? t("Đang tham gia…", "Joining…")
              : t("Tham gia kế hoạch", "Join plan")}
          </button>
        </form>

        <div className="border-t border-hairline pt-4 flex flex-col gap-2 text-[13px] text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <span>
            {t("Chưa có phòng kế hoạch?", "Need to start a new trip?")}
          </span>
          <Link
            href="/trips/new"
            className="font-semibold text-secondary hover:underline"
          >
            {t("Tạo chuyến đi mới", "Create a new trip")}
          </Link>
        </div>
      </div>
    </div>
  );
}
