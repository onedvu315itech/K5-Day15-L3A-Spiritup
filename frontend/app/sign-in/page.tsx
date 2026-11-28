"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { StatusBanner } from "@/components/status-banner";
import { useLocale } from "@/lib/i18n";

const AUTH_STORAGE_KEY = "partaway:v1:auth_user";
const emptySubscribe = () => () => {};

interface MockAuthUser {
  email: string;
  signedInAt: string;
}

function readStoredAuthUser(): MockAuthUser | null {
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MockAuthUser;
    return parsed && typeof parsed.email === "string" ? parsed : null;
  } catch {
    return null;
  }
}

export default function SignInPage() {
  const { t } = useLocale();
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<{
    tone: "error" | "info" | "success";
    message: string;
  } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [sessionOverride, setSessionOverride] = useState<
    MockAuthUser | null | undefined
  >(undefined);

  const signedInUser: MockAuthUser | null =
    sessionOverride !== undefined
      ? sessionOverride
      : isClient
        ? readStoredAuthUser()
        : null;

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
    } else if (password.length < 6) {
      errors.password = t(
        "Mật khẩu cần có ít nhất 6 ký tự.",
        "Password must be at least 6 characters.",
      );
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);

    if (!validate()) {
      setBanner({
        tone: "error",
        message: t(
          "Vui lòng kiểm tra lại email và mật khẩu trước khi tiếp tục.",
          "Please check your email and password before continuing.",
        ),
      });
      return;
    }

    setSubmitting(true);
    const normalizedEmail = email.trim().toLowerCase();

    window.setTimeout(() => {
      const user: MockAuthUser = {
        email: normalizedEmail,
        signedInAt: new Date().toISOString(),
      };

      if (rememberMe) {
        try {
          window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
        } catch {
          // Ignore storage quota errors.
        }
      }

      setSessionOverride(user);
      setPassword("");
      setSubmitting(false);
      setBanner({
        tone: "success",
        message: t(
          `Đăng nhập thành công với ${normalizedEmail} (chế độ giao diện mẫu).`,
          `Signed in as ${normalizedEmail} (UI preview mode).`,
        ),
      });
    }, 450);
  };

  const handleSignOut = () => {
    try {
      window.localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // Ignore storage errors.
    }
    setSessionOverride(null);
    setBanner({
      tone: "info",
      message: t("Bạn đã đăng xuất khỏi phiên mẫu.", "You have signed out."),
    });
  };

  const handleForgotPassword = () => {
    setBanner({
      tone: "info",
      message: t(
        "Tính năng đặt lại mật khẩu chưa kết nối backend. Bạn có thể nhập email bất kỳ (mật khẩu từ 6 ký tự) để thử giao diện.",
        "Password reset is not connected to a backend yet. Enter any email and a 6+ character password to preview the UI.",
      ),
    });
  };

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

        {banner ? (
          <StatusBanner
            tone={banner.tone}
            message={banner.message}
            onDismiss={() => setBanner(null)}
          />
        ) : null}

        {signedInUser ? (
          <div className="space-y-4 rounded-[12px] border border-hairline bg-canvas-soft/60 p-5">
            <div className="space-y-1">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-secondary">
                {t("Đang đăng nhập (Mẫu)", "Signed in (Preview)")}
              </p>
              <p className="text-[16px] font-semibold text-ink break-all">
                {signedInUser.email}
              </p>
            </div>

            <div className="flex flex-col gap-2.5 sm:flex-row">
              <Link
                href="/trips/demo-dalat-3n2d"
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-[5px] bg-primary active:bg-primary-active px-4 py-2 text-[14px] font-semibold text-on-primary shadow-card transition-colors"
              >
                {t("Mở chuyến đi mẫu", "Open demo trip")}
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex min-h-11 items-center justify-center rounded-[5px] border border-input-border bg-surface px-4 py-2 text-[14px] font-semibold text-ink hover:bg-canvas-soft transition-colors"
              >
                {t("Đăng xuất", "Sign out")}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
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
                  minLength={6}
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
