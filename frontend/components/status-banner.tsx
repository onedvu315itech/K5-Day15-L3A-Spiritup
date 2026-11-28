"use client";

import { useLocale } from "@/lib/i18n";

interface StatusBannerProps {
  tone: "error" | "warning" | "info" | "success";
  message: string;
  onDismiss?: () => void;
}

export function StatusBanner({ tone, message, onDismiss }: StatusBannerProps) {
  const { t } = useLocale();

  const toneStyles = {
    error: {
      wrap: "border-error/30 bg-surface text-ink shadow-card",
      badge: "bg-error text-white",
      icon: "!",
      label: t("Lỗi", "Error"),
      labelClass: "text-error",
    },
    warning: {
      wrap: "border-warning/35 bg-surface text-ink shadow-card",
      badge: "bg-warning text-white",
      icon: "▲",
      label: t("Lưu ý", "Warning"),
      labelClass: "text-warning",
    },
    info: {
      wrap: "border-info/30 bg-surface text-ink shadow-card",
      badge: "bg-info text-white",
      icon: "i",
      label: t("Thông tin", "Info"),
      labelClass: "text-info",
    },
    success: {
      wrap: "border-success/30 bg-surface text-ink shadow-card",
      badge: "bg-success text-white",
      icon: "✓",
      label: t("Hoàn tất", "Done"),
      labelClass: "text-success",
    },
  };

  const style = toneStyles[tone];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-start justify-between gap-3 rounded-[10px] border px-4 py-3 text-[14px] ${style.wrap}`}
    >
      <div className="min-w-0 flex items-start gap-2.5">
        <span
          aria-hidden="true"
          className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${style.badge}`}
        >
          {style.icon}
        </span>
        <div className="min-w-0">
          <span className={`font-semibold mr-1.5 ${style.labelClass}`}>
            {style.label}:
          </span>
          <span className="break-words text-ink-secondary">{message}</span>
        </div>
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("Đóng thông báo", "Dismiss notice")}
          className="shrink-0 rounded-[6px] px-2 py-1 text-xs font-medium text-ink-muted hover:bg-canvas-soft hover:text-ink transition-colors"
        >
          {t("Đóng", "Close")}
        </button>
      ) : null}
    </div>
  );
}
