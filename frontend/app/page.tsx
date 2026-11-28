"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { formatDate, formatVnd } from "@/lib/format";
import { useLocale } from "@/lib/i18n";
import {
  ensureDemoSession,
  listSavedTrips,
  removeTripSession,
} from "@/lib/storage";
import { TRIP_TEMPLATES } from "@/lib/trip-templates";

const emptySubscribe = () => () => {};

const REGIONS = [
  { key: "Tất cả", vi: "Tất cả", en: "All" },
  { key: "Tây Nguyên", vi: "Tây Nguyên", en: "Central Highlands" },
  { key: "Miền Trung", vi: "Miền Trung", en: "Central Vietnam" },
  { key: "Miền Nam", vi: "Miền Nam", en: "Southern Vietnam" },
  { key: "Tây Bắc", vi: "Tây Bắc", en: "Northwest" },
];

export default function HomePage() {
  const router = useRouter();
  const { locale, t } = useLocale();
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const [, setRefreshTick] = useState(0);
  const [inviteInput, setInviteInput] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string>("Tất cả");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    TRIP_TEMPLATES[0].id,
  );

  const savedTrips = isClient ? listSavedTrips() : [];
  const loaded = isClient;

  const visibleTemplates =
    selectedRegion === "Tất cả"
      ? TRIP_TEMPLATES
      : TRIP_TEMPLATES.filter((tpl) => tpl.region === selectedRegion);

  const activeTemplate =
    TRIP_TEMPLATES.find((tpl) => tpl.id === selectedTemplateId) ??
    TRIP_TEMPLATES[0];

  const workflowSteps = [
    {
      step: "01",
      role: t("Nhóm trưởng", "Leader"),
      title: t("Chọn mẫu hoặc nhập yêu cầu", "Pick a template or enter needs"),
      desc: t(
        "Điền điểm đến bất kỳ tại Việt Nam, ngân sách, số người và ràng buộc. Roa lập bản nháp theo ngày và giờ, hoặc nói rõ nếu không xếp được.",
        "Enter any Vietnam destination, budget, group size, and constraints. Roa drafts a day-by-day plan or explains why it is infeasible.",
      ),
      dot: "bg-primary",
    },
    {
      step: "02",
      role: t("Thành viên", "Members"),
      title: t("Vào bằng link mời, không cần tài khoản", "Join via invite link, no account"),
      desc: t(
        "Nhập tên hiển thị để xem lịch trình, gửi góp ý gắn ngày/mục, bỏ phiếu công khai và hỏi đáp trực tiếp với Roa trên khung chat chung.",
        "Enter a display name to view the plan, submit day/item feedback, vote publicly on proposals, and ask Roa in the shared group chat.",
      ),
      dot: "bg-secondary",
    },
    {
      step: "03",
      role: t("Cả nhóm", "Group"),
      title: t("Đề xuất & chốt v2, không ghi đè", "Propose & approve v2, immutable"),
      desc: t(
        "Mọi lần sửa đi qua đề xuất và phiếu tham khảo. Nhóm trưởng quyết định áp dụng thành phiên bản mới hoặc đóng để tham khảo.",
        "Every edit goes through a proposal and public votes. The leader decides whether to apply as a new version or close for reference.",
      ),
      dot: "bg-tertiary",
    },
  ];

  const faqs = [
    {
      q: t(
        "Thành viên có cần tạo tài khoản không?",
        "Do group members need an account?",
      ),
      a: t(
        "Không. Nhóm trưởng chỉ cần gửi link mời, thành viên nhập tên hiển thị là có thể xem lịch trình, góp ý, bỏ phiếu và hỏi Roa ngay.",
        "No. The leader shares an invite link; members just enter a display name to view the plan, send feedback, vote, and ask Roa.",
      ),
    },
    {
      q: t(
        "Roa có tự ý sửa lịch trình của nhóm không?",
        "Does Roa ever edit the group plan directly?",
      ),
      a: t(
        "Không bao giờ. Roa chỉ trả bản nháp hoặc soạn đề xuất khi nhóm trưởng nhờ. Mọi phiên bản mới (v1, v2…) đều do nhóm trưởng chốt.",
        "Never. Roa only returns a draft or prepares a proposal when asked by the leader. Every version (v1, v2…) is approved by the leader.",
      ),
    },
    {
      q: t(
        "Nếu ngân sách hoặc giờ mở cửa không khả thi?",
        "What if budget or opening hours are infeasible?",
      ),
      a: t(
        "Roa sẽ nói rõ lý do không xếp được thay vì tự bịa địa điểm hay vượt ngân sách, để nhóm trưởng điều chỉnh lại yêu cầu.",
        "Roa clearly reports the infeasibility reasons instead of inventing places or exceeding the budget so the leader can adjust.",
      ),
    },
  ];

  const blogPosts = [
    {
      id: "dalat-morning",
      tag: t("Đà Lạt · Kinh nghiệm", "Da Lat · Field notes"),
      title: t(
        "Cách xếp lịch săn mây Cầu Đất 05:15 không bị lỡ giờ ăn sáng",
        "Timing Cau Dat 05:15 cloud hunting without missing breakfast hours",
      ),
      excerpt: t(
        "Nhóm 6 người thường trễ 30 phút nếu không tách khung giờ di chuyển đèo và giờ mở cửa quán cà phê đồi.",
        "Groups of 6+ easily slip by 30 minutes unless mountain travel time and early cafe opening hours are paired properly.",
      ),
      image: "/images/tpl-dalat.jpg",
      imageAlt: t(
        "Đồi chè Cầu Đất trong sương sớm tại Đà Lạt",
        "Cau Dat tea hills in morning mist in Da Lat",
      ),
      templateId: "dalat-chill",
    },
    {
      id: "hoian-group",
      tag: t("Hội An · Nhóm đông", "Hoi An · Large groups"),
      title: t(
        "Mẹo chia ngân sách ăn uống và xe nhóm khi đi Đà Nẵng – Hội An",
        "Splitting group transport and dining budgets in Da Nang – Hoi An",
      ),
      excerpt: t(
        "Chốt trước phương tiện 7–16 chỗ và gom các điểm cùng cung đường biển giúp tiết kiệm hơn 25% thời gian di chuyển.",
        "Aligning on group transport upfront and clustering coastal stops cuts transit time by over 25%.",
      ),
      image: "/images/tpl-hoian.jpg",
      imageAlt: t(
        "Phố cổ Hội An rực rỡ đèn lồng bên sông Thu Bồn",
        "Hoi An Ancient Town glowing with lanterns by the river",
      ),
      templateId: "danang-hoian",
    },
  ];

  const handleOpenDemo = () => {
    ensureDemoSession("leader");
    router.push("/trips/demo-dalat-3n2d");
  };

  const handleJoinByCode = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = inviteInput.trim();
    if (!raw) {
      setInviteError(
        t(
          "Hãy nhập mã mời hoặc dán đường link mời của nhóm.",
          "Please enter an invite code or paste your group's invite link.",
        ),
      );
      return;
    }
    const code = raw.includes("/join/")
      ? raw.split("/join/").pop()?.split(/[?#]/)[0] ?? ""
      : raw;
    if (!code) {
      setInviteError(
        t(
          "Mã mời chưa hợp lệ. Ví dụ: dalat3n2d0.",
          "Invalid invite code. Example: dalat3n2d0.",
        ),
      );
      return;
    }
    setInviteError(null);
    router.push(`/join/${encodeURIComponent(code)}`);
  };

  const handleRemoveSaved = (tripId: string) => {
    removeTripSession(tripId);
    setRefreshTick((tick) => tick + 1);
  };

  return (
    <div className="space-y-14 pb-16">
      {/* 1. Full-Screen Minimal Vietnam Banner */}
      <section className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden border-b border-hairline bg-ink text-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/hero-vietnam.jpg"
          alt={t(
            "Đồi chè và rừng thông Đà Lạt trong sương sớm Việt Nam",
            "Misty pine forests and tea hills in Da Lat, Vietnam at sunrise",
          )}
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#1c1917]/80 via-[#1c1917]/45 to-[#1c1917]/40"
        />

        <div className="relative mx-auto max-w-3xl px-4 pt-20 pb-12 text-center sm:px-6 space-y-6">
          <h1 className="type-display-1 text-white">
            {t(
              "Chốt lịch du lịch nhóm thật nhẹ nhàng.",
              "Plan group trips across Vietnam with ease.",
            )}
          </h1>

          <p className="mx-auto max-w-[48ch] text-[17px] leading-[1.6] text-white/90 sm:text-[19px]">
            {t(
              "Roa lo giờ mở cửa, cả nhóm cùng bỏ phiếu trên một trang.",
              "Real opening hours by Roa, one shared space for your group.",
            )}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href={`/trips/new?template=${encodeURIComponent(activeTemplate.id)}`}
              className="inline-flex min-h-12 items-center justify-center rounded-[5px] bg-primary active:bg-primary-active active:scale-[0.97] px-6 py-3 text-[16px] font-semibold text-on-primary shadow-elevated transition-[transform,background-color]"
            >
              {t("Tạo lịch mới", "Create new plan")}
            </Link>
            <Link
              href="/join-a-plan"
              className="inline-flex min-h-12 items-center justify-center rounded-[5px] border border-white/40 bg-white/95 hover:bg-white active:scale-[0.97] px-6 py-3 text-[16px] font-semibold text-secondary shadow-elevated transition-transform"
            >
              {t("Tham gia lịch", "Join a plan")}
            </Link>
          </div>
        </div>
      </section>

      {/* 2. Backpack Traveler 2-Column Editorial Feed + Sticky Sidebar */}
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.65fr)_340px] lg:items-start">
          {/* Left Main Column: Trip Templates + Workflow Overview */}
          <div className="min-w-0 space-y-12">
            <section aria-labelledby="templates-heading" className="space-y-6">
              <div className="flex flex-wrap items-end justify-between gap-3 border-b border-hairline pb-4">
                <div className="space-y-1">
                  <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-secondary">
                    <span aria-hidden="true" className="h-2 w-2 rounded-full bg-primary" />
                    {t("Hành trình gợi ý tại Việt Nam", "Curated Vietnam Routes")}
                  </span>
                  <h2 id="templates-heading" className="type-heading-2 text-ink">
                    {t("Chọn mẫu chuyến đi để bắt đầu", "Choose a trip template")}
                  </h2>
                </div>
                <Link
                  href="/trips/new"
                  className="text-[14px] font-medium text-secondary hover:underline"
                >
                  {t("Tạo lịch trình trắng →", "Start from scratch →")}
                </Link>
              </div>

              {/* Region filter bar */}
              <div
                className="flex flex-wrap items-center gap-2"
                role="group"
                aria-label={t("Lọc mẫu theo vùng miền", "Filter templates by region")}
              >
                {REGIONS.map((region) => {
                  const active = selectedRegion === region.key;
                  return (
                    <button
                      key={region.key}
                      type="button"
                      onClick={() => setSelectedRegion(region.key)}
                      aria-pressed={active}
                      className={`min-h-9 rounded-[5px] border px-3.5 py-1 text-[13px] font-medium transition-colors ${
                        active
                          ? "border-primary bg-primary text-on-primary"
                          : "border-hairline bg-surface text-ink-secondary hover:bg-canvas-soft"
                      }`}
                    >
                      {locale === "en" ? region.en : region.vi}
                    </button>
                  );
                })}
              </div>

              {/* Editorial Photo Cards Grid */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {visibleTemplates.map((tpl) => {
                  const selected = tpl.id === activeTemplate.id;
                  return (
                    <article
                      key={tpl.id}
                      className={`group flex flex-col justify-between overflow-hidden rounded-[12px] border bg-surface transition-all ${
                        selected
                          ? "border-primary shadow-elevated ring-1 ring-primary/40"
                          : "border-hairline shadow-card hover:border-primary/60"
                      }`}
                    >
                      <div>
                        <div className="relative aspect-[16/10] w-full overflow-hidden bg-canvas-soft">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={tpl.image}
                            alt={locale === "en" ? tpl.imageAltEn : tpl.imageAlt}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          />
                          <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-2 p-3">
                            <span className="rounded-full bg-surface/95 px-2.5 py-0.5 text-[11px] font-semibold text-secondary shadow-card">
                              {tpl.destination}
                            </span>
                            <span className="rounded-full bg-ink/75 px-2.5 py-0.5 text-[11px] font-medium text-white backdrop-blur-xs">
                              {locale === "en" ? tpl.badgeEn : tpl.badge}
                            </span>
                          </div>
                        </div>

                        <div className="p-5 space-y-3">
                          <div className="flex items-center gap-2 text-[12px] font-medium text-ink-muted tabular-nums">
                            <span>{locale === "en" ? tpl.regionEn : tpl.region}</span>
                            <span>·</span>
                            <span>
                              {locale === "en"
                                ? tpl.durationLabelEn
                                : tpl.durationLabel}
                            </span>
                            <span>·</span>
                            <span>
                              {tpl.groupSize} {t("người", "people")}
                            </span>
                          </div>

                          <h3 className="type-title text-ink leading-snug">
                            {locale === "en" ? tpl.titleEn : tpl.title}
                          </h3>
                          <p className="text-[13px] text-ink-secondary leading-relaxed">
                            {locale === "en" ? tpl.summaryEn : tpl.summary}
                          </p>

                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {tpl.highlights.map((hl) => (
                              <span
                                key={hl}
                                className="inline-flex items-center gap-1.5 rounded-[6px] bg-canvas-soft px-2 py-1 text-[12px] text-ink-secondary"
                              >
                                <span
                                  aria-hidden="true"
                                  className="h-1.5 w-1.5 rounded-full bg-tertiary"
                                />
                                {hl}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 border-t border-hairline px-5 py-3.5 bg-canvas-soft/50">
                        <span className="text-[13px] font-semibold text-ink tabular-nums">
                          ~{formatVnd(tpl.budgetPerPerson)}/{t("người", "person")}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedTemplateId(tpl.id)}
                            aria-pressed={selected}
                            className={`min-h-9 rounded-[5px] border px-2.5 py-1 text-[12px] font-medium transition-colors ${
                              selected
                                ? "border-secondary/40 bg-surface text-secondary"
                                : "border-hairline bg-surface text-ink-muted hover:text-ink"
                            }`}
                          >
                            {selected
                              ? t("✓ Đã chọn", "✓ Selected")
                              : t("Chọn", "Select")}
                          </button>
                          <Link
                            href={`/trips/new?template=${encodeURIComponent(tpl.id)}`}
                            className="inline-flex min-h-9 items-center justify-center rounded-[5px] bg-primary active:bg-primary-active px-3.5 py-1 text-[13px] font-semibold text-on-primary transition-colors"
                          >
                            {t("Dùng mẫu này", "Use template")}
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            {/* Project Overview: 3-Step Workflow */}
            <section aria-labelledby="workflow-heading" className="space-y-5">
              <div className="border-b border-hairline pb-3">
                <h2 id="workflow-heading" className="type-heading-3 text-ink">
                  {t(
                    "Cách Partaway & Roa vận hành cho nhóm bạn",
                    "How Partaway & Roa work for your group",
                  )}
                </h2>
                <p className="mt-1 text-[14px] text-ink-muted">
                  {t(
                    "Tách bạch vai trò để cả nhóm bàn bạc nhanh, không mất dấu quyết định và không để AI tự sửa lịch.",
                    "Clear roles keep group planning fast, decisions traceable, and AI edits strictly under leader control.",
                  )}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.15fr_1fr_0.95fr]">
                {workflowSteps.map((item) => (
                  <div
                    key={item.step}
                    className="rounded-[12px] border border-hairline bg-surface p-5 shadow-card space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-secondary">
                        <span
                          aria-hidden="true"
                          className={`h-2 w-2 rounded-full ${item.dot}`}
                        />
                        {item.role}
                      </span>
                      <span className="text-[12px] font-bold text-ink-faint tabular-nums">
                        {item.step}
                      </span>
                    </div>
                    <h3 className="text-[15px] font-semibold text-ink">
                      {item.title}
                    </h3>
                    <p className="text-[13px] text-ink-secondary leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Right Editorial Sidebar */}
          <aside className="space-y-6 lg:sticky lg:top-20">
            {/* Widget 1: About Partaway */}
            <section className="rounded-[12px] border border-hairline bg-surface p-5 shadow-card space-y-3">
              <div className="flex items-center gap-2 border-b border-hairline pb-3">
                <span
                  aria-hidden="true"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] bg-primary text-on-primary text-[13px] font-bold"
                >
                  R
                </span>
                <div>
                  <h2 className="text-[15px] font-bold text-ink">
                    {t("Về Partaway & Roa", "About Partaway & Roa")}
                  </h2>
                  <p className="text-[12px] text-ink-muted">
                    {t("Nhóm Spiritup · Track Du lịch", "Spiritup Team · Travel Track")}
                  </p>
                </div>
              </div>
              <p className="text-[13px] text-ink-secondary leading-relaxed">
                {t(
                  "Nhóm đông thường tốn nhiều ngày chốt lịch vì sở thích và ngân sách khác nhau, giờ mở cửa sai lệch và quán hot rải rác trên TikTok/Instagram. Partaway gom toàn bộ lịch trình, góp ý, bỏ phiếu và hỏi Roa vào một không gian duy nhất.",
                  "Large groups waste days aligning preferences, budgets, scattered opening hours, and trending spots. Partaway brings the itinerary, feedback, public votes, and Roa Q&A into one shared page.",
                )}
              </p>
              <dl className="grid grid-cols-3 gap-2 rounded-[8px] bg-canvas-soft p-3 text-center text-[12px]">
                <div>
                  <dt className="text-ink-muted">{t("Điểm đến", "Coverage")}</dt>
                  <dd className="font-bold text-ink">{t("Toàn VN", "All VN")}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">{t("Tài khoản", "Sign up")}</dt>
                  <dd className="font-bold text-secondary">
                    {t("Không cần", "None")}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-muted">{t("Phiên bản", "History")}</dt>
                  <dd className="font-bold text-tertiary">
                    {t("Bất biến", "Immutable")}
                  </dd>
                </div>
              </dl>
            </section>

            {/* Widget 2: Join via Invite Code */}
            <section className="rounded-[12px] border border-hairline bg-surface p-5 shadow-card space-y-4">
              <div>
                <h2 className="text-[16px] font-bold text-ink">
                  {t("Tham gia bằng mã mời", "Join with invite code")}
                </h2>
                <p className="mt-1 text-[13px] text-ink-muted">
                  {t(
                    "Nhập mã hoặc dán đường link từ nhóm trưởng để xem lịch và bỏ phiếu ngay.",
                    "Enter the code or paste your leader's invite link to view and vote.",
                  )}
                </p>
              </div>

              <form onSubmit={handleJoinByCode} className="space-y-3" noValidate>
                <div>
                  <label
                    htmlFor="home-invite-code"
                    className="block text-[12px] font-semibold text-ink mb-1"
                  >
                    {t("Mã mời hoặc đường link", "Invite code or link")}
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
                    placeholder={t("Ví dụ: dalat3n2d0…", "Example: dalat3n2d0…")}
                    className="nomad-input min-h-11 w-full px-3 py-2 text-[14px]"
                  />
                  <span
                    id="home-invite-hint"
                    className="mt-1.5 block text-[12px] text-ink-muted"
                  >
                    {t("Mã mẫu dùng thử:", "Sample invite code:")}{" "}
                    <span
                      translate="no"
                      className="font-mono font-semibold text-secondary"
                    >
                      dalat3n2d0
                    </span>
                  </span>
                  {inviteError ? (
                    <p
                      id="home-invite-err"
                      role="status"
                      className="mt-1 text-[12px] font-medium text-error"
                    >
                      {inviteError}
                    </p>
                  ) : null}
                </div>

                <button
                  type="submit"
                  className="min-h-10 w-full rounded-[5px] border border-secondary/35 bg-surface px-4 py-2 text-[14px] font-medium text-secondary hover:bg-canvas-soft transition-colors"
                >
                  {t("Mở trang tham gia", "Open join page")}
                </button>
              </form>
            </section>

            {/* Widget 3: Quick Pick */}
            <section className="rounded-[12px] border border-hairline bg-canvas-soft p-5 space-y-3">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-secondary">
                {t("Mẫu đang chọn", "Selected template")}
              </p>
              <p className="text-[15px] font-bold text-ink">
                {locale === "en" ? activeTemplate.titleEn : activeTemplate.title}
              </p>
              <p className="text-[12px] text-ink-muted tabular-nums">
                {activeTemplate.destination} ·{" "}
                {locale === "en"
                  ? activeTemplate.durationLabelEn
                  : activeTemplate.durationLabel}{" "}
                · {formatVnd(activeTemplate.budgetPerPerson)}/
                {t("người", "person")}
              </p>
              <Link
                href={`/trips/new?template=${encodeURIComponent(activeTemplate.id)}`}
                className="inline-flex min-h-10 w-full items-center justify-center rounded-[5px] bg-primary active:bg-primary-active px-4 py-2 text-[14px] font-semibold text-on-primary transition-colors"
              >
                {t("Khởi tạo từ mẫu này", "Start from this template")}
              </Link>
            </section>
          </aside>
        </div>
      </div>

      {/* 3. Saved Trips on This Device */}
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <section aria-labelledby="saved-trips-heading" className="space-y-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-hairline pb-3">
            <h2 id="saved-trips-heading" className="type-heading-2 text-ink">
              {t("Chuyến đi trên thiết bị này", "Trips on this device")}
            </h2>
            <span className="text-[13px] text-ink-muted">
              {t(
                "Lưu phiên làm việc theo từng chuyến đi trong trình duyệt",
                "Sessions saved per trip in your browser",
              )}
            </span>
          </div>

          {!loaded ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="h-36 rounded-[12px] border border-hairline bg-surface animate-pulse" />
              <div className="h-36 rounded-[12px] border border-hairline bg-surface animate-pulse" />
            </div>
          ) : savedTrips.length === 0 ? (
            <div className="rounded-[16px] border border-hairline bg-surface p-8 text-center shadow-card space-y-4">
              <p className="text-[16px] text-ink-muted">
                {t(
                  "Bạn chưa mở chuyến đi nào trên trình duyệt này. Hãy chọn một mẫu điểm đến ở trên hoặc xem thử chuyến đi mẫu Đà Lạt 3N2Đ.",
                  "No trips saved in this browser yet. Pick a Vietnam template above or explore the Da Lat 3D2N sample trip.",
                )}
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link
                  href={`/trips/new?template=${encodeURIComponent(activeTemplate.id)}`}
                  className="inline-flex min-h-11 items-center rounded-[5px] bg-primary active:bg-primary-active px-5 py-2 text-[15px] font-semibold text-on-primary transition-colors"
                >
                  {t("Tạo từ mẫu đã chọn", "Create from selected")}
                </Link>
                <button
                  type="button"
                  onClick={handleOpenDemo}
                  className="inline-flex min-h-11 items-center rounded-[5px] border border-secondary/35 bg-surface px-4 py-2 text-[15px] font-medium text-secondary hover:bg-canvas-soft transition-colors"
                >
                  {t("Xem chuyến đi mẫu", "Open sample trip")}
                </button>
              </div>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {savedTrips.map((item) => (
                <li
                  key={item.tripId}
                  className="flex flex-col justify-between rounded-[12px] border border-hairline bg-surface p-6 shadow-card space-y-4"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center justify-between gap-2 text-[12px]">
                      <span className="font-semibold text-secondary">
                        {item.destination}
                      </span>
                      <span className="rounded-[5px] bg-canvas-soft px-2 py-0.5 font-medium text-ink-secondary">
                        {item.role === "leader"
                          ? t("Nhóm trưởng", "Leader")
                          : t("Thành viên", "Member")}
                      </span>
                    </div>
                    <h3 className="type-title text-ink truncate">
                      {item.title}
                    </h3>
                    <p className="text-[13px] text-ink-muted tabular-nums">
                      {formatDate(item.startDate)} – {formatDate(item.endDate)} ·{" "}
                      {t("Tên:", "Name:")} {item.displayName}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-hairline pt-3">
                    <Link
                      href={`/trips/${encodeURIComponent(item.tripId)}`}
                      className="inline-flex min-h-10 items-center rounded-[5px] bg-primary active:bg-primary-active px-3.5 py-1.5 text-[14px] font-semibold text-on-primary transition-colors"
                    >
                      {t("Vào không gian chuyến đi", "Open workspace")}
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleRemoveSaved(item.tripId)}
                      className="min-h-10 rounded-[5px] px-2.5 py-1.5 text-[13px] font-medium text-ink-muted hover:text-error transition-colors"
                    >
                      {t("Gỡ khỏi máy", "Remove")}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* 4. FAQ Section */}
      <section
        aria-labelledby="faq-heading"
        className="mx-auto max-w-[1280px] px-4 sm:px-6 space-y-5"
      >
        <div className="border-b border-hairline pb-3">
          <h2 id="faq-heading" className="type-heading-2 text-ink">
            {t("Câu hỏi thường gặp (FAQ)", "Frequently Asked Questions")}
          </h2>
          <p className="mt-1 text-[14px] text-ink-muted">
            {t(
              "Những điểm quan trọng về cách Partaway và trợ lý Roa làm việc cùng nhóm bạn.",
              "Key details on how Partaway and AI assistant Roa collaborate with your group.",
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {faqs.map((faq) => (
            <div
              key={faq.q}
              className="rounded-[12px] border border-hairline bg-surface p-5 shadow-card space-y-2"
            >
              <h3 className="text-[15px] font-semibold text-ink">{faq.q}</h3>
              <p className="text-[13px] text-ink-secondary leading-relaxed">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Blog / Travel Journal Section */}
      <section
        aria-labelledby="blog-heading"
        className="mx-auto max-w-[1280px] px-4 sm:px-6 space-y-5"
      >
        <div className="border-b border-hairline pb-3">
          <h2 id="blog-heading" className="type-heading-2 text-ink">
            {t("Blog & Kinh nghiệm đi nhóm", "Travel Journal & Group Tips")}
          </h2>
          <p className="mt-1 text-[14px] text-ink-muted">
            {t(
              "Ghi chép thực tế về giờ mở cửa, cung đường và cách chia ngân sách tại Việt Nam.",
              "Field notes on opening hours, route pacing, and group budgets across Vietnam.",
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {blogPosts.map((post) => (
            <article
              key={post.id}
              className="group grid grid-cols-1 overflow-hidden rounded-[12px] border border-hairline bg-surface shadow-card sm:grid-cols-[200px_minmax(0,1fr)]"
            >
              <div className="relative aspect-[16/10] sm:aspect-auto bg-canvas-soft overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={post.image}
                  alt={post.imageAlt}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="p-5 flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-secondary">
                    {post.tag}
                  </span>
                  <h3 className="text-[16px] font-bold text-ink leading-snug">
                    {post.title}
                  </h3>
                  <p className="text-[13px] text-ink-secondary leading-relaxed">
                    {post.excerpt}
                  </p>
                </div>
                <div>
                  <Link
                    href={`/trips/new?template=${encodeURIComponent(post.templateId)}`}
                    className="text-[13px] font-semibold text-secondary hover:underline"
                  >
                    {t("Áp dụng cho chuyến đi →", "Use this route →")}
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* 6. Vietnam Photo Strip */}
      <section
        aria-labelledby="vn-gallery-heading"
        className="mx-auto max-w-[1280px] px-4 sm:px-6 space-y-4"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="vn-gallery-heading"
            className="text-[14px] font-semibold uppercase tracking-wider text-ink-muted"
          >
            {t("Khám phá nhanh điểm đến Việt Nam", "Quick Vietnam Destinations")}
          </h2>
          <span className="text-[13px] text-ink-muted">
            {t(
              "Bấm vào ảnh để tạo chuyến đi theo điểm đến",
              "Click any photo to start a trip there",
            )}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {TRIP_TEMPLATES.map((tpl) => (
            <Link
              key={tpl.id}
              href={`/trips/new?template=${encodeURIComponent(tpl.id)}`}
              className="group relative aspect-[16/10] overflow-hidden rounded-[10px] border border-hairline bg-canvas-soft"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={tpl.image}
                alt={locale === "en" ? tpl.imageAltEn : tpl.imageAlt}
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3 text-white">
                <p className="text-[13px] font-semibold leading-tight">
                  {tpl.destination}
                </p>
                <p className="text-[11px] text-white/80">
                  {locale === "en" ? tpl.durationLabelEn : tpl.durationLabel}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
