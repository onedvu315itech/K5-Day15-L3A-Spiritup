import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Partaway — Lịch trình du lịch nhóm cùng trợ lý Roa",
  description:
    "Lập lịch trình du lịch nhóm dựa trên dữ liệu thực tế, bỏ phiếu minh bạch và đồng bộ với trợ lý AI Roa.",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-dvh flex flex-col bg-canvas-soft text-ink">
        <a href="#main-content" className="skip-link">
          Bỏ qua tới nội dung chính
        </a>

        <header className="sticky top-0 z-30 border-b border-hairline bg-canvas">
          <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 p-4 sm:px-6">
            <Link
              href="/"
              className="flex items-center gap-2.5 text-ink transition-colors hover:text-primary"
            >
              <span
                aria-hidden="true"
                className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] bg-ink text-on-primary font-bold text-base tracking-tight"
              >
                P
              </span>
              <span className="flex flex-col leading-tight">
                <span translate="no" className="text-[16px] font-bold tracking-[-0.25px]">
                  Partaway
                </span>
                <span className="text-[12px] text-ink-muted">
                  Trợ lý du lịch nhóm Roa
                </span>
              </span>
            </Link>

            <nav aria-label="Điều hướng chính" className="flex items-center gap-2 sm:gap-3">
              <Link
                href="/"
                className="rounded-[8px] px-3 py-1.5 text-[15px] font-medium text-ink hover:bg-canvas-soft transition-colors"
              >
                Chuyến đi
              </Link>
              <Link
                href="/trips/new"
                className="inline-flex min-h-10 items-center rounded-[8px] border border-hairline bg-surface px-3.5 py-1.5 text-[15px] font-medium text-ink hover:bg-canvas-soft transition-colors"
              >
                Tạo chuyến đi
              </Link>
            </nav>
          </div>
        </header>

        <main id="main-content" className="flex-1 min-w-0">
          {children}
        </main>

        <footer className="border-t border-hairline bg-canvas-soft px-4 py-8 text-[14px] text-ink-secondary sm:px-6">
          <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span translate="no" className="font-semibold text-ink">
                Partaway
              </span>
              <span className="text-ink-muted">·</span>
              <span className="text-ink-muted">
                Lịch trình du lịch nhóm tại Đà Lạt cùng trợ lý AI Roa
              </span>
            </div>
            <div className="flex items-center gap-4 text-ink-muted">
              <Link href="/" className="hover:text-primary transition-colors">
                Trang chủ
              </Link>
              <Link href="/trips/new" className="hover:text-primary transition-colors">
                Tạo chuyến đi mới
              </Link>
              <Link href="/join/dalat3n2d0" className="hover:text-primary transition-colors">
                Tham gia bản mẫu
              </Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
