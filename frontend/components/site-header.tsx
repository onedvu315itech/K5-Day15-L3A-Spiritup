"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n";

export function SiteHeader() {
  const pathname = usePathname();
  const { locale, toggleLocale, t } = useLocale();
  const isHome = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: t("Trang chủ", "Home"), href: "/" },
    { label: t("Hành trình", "Travel"), href: "/#templates-heading" },
    { label: "Partaway", href: "/#workflow-heading", isLogo: true },
    { label: t("Hỏi đáp", "FAQ"), href: "/#faq-heading" },
    { label: "Blog", href: "/#blog-heading" },
  ];

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const transparent = isHome && !scrolled && !mobileMenuOpen;

  return (
    <header
      className={`${
        isHome ? "fixed top-0 inset-x-0" : "sticky top-0"
      } z-40 transition-colors duration-200 ${
        transparent
          ? "bg-transparent border-b border-transparent text-white"
          : "bg-surface border-b border-hairline text-ink shadow-card"
      }`}
    >
      <div className="mx-auto grid max-w-[1280px] grid-cols-[1fr_auto] items-center gap-4 px-4 py-3.5 sm:px-6 md:grid-cols-[1fr_auto_1fr]">
        {/* 1. Start: Language Toggle Button */}
        <div className="justify-self-start flex items-center gap-2">
          <button
            type="button"
            onClick={toggleLocale}
            aria-label={t(
              "Chuyển ngôn ngữ sang tiếng Anh",
              "Switch language to Vietnamese",
            )}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-[5px] border px-3 py-1.5 text-[13px] font-semibold transition-colors ${
              transparent
                ? "border-white/30 bg-black/25 text-white hover:bg-black/40 backdrop-blur-xs"
                : "border-hairline bg-canvas-soft text-ink hover:border-primary"
            }`}
          >
            <span
              className={
                locale === "vi"
                  ? transparent
                    ? "text-primary"
                    : "text-secondary font-bold"
                  : "opacity-65"
              }
            >
              VI
            </span>
            <span aria-hidden="true" className="opacity-45">
              /
            </span>
            <span
              className={
                locale === "en"
                  ? transparent
                    ? "text-primary"
                    : "text-secondary font-bold"
                  : "opacity-65"
              }
            >
              EN
            </span>
          </button>
        </div>

        {/* 2. Middle: Home - Travel - Partaway - FAQ - Blog */}
        <nav
          aria-label={t("Điều hướng chính", "Main navigation")}
          className="hidden md:flex items-center justify-center gap-1 lg:gap-2"
        >
          {navItems.map((item) => {
            const active = item.href === "/" && pathname === "/";
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-label={item.isLogo ? "Partaway" : undefined}
                className={`px-3.5 py-1.5 text-[14px] font-medium transition-colors ${
                  active
                    ? transparent
                      ? "text-[#A9C77B] font-semibold"
                      : "text-secondary font-semibold"
                    : transparent
                      ? "text-white/90 hover:text-[#A9C77B]"
                      : "text-ink hover:text-secondary"
                }`}
              >
                {item.isLogo ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src="/logo.ico"
                    alt="Partaway"
                    className="h-10 w-auto object-contain"
                  />
                ) : (
                  item.label
                )}
              </Link>
            );
          })}
        </nav>

        {/* 3. End: Sign in button + Mobile Menu Toggle */}
        <div className="justify-self-end flex items-center gap-2">
          <Link
            href="/sign-in"
            className="inline-flex min-h-10 items-center justify-center rounded-[5px] bg-primary active:bg-primary-active px-4 py-1.5 text-[14px] font-semibold text-on-primary shadow-card transition-colors"
          >
            {t("Đăng nhập", "Sign in")}
          </Link>

          <button
            type="button"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-header-nav"
            aria-label={t("Mở menu điều hướng", "Open navigation menu")}
            onClick={() => setMobileMenuOpen((v) => !v)}
            className={`inline-flex min-h-10 items-center justify-center rounded-[5px] border px-2.5 py-1.5 text-[13px] font-medium md:hidden transition-colors ${
              transparent
                ? "border-white/30 bg-black/25 text-white hover:bg-black/40"
                : "border-hairline bg-surface text-ink hover:bg-canvas-soft"
            }`}
          >
            {mobileMenuOpen ? t("Đóng", "Close") : "Menu"}
          </button>
        </div>
      </div>

      {/* Mobile Nav Drawer */}
      {mobileMenuOpen ? (
        <nav
          id="mobile-header-nav"
          aria-label={t("Điều hướng di động", "Mobile navigation")}
          className="border-t border-hairline bg-surface px-4 py-3 md:hidden"
        >
          <ul className="flex flex-col gap-1">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex min-h-11 items-center px-3 py-2 text-[15px] font-medium text-ink transition-colors hover:text-secondary"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
