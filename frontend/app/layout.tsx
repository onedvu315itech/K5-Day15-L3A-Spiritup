import type { Metadata, Viewport } from "next";
import { Inter, Libre_Baskerville } from "next/font/google";
import { Suspense } from "react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { LocaleProvider } from "@/lib/i18n";
import "./globals.css";

const inter = Inter({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

const baskerville = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-baskerville",
});

export const metadata: Metadata = {
  title: "Partaway — Lịch trình du lịch nhóm cùng trợ lý Roa",
  description:
    "Lập lịch trình du lịch nhóm dựa trên dữ liệu thực tế, bỏ phiếu minh bạch và đồng bộ với trợ lý AI Roa.",
};

export const viewport: Viewport = {
  themeColor: "#FFF5E1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${inter.variable} ${baskerville.variable} h-full antialiased`}
    >
      <body className="min-h-dvh flex flex-col bg-canvas text-ink">
        <LocaleProvider>
          <a href="#main-content" className="skip-link">
            Bỏ qua tới nội dung chính
          </a>

          <Suspense
            fallback={
              <header className="sticky top-0 z-40 h-[69px] border-b border-transparent bg-transparent" />
            }
          >
            <SiteHeader />
          </Suspense>

          <main id="main-content" className="flex-1 min-w-0">
            {children}
          </main>

          <SiteFooter />
        </LocaleProvider>
      </body>
    </html>
  );
}
