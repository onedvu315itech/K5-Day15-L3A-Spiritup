"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n";

export function SiteFooter() {
  const { t } = useLocale();

  return (
    <footer className="border-t border-hairline bg-canvas-soft px-4 py-8 text-[14px] text-ink-secondary sm:px-6">
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span translate="no" className="font-semibold text-ink">
            Partaway
          </span>
          <span className="text-ink-muted">·</span>
          <span className="text-ink-muted">
            {t(
              "Lịch trình du lịch nhóm tại Việt Nam cùng trợ lý AI Roa",
              "Group trip planning across Vietnam with AI assistant Roa",
            )}
          </span>
        </div>
        <div className="flex items-center gap-4 text-secondary">
          <Link href="/" className="hover:underline">
            {t("Trang chủ", "Home")}
          </Link>
          <Link href="/trips/new" className="hover:underline">
            {t("Tạo chuyến đi mới", "Create trip")}
          </Link>
          <Link href="/join/dalat3n2d0" className="hover:underline">
            {t("Tham gia bản mẫu", "Join sample trip")}
          </Link>
        </div>
      </div>
    </footer>
  );
}
