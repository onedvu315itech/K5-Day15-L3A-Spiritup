"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { formatDate } from "@/lib/format";
import {
  ensureDemoSession,
  listSavedTrips,
  removeTripSession,
} from "@/lib/storage";

const emptySubscribe = () => () => {};

const HERO_STICKERS = [
  { label: "Đồi chè Cầu Đất · 05:15", dot: "bg-accent-teal" },
  { label: "Lẩu gà lá é Tao Ngộ · Đã kiểm giờ mở", dot: "bg-accent-orange" },
  { label: "Tiệm cà phê Túi Mơ To · TikTok", dot: "bg-accent-pink" },
  { label: "Đề xuất #7 · 3/4 đồng ý", dot: "bg-accent-green" },
  { label: "Dinh Bảo Đại III · Ngày 2", dot: "bg-accent-purple" },
  { label: "Tổng dự kiến 2.150.000 đ/người", dot: "bg-accent-sky" },
];

export default function HomePage() {
  const router = useRouter();
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const [, setRefreshTick] = useState(0);
  const [inviteInput, setInviteInput] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);

  const savedTrips = isClient ? listSavedTrips() : [];
  const loaded = isClient;

  const handleOpenDemo = () => {
    ensureDemoSession("leader");
    router.push("/trips/demo-dalat-3n2d");
  };

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = inviteInput.trim();
    if (!raw) {
      setInviteError("Hãy nhập mã mời hoặc dán đường link mời của nhóm.");
      return;
    }
    const code = raw.includes("/join/")
      ? raw.split("/join/").pop()?.split(/[?#]/)[0] ?? ""
      : raw;
    if (!code) {
      setInviteError("Mã mời chưa hợp lệ. Ví dụ: dalat3n2d0.");
      return;
    }
    setInviteError(null);
    router.push(`/join/${encodeURIComponent(code)}`);
  };

  const handleRemoveSaved = (tripId: string) => {
    removeTripSession(tripId);
    setRefreshTick((t) => t + 1);
  };

  return (
    <div className="space-y-12 pb-12">
      {/* Full-bleed deep indigo hero band (the single dark island per DESIGN.md) */}
      <section className="bg-secondary text-on-primary">
        <div className="mx-auto max-w-[1280px] px-4 py-12 sm:px-6 sm:py-16">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.85fr)] lg:items-center">
            <div className="space-y-5">
              <span className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1 type-eyebrow text-primary">
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent-sky" />
                Lịch trình du lịch nhóm · Đà Lạt
              </span>
              <h1 className="type-display-1 text-on-primary">
                Chốt lịch đi Đà Lạt cùng cả nhóm, không còn cảnh đến nơi quán đóng cửa.
              </h1>
              <p className="max-w-[60ch] text-[16px] leading-[1.5] text-white/85">
                Nhóm trưởng nhập nhu cầu chuyến đi, trợ lý <strong className="font-semibold text-white">Roa</strong> xếp lịch theo ngày từ giờ mở cửa thực tế và kho quán đang được quan tâm. Cả nhóm vào bằng link mời để góp ý, bỏ phiếu công khai và hỏi đáp trực tiếp.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  href="/trips/new"
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-primary active:bg-primary-active active:scale-[0.97] px-6 py-3 text-[16px] font-medium text-on-primary transition-[transform,background-color]"
                >
                  Tạo chuyến đi mới
                </Link>
                <button
                  type="button"
                  onClick={handleOpenDemo}
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-surface active:scale-[0.97] px-6 py-3 text-[16px] font-medium text-ink shadow-notion-2 transition-transform"
                >
                  Mở chuyến đi mẫu Đà Lạt 3N2Đ
                </button>
              </div>
            </div>

            {/* Decorative sticker constellation */}
            <div
              aria-hidden="true"
              className="hidden lg:flex flex-wrap gap-2.5 justify-end content-center"
            >
              {HERO_STICKERS.map((sticker) => (
                <span
                  key={sticker.label}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-2 text-[13px] font-medium text-white backdrop-blur-xs"
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${sticker.dot}`} />
                  {sticker.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Warm paper daylight sections */}
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 space-y-12">
        {/* Join via invite code card + quick 3-step summary */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:items-stretch">
          <div className="rounded-[12px] border border-hairline bg-surface p-6 shadow-notion-1 flex flex-col justify-between space-y-4">
            <div>
              <h2 className="type-heading-3 text-ink">Tham gia bằng mã mời</h2>
              <p className="mt-1.5 text-[15px] text-ink-muted">
                Không cần tạo tài khoản. Nhập mã hoặc dán link nhóm trưởng đã gửi để xem lịch và bỏ phiếu.
              </p>
            </div>

            <form onSubmit={handleJoinByCode} className="space-y-3" noValidate>
              <div>
                <label
                  htmlFor="home-invite-code"
                  className="block text-[13px] font-semibold text-ink mb-1.5"
                >
                  Mã mời hoặc đường link
                </label>
                <input
                  id="home-invite-code"
                  name="invite_code"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  value={inviteInput}
                  onChange={(e) => {
                    setInviteInput(e.target.value);
                    if (inviteError) setInviteError(null);
                  }}
                  aria-invalid={inviteError ? "true" : "false"}
                  aria-describedby={
                    inviteError ? "home-invite-err" : "home-invite-hint"
                  }
                  placeholder="Ví dụ: dalat3n2d0…"
                  className="notion-input min-h-11 w-full px-3 py-2 text-[15px]"
                />
                <span
                  id="home-invite-hint"
                  className="mt-1.5 block text-[13px] text-ink-muted"
                >
                  Dùng thử nhanh với mã mẫu{" "}
                  <span
                    translate="no"
                    className="font-mono font-semibold text-ink"
                  >
                    dalat3n2d0
                  </span>
                  .
                </span>
                {inviteError ? (
                  <p
                    id="home-invite-err"
                    role="status"
                    className="mt-1 text-[13px] font-medium text-accent-orange-deep"
                  >
                    {inviteError}
                  </p>
                ) : null}
              </div>

              <button
                type="submit"
                className="min-h-11 w-full rounded-[8px] border border-hairline bg-surface px-4 py-2 text-[15px] font-medium text-ink hover:bg-canvas-soft transition-colors"
              >
                Mở trang tham gia
              </button>
            </form>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-[12px] border border-hairline bg-surface p-6 space-y-2">
              <span
                aria-hidden="true"
                className="inline-block h-3 w-3 rounded-full bg-accent-teal"
              />
              <h3 className="type-title text-ink">Dữ liệu thật</h3>
              <p className="text-[14px] text-ink-muted leading-relaxed">
                Giờ mở cửa, khoảng cách và chi phí từng điểm được kiểm từ Google Places &amp; kho quán Đà Lạt.
              </p>
            </div>
            <div className="rounded-[12px] border border-hairline bg-surface p-6 space-y-2">
              <span
                aria-hidden="true"
                className="inline-block h-3 w-3 rounded-full bg-accent-purple ring-1 ring-accent-purple-deep/40"
              />
              <h3 className="type-title text-ink">Roa soạn, bạn duyệt</h3>
              <p className="text-[14px] text-ink-muted leading-relaxed">
                Roa chỉ trả bản nháp hoặc nói rõ khi không xếp được. Mọi phiên bản v1, v2 đều do nhóm trưởng chốt.
              </p>
            </div>
            <div className="rounded-[12px] border border-hairline bg-surface p-6 space-y-2">
              <span
                aria-hidden="true"
                className="inline-block h-3 w-3 rounded-full bg-accent-green"
              />
              <h3 className="type-title text-ink">Phiếu công khai</h3>
              <p className="text-[14px] text-ink-muted leading-relaxed">
                Thành viên góp ý, bỏ phiếu rõ tên và theo dõi lịch sử thay đổi giữa các phiên bản.
              </p>
            </div>
          </div>
        </section>

        {/* Saved trips from localStorage */}
        <section aria-labelledby="saved-trips-heading" className="space-y-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="saved-trips-heading" className="type-heading-2 text-ink">
              Chuyến đi trên thiết bị này
            </h2>
            <span className="text-[13px] text-ink-muted">
              Lưu phiên làm việc theo từng chuyến đi trong trình duyệt
            </span>
          </div>

          {!loaded ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="h-36 rounded-[12px] border border-hairline bg-surface animate-pulse" />
              <div className="h-36 rounded-[12px] border border-hairline bg-surface animate-pulse" />
            </div>
          ) : savedTrips.length === 0 ? (
            <div className="rounded-[16px] border border-hairline bg-surface p-8 text-center space-y-4">
              <p className="text-[16px] text-ink-muted">
                Bạn chưa mở chuyến đi nào trên trình duyệt này. Hãy tạo chuyến đi mới hoặc xem thử chuyến đi mẫu Đà Lạt 3N2Đ.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link
                  href="/trips/new"
                  className="inline-flex min-h-11 items-center rounded-full bg-primary active:bg-primary-active px-5 py-2 text-[15px] font-medium text-on-primary transition-colors"
                >
                  Tạo chuyến đi đầu tiên
                </Link>
                <button
                  type="button"
                  onClick={handleOpenDemo}
                  className="inline-flex min-h-11 items-center rounded-[8px] border border-hairline bg-surface px-4 py-2 text-[15px] font-medium text-ink hover:bg-canvas-soft transition-colors"
                >
                  Xem chuyến đi mẫu
                </button>
              </div>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {savedTrips.map((item) => (
                <li
                  key={item.tripId}
                  className="flex flex-col justify-between rounded-[12px] border border-hairline bg-surface p-6 space-y-4"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center justify-between gap-2 text-[12px]">
                      <span className="font-semibold text-primary">
                        {item.destination}
                      </span>
                      <span className="rounded-[5px] bg-canvas-soft px-2 py-0.5 font-medium text-ink-secondary">
                        {item.role === "leader" ? "Nhóm trưởng" : "Thành viên"}
                      </span>
                    </div>
                    <h3 className="type-title text-ink truncate">
                      {item.title}
                    </h3>
                    <p className="text-[13px] text-ink-muted tabular-nums">
                      {formatDate(item.startDate)} – {formatDate(item.endDate)} · Tên: {item.displayName}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-hairline pt-3">
                    <Link
                      href={`/trips/${encodeURIComponent(item.tripId)}`}
                      className="inline-flex min-h-10 items-center rounded-[8px] bg-primary active:bg-primary-active px-3.5 py-1.5 text-[14px] font-medium text-on-primary transition-colors"
                    >
                      Vào không gian chuyến đi
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleRemoveSaved(item.tripId)}
                      className="min-h-10 rounded-[8px] px-2.5 py-1.5 text-[13px] font-medium text-ink-muted hover:text-accent-orange-deep transition-colors"
                    >
                      Gỡ khỏi máy
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
