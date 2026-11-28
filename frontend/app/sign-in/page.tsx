"use client";

import Link from "next/link";
import { useState } from "react";
import { StatusBanner } from "@/components/status-banner";
import { useLocale } from "@/lib/i18n";
import { useAuth } from "@/lib/use-auth";

export default function SignInPage() {
  const { t } = useLocale();
  const { user, loading, submitting, error, login, logout, clearError } =
    useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [notice, setNotice] = useState<{
    tone: "error" | "info" | "success";
    message: string;
  } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  const validate = (): boolean => {
    const errors: { email?: string; password?: string } = {};
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      errors.email = t(
        "Vui lòng nhập địa chỉ email.",
        "Please enter your email address.",
      );
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = t(
        "Địa chỉ email chưa đúng định dạng.",
        "Please enter a valid email address.",
      );
    }

    if (!password) {
      errors.password = t(
        "Vui lòng nhập mật khẩu.",
        "Please enter your password.",
      );
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    clearError();

    if (!validate()) {
      setNotice({
        tone: "error",
        message: t(
          "Vui lòng kiểm tra lại email và mật khẩu trước khi tiếp tục.",
          "Please check your email and password before continuing.",
        ),
      });
      return;
    }

    const signedIn = await login({
      email,
      password,
      rememberMe,
    });

    if (signedIn) {
      setPassword("");
      setNotice({
        tone: "success",
        message: t(
          `Đăng nhập thành công với ${signedIn.email}.`,
          `Signed in successfully as ${signedIn.email}.`,
        ),
      });
    }
  };

  const handleSignOut = async () => {
    setNotice(null);
    clearError();
    await logout();
    setNotice({
      tone: "info",
      message: t("Bạn đã đăng xuất.", "You have signed out."),
    });
  };

  const handleForgotPassword = () => {
    clearError();
    setNotice({
      tone: "info",
      message: t(
        "Tài khoản được đồng bộ từ cấu hình EMAIL và PASSWORD trên máy chủ.",
        "Account credentials are configured via EMAIL and PASSWORD on the server.",
      ),
    });
  };

  const activeBanner = error
    ? { tone: "error" as const, message: error }
    : notice;

  return (
    <div className="mx-auto max-w-lg px-4 py-10 sm:px-6 sm:py-14">
      <div className="rounded-[16px] border border-hairline bg-surface p-6 sm:p-8 shadow-card space-y-6">
        <div className="space-y-2 border-b border-hairline pb-5">
          <span className="inline-flex items-center rounded-full bg-canvas-soft px-3 py-1 text-[12px] font-semibold text-secondary">
            {t("Partaway · Tài khoản", "Partaway · Account")}
          </span>
          <h1 className="type-heading-1 text-ink">
            {t("Đăng nhập", "Sign in")}
          </h1>
          <p className="text-[14px] text-ink-muted">
            {t(
              "Đăng nhập bằng email và mật khẩu để quản lý các chuyến đi của bạn.",
              "Sign in with your email and password to manage your group trips.",
            )}
          </p>
        </div>

        {activeBanner ? (
          <StatusBanner
            tone={activeBanner.tone}
            message={activeBanner.message}
            onDismiss={() => {
              clearError();
              setNotice(null);
            }}
          />
        ) : null}

        {loading ? (
          <div
            aria-label={t(
              "Đang kiểm tra phiên đăng nhập",
              "Checking session",
            )}
            className="space-y-3 py-2 animate-pulse"
          >
            <div className="h-4 w-28 rounded-[6px] bg-canvas-soft" />
            <div className="h-11 w-full rounded-[6px] bg-canvas-soft" />
            <div className="h-4 w-28 rounded-[6px] bg-canvas-soft" />
            <div className="h-11 w-full rounded-[6px] bg-canvas-soft" />
            <div className="h-12 w-full rounded-[5px] bg-canvas-soft" />
          </div>
        ) : user ? (
          <div className="space-y-4 rounded-[12px] border border-hairline bg-canvas-soft/60 p-5">
            <div className="space-y-1">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-secondary">
                {t("Đang đăng nhập", "Signed in")}
              </p>
              <p className="text-[16px] font-semibold text-ink break-all">
                {user.email}
              </p>
              {user.display_name ? (
                <p className="text-[13px] text-ink-muted">
                  {t("Tên hiển thị:", "Display name:")} {user.display_name}
                </p>
              ) : null}
            </div>

            <div className="flex flex-col gap-2.5 sm:flex-row">
              <Link
                href="/trips/new"
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-[5px] bg-primary active:bg-primary-active px-4 py-2 text-[14px] font-semibold text-on-primary shadow-card transition-colors"
              >
                {t("Tạo chuyến đi mới", "Create a new trip")}
              </Link>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleSignOut()}
                className="inline-flex min-h-11 items-center justify-center rounded-[5px] border border-input-border bg-surface px-4 py-2 text-[14px] font-semibold text-ink hover:bg-canvas-soft transition-colors disabled:opacity-60"
              >
                {submitting
                  ? t("Đang đăng xuất…", "Signing out…")
                  : t("Đăng xuất", "Sign out")}
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => void handleSubmit(e)}
            noValidate
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label
                htmlFor="signin-email"
                className="block text-[14px] font-semibold text-ink"
              >
                {t("Email", "Email")}
              </label>
              <input
                id="signin-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (fieldErrors.email) {
                    setFieldErrors((prev) => ({ ...prev, email: undefined }));
                  }
                }}
                placeholder="ban@example.com"
                aria-invalid={Boolean(fieldErrors.email)}
                aria-describedby={
                  fieldErrors.email ? "signin-email-error" : undefined
                }
                className="nomad-input w-full min-h-11 px-3.5 py-2.5 text-[15px]"
              />
              {fieldErrors.email ? (
                <p
                  id="signin-email-error"
                  className="text-[13px] font-medium text-error"
                >
                  {fieldErrors.email}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="signin-password"
                  className="block text-[14px] font-semibold text-ink"
                >
                  {t("Mật khẩu", "Password")}
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="rounded-[5px] px-1.5 py-0.5 text-[13px] font-medium text-secondary hover:underline"
                >
                  {t("Quên mật khẩu?", "Forgot password?")}
                </button>
              </div>

              <div className="relative">
                <input
                  id="signin-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (fieldErrors.password) {
                      setFieldErrors((prev) => ({
                        ...prev,
                        password: undefined,
                      }));
                    }
                  }}
                  placeholder={t("Nhập mật khẩu của bạn", "Enter your password")}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={
                    fieldErrors.password ? "signin-password-error" : undefined
                  }
                  className="nomad-input w-full min-h-11 pl-3.5 pr-12 py-2.5 text-[15px]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={
                    showPassword
                      ? t("Ẩn mật khẩu", "Hide password")
                      : t("Hiện mật khẩu", "Show password")
                  }
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-[5px] text-ink-muted hover:bg-canvas-soft hover:text-ink transition-colors"
                >
                  {showPassword ? (
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
              {fieldErrors.password ? (
                <p
                  id="signin-password-error"
                  className="text-[13px] font-medium text-error"
                >
                  {fieldErrors.password}
                </p>
              ) : null}
            </div>

            <label className="flex min-h-9 cursor-pointer items-center gap-2.5 text-[14px] text-ink-secondary select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded-[4px] border border-input-border accent-secondary"
              />
              <span>{t("Ghi nhớ đăng nhập", "Remember me")}</span>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-[5px] bg-primary active:bg-primary-active px-5 py-2.5 text-[15px] font-semibold text-on-primary shadow-card transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting
                ? t("Đang đăng nhập…", "Signing in…")
                : t("Đăng nhập", "Sign in")}
            </button>
          </form>
        )}

        <div className="border-t border-hairline pt-4 flex flex-col gap-2 text-[13px] text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <span>
            {t(
              "Có mã mời từ nhóm trưởng?",
              "Have an invite code from your trip leader?",
            )}
          </span>
          <Link
            href="/join-a-plan"
            className="font-semibold text-secondary hover:underline"
          >
            {t("Tham gia bằng mã", "Join via code")}
          </Link>
        </div>
      </div>
    </div>
  );
}
