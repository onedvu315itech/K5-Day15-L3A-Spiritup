"use client";

interface StatusBannerProps {
  tone: "error" | "warning" | "info" | "success";
  message: string;
  onDismiss?: () => void;
}

const TONE_STYLES = {
  error: {
    wrap: "border-hairline bg-surface text-ink shadow-notion-1",
    dot: "bg-accent-orange",
    label: "Lỗi",
    labelClass: "text-accent-orange-deep",
  },
  warning: {
    wrap: "border-hairline bg-surface text-ink shadow-notion-1",
    dot: "bg-accent-orange",
    label: "Lưu ý",
    labelClass: "text-accent-orange-deep",
  },
  info: {
    wrap: "border-hairline bg-surface text-ink shadow-notion-1",
    dot: "bg-primary",
    label: "Thông tin",
    labelClass: "text-primary",
  },
  success: {
    wrap: "border-hairline bg-surface text-ink shadow-notion-1",
    dot: "bg-accent-green",
    label: "Hoàn tất",
    labelClass: "text-ink",
  },
};

export function StatusBanner({ tone, message, onDismiss }: StatusBannerProps) {
  const style = TONE_STYLES[tone];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-start justify-between gap-3 rounded-[8px] border px-4 py-3 text-[14px] ${style.wrap}`}
    >
      <div className="min-w-0 flex items-start gap-2.5">
        <span
          aria-hidden="true"
          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${style.dot}`}
        />
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
          aria-label="Đóng thông báo"
          className="shrink-0 rounded-[5px] px-2 py-1 text-xs font-medium text-ink-muted hover:bg-canvas-soft hover:text-ink transition-colors"
        >
          Đóng
        </button>
      ) : null}
    </div>
  );
}
