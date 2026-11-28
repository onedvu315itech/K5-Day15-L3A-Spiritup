"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n";

export default function NotFoundPage() {
  const { t } = useLocale();
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="rounded-[16px] border border-hairline bg-surface p-8 text-center shadow-card space-y-4">
        <h1 className="type-heading-2 text-ink">
          {t("Không tìm thấy trang này", "Page not found")}
        </h1>
        <p className="text-[15px] text-ink-muted">
          {t(
            "Đường dẫn có thể đã sai hoặc mã mời chuyến đi không còn hiệu lực.",
            "The link may be incorrect or the trip invite code is no longer valid.",
          )}
        </p>
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-[5px] bg-primary active:bg-primary-active px-6 py-2.5 text-[15px] font-semibold text-on-primary transition-colors"
        >
          {t("Quay về trang chủ", "Back to home")}
        </Link>
      </div>
    </div>
  );
}
