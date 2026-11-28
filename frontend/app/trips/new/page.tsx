"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import { StatusBanner } from "@/components/status-banner";
import { api } from "@/lib/api";
import { formatDate, formatDurationMinutes, formatVnd } from "@/lib/format";
import { useLocale } from "@/lib/i18n";
import { saveTripSession } from "@/lib/storage";
import { getTripTemplateById, TRIP_TEMPLATES } from "@/lib/trip-templates";
import type { GenerateDraftResponse } from "@/lib/types";

const INTEREST_OPTIONS = [
  "Cà phê đồi",
  "Săn mây sáng sớm",
  "Ẩm thực địa phương",
  "Check-in thiên nhiên",
  "Đi dạo nhẹ nhàng",
];

const CONSTRAINT_OPTIONS = [
  "Có người ăn chay",
  "Ít di chuyển xa",
  "Ưu tiên quán mở sớm",
  "Không đi đêm muộn",
];

const TRANSPORT_OPTIONS = [
  { value: "xe máy thuê", label: "Xe máy thuê (linh hoạt đường đèo)" },
  { value: "ô tô / taxi nhóm", label: "Ô tô / taxi nhóm (đỡ nắng mưa)" },
  { value: "đi bộ + xe công nghệ", label: "Đi bộ quanh trung tâm + xe công nghệ" },
];

function addDaysIso(baseIso: string, days: number): string {
  const d = new Date(`${baseIso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function NewTripContent() {
  const router = useRouter();
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const initialTemplate = getTripTemplateById(searchParams.get("template"));
  const formRef = useRef<HTMLFormElement>(null);

  const defaultStart = "2026-12-18";
  const [title, setTitle] = useState(
    initialTemplate?.title ?? "Đà Lạt 3N2Đ",
  );
  const [destination, setDestination] = useState(
    initialTemplate?.destination ?? "Đà Lạt",
  );
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(
    addDaysIso(defaultStart, (initialTemplate?.daysCount ?? 3) - 1),
  );
  const [groupSize, setGroupSize] = useState(
    String(initialTemplate?.groupSize ?? 4),
  );
  const [budget, setBudget] = useState(
    String(initialTemplate?.budgetPerPerson ?? 2500000),
  );
  const [transport, setTransport] = useState(
    initialTemplate?.transport ?? "xe máy thuê",
  );
  const [interests, setInterests] = useState<string[]>(
    initialTemplate?.interests ?? ["Cà phê đồi", "Săn mây sáng sớm"],
  );
  const [constraints, setConstraints] = useState<string[]>(
    initialTemplate?.constraints ?? ["Có người ăn chay"],
  );
  const [extraNote, setExtraNote] = useState(
    initialTemplate?.extraNote ?? "",
  );
  const [leaderName, setLeaderName] = useState("");

  const [createdTrip, setCreatedTrip] = useState<{
    tripId: string;
    token: string;
    memberId: string;
    inviteCode: string;
  } | null>(null);
  const [draftResult, setDraftResult] = useState<GenerateDraftResponse | null>(
    null,
  );
  const [extraRequest, setExtraRequest] = useState("");

  const [generating, setGenerating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const toggleItem = (
    list: string[],
    setList: React.Dispatch<React.SetStateAction<string[]>>,
    value: string,
  ) => {
    setList(
      list.includes(value) ? list.filter((x) => x !== value) : [...list, value],
    );
  };

  const handleCreateAndGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const form = formRef.current;
    if (form && !form.checkValidity()) {
      const firstInvalid = form.querySelector<HTMLElement>(":invalid");
      firstInvalid?.focus();
      form.reportValidity();
      return;
    }

    if (endDate < startDate) {
      setErrorMsg("Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.");
      return;
    }

    const sizeNum = Number(groupSize);
    if (!Number.isInteger(sizeNum) || sizeNum < 2 || sizeNum > 20) {
      setErrorMsg("Số người dự kiến phải từ 2 đến 20 người.");
      return;
    }

    const budgetNum = budget.trim() ? Number(budget) : null;
    if (budgetNum !== null && (!Number.isFinite(budgetNum) || budgetNum <= 0)) {
      setErrorMsg("Ngân sách/người phải là số dương (VND).");
      return;
    }

    setGenerating(true);
    try {
      const allConstraints = extraNote.trim()
        ? [...constraints, extraNote.trim()]
        : constraints;

      let tripId = createdTrip?.tripId;
      let token = createdTrip?.token;
      let memberId = createdTrip?.memberId;
      let inviteCode = createdTrip?.inviteCode;

      if (!tripId || !token || !memberId || !inviteCode) {
        const created = await api.createTrip({
          title: title.trim(),
          destination: destination.trim(),
          start_date: startDate,
          end_date: endDate,
          group_size: sizeNum,
          budget_per_person: budgetNum ? Math.round(budgetNum) : null,
          preferences: {
            interests,
            constraints: allConstraints,
            transport,
          },
          leader_name: leaderName.trim(),
        });
        tripId = created.trip.id;
        token = created.token;
        memberId = created.member.id;
        inviteCode = created.trip.invite_code;
        setCreatedTrip({ tripId, token, memberId, inviteCode });
        saveTripSession({
          tripId,
          title: created.trip.title,
          destination: destination.trim(),
          startDate,
          endDate,
          token,
          memberId,
          displayName: leaderName.trim(),
          role: "leader",
          inviteCode,
          updatedAt: new Date().toISOString(),
        });
      }

      const generated = await api.generateDraft(tripId, token, extraRequest);
      setDraftResult(generated);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Không thể tạo bản nháp lịch trình.",
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerate = async () => {
    if (!createdTrip) return;
    setErrorMsg(null);
    setGenerating(true);
    try {
      const generated = await api.generateDraft(
        createdTrip.tripId,
        createdTrip.token,
        extraRequest,
      );
      setDraftResult(generated);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Không thể tạo lại bản nháp.",
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleApproveV1 = async () => {
    if (!createdTrip || !draftResult || draftResult.status !== "ok") return;
    setErrorMsg(null);
    setApproving(true);
    try {
      await api.approveInitialPlan(
        createdTrip.tripId,
        createdTrip.token,
        draftResult.draft.plan,
        draftResult.agent_run_id,
      );
      router.push(`/trips/${encodeURIComponent(createdTrip.tripId)}`);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Không thể duyệt bản nháp thành v1.",
      );
      setApproving(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-6">
      <div className="space-y-3">
        <Link
          href="/"
          className="inline-block text-[14px] font-medium text-secondary hover:underline"
        >
          ← {t("Quay lại danh sách chuyến đi", "Back to trips")}
        </Link>
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 py-1 type-eyebrow text-secondary">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-secondary" />
            {draftResult?.status === "ok"
              ? t("Bước 2 · Xem trước bản nháp v1", "Step 2 · Preview v1 draft")
              : t("Bước 1 · Nhập yêu cầu chuyến đi", "Step 1 · Enter trip details")}
          </span>
          <h1 className="mt-2 type-heading-1 text-ink">
            {t("Tạo chuyến đi mới cùng Roa", "Create a new trip with Roa")}
          </h1>
          <p className="mt-2 text-[16px] text-ink-muted max-w-[65ch]">
            {t(
              "Roa sẽ soạn một bản nháp lịch trình dựa trên giờ mở cửa và ngân sách nhóm. Bạn xem và duyệt trước khi trở thành bản chính thức v1.",
              "Roa will draft an itinerary based on real opening hours and group budget. Review and approve before it becomes v1.",
            )}
          </p>
        </div>
      </div>

      {errorMsg ? (
        <StatusBanner
          tone="error"
          message={errorMsg}
          onDismiss={() => setErrorMsg(null)}
        />
      ) : null}

      {!draftResult || draftResult.status === "infeasible" ? (
        <div className="space-y-6">
          {draftResult?.status === "infeasible" ? (
            <div
              role="status"
              aria-live="polite"
              className="rounded-[12px] border border-error/30 bg-surface p-6 shadow-card space-y-2"
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-error text-[11px] font-bold text-white"
                >
                  !
                </span>
                <h2 className="type-heading-3 text-ink">
                  Roa không xếp được lịch trình thoả mọi ràng buộc
                </h2>
              </div>
              <p className="text-[15px] text-ink-secondary">
                Thay vì tự bịa địa điểm hoặc vượt ngân sách, hệ thống dừng lại với các lý do sau:
              </p>
              <ul className="list-disc pl-5 text-[14px] text-error space-y-1">
                {draftResult.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <form
            ref={formRef}
            onSubmit={(e) => void handleCreateAndGenerate(e)}
            className="rounded-[12px] border border-hairline bg-surface p-6 shadow-card space-y-6"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label
                  htmlFor="trip-title"
                  className="block text-[14px] font-semibold text-ink mb-1.5"
                >
                  Tên chuyến đi *
                </label>
                <input
                  id="trip-title"
                  name="title"
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ví dụ: Đà Lạt 3N2Đ…"
                  className="nomad-input min-h-11 w-full px-3 py-2 text-[15px]"
                />
              </div>

              <div>
                <label
                  htmlFor="trip-dest"
                  className="block text-[14px] font-semibold text-ink mb-1.5"
                >
                  Điểm đến *
                </label>
                <input
                  id="trip-dest"
                  name="destination"
                  type="text"
                  required
                  list="vietnam-destinations"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="Ví dụ: Đà Lạt, Phú Quốc, Sa Pa…"
                  className="nomad-input min-h-11 w-full px-3 py-2 text-[15px]"
                />
                <datalist id="vietnam-destinations">
                  {TRIP_TEMPLATES.map((t) => (
                    <option key={t.id} value={t.destination} />
                  ))}
                  <option value="Hà Giang" />
                  <option value="Nha Trang" />
                </datalist>
              </div>

              <div>
                <label
                  htmlFor="leader-name"
                  className="block text-[14px] font-semibold text-ink mb-1.5"
                >
                  Tên nhóm trưởng *
                </label>
                <input
                  id="leader-name"
                  name="leader_name"
                  type="text"
                  required
                  autoComplete="name"
                  value={leaderName}
                  onChange={(e) => setLeaderName(e.target.value)}
                  placeholder="Tên hiển thị của bạn…"
                  className="nomad-input min-h-11 w-full px-3 py-2 text-[15px]"
                />
              </div>

              <div>
                <label
                  htmlFor="start-date"
                  className="block text-[14px] font-semibold text-ink mb-1.5"
                >
                  Ngày đi *
                </label>
                <input
                  id="start-date"
                  name="start_date"
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="nomad-input min-h-11 w-full px-3 py-2 text-[15px] tabular-nums"
                />
              </div>

              <div>
                <label
                  htmlFor="end-date"
                  className="block text-[14px] font-semibold text-ink mb-1.5"
                >
                  Ngày về *
                </label>
                <input
                  id="end-date"
                  name="end_date"
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="nomad-input min-h-11 w-full px-3 py-2 text-[15px] tabular-nums"
                />
              </div>

              <div>
                <label
                  htmlFor="group-size"
                  className="block text-[14px] font-semibold text-ink mb-1.5"
                >
                  Số người dự kiến (2–20) *
                </label>
                <input
                  id="group-size"
                  name="group_size"
                  type="text"
                  inputMode="numeric"
                  required
                  pattern="\d+"
                  value={groupSize}
                  onChange={(e) => setGroupSize(e.target.value)}
                  className="nomad-input min-h-11 w-full px-3 py-2 text-[15px] tabular-nums"
                />
              </div>

              <div>
                <label
                  htmlFor="budget"
                  className="block text-[14px] font-semibold text-ink mb-1.5"
                >
                  Ngân sách dự kiến / người (VND)
                </label>
                <input
                  id="budget"
                  name="budget_per_person"
                  type="text"
                  inputMode="numeric"
                  aria-describedby="budget-hint"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="Ví dụ: 2500000…"
                  className="nomad-input min-h-11 w-full px-3 py-2 text-[15px] tabular-nums"
                />
                <span
                  id="budget-hint"
                  className="mt-1 block text-[13px] text-ink-muted"
                >
                  Nhập dưới 600.000đ ở chế độ mẫu để xem cách Roa báo không xếp được lịch.
                </span>
              </div>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-[14px] font-semibold text-ink">
                Phương tiện di chuyển chính
              </legend>
              <div className="space-y-2 pt-1">
                {TRANSPORT_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[8px] border border-hairline bg-canvas-soft px-3.5 py-2 text-[15px] text-ink"
                  >
                    <input
                      type="radio"
                      name="transport"
                      value={opt.value}
                      checked={transport === opt.value}
                      onChange={() => setTransport(opt.value)}
                      className="h-4 w-4 accent-primary"
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-[14px] font-semibold text-ink">
                Sở thích của nhóm
              </legend>
              <div className="flex flex-wrap gap-2 pt-1">
                {INTEREST_OPTIONS.map((opt) => {
                  const active = interests.includes(opt);
                  return (
                    <label
                      key={opt}
                      className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[8px] border px-3.5 py-2 text-[13px] font-medium transition-colors ${
                        active
                          ? "border-primary bg-surface text-ink shadow-card"
                          : "border-hairline bg-canvas-soft text-ink-secondary"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() =>
                          toggleItem(interests, setInterests, opt)
                        }
                        className="h-4 w-4 accent-primary"
                      />
                      <span>{opt}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-[14px] font-semibold text-ink">
                Ràng buộc cần tránh
              </legend>
              <div className="flex flex-wrap gap-2 pt-1">
                {CONSTRAINT_OPTIONS.map((opt) => {
                  const active = constraints.includes(opt);
                  return (
                    <label
                      key={opt}
                      className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[8px] border px-3.5 py-2 text-[13px] font-medium transition-colors ${
                        active
                          ? "border-primary bg-surface text-ink shadow-card"
                          : "border-hairline bg-canvas-soft text-ink-secondary"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() =>
                          toggleItem(constraints, setConstraints, opt)
                        }
                        className="h-4 w-4 accent-primary"
                      />
                      <span>{opt}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div>
              <label
                htmlFor="extra-note"
                className="block text-[14px] font-semibold text-ink mb-1.5"
              >
                Ghi chú thêm cho Roa (tuỳ chọn)
              </label>
              <input
                id="extra-note"
                name="extra_note"
                type="text"
                value={extraNote}
                onChange={(e) => setExtraNote(e.target.value)}
                placeholder="Ví dụ: Muốn có một buổi chèo SUP buổi sáng…"
                className="nomad-input min-h-11 w-full px-3 py-2 text-[15px]"
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-hairline pt-4">
              <button
                type="submit"
                disabled={generating}
                className="min-h-12 rounded-[5px] bg-primary active:bg-primary-active active:scale-[0.97] px-6 py-3 text-[16px] font-semibold text-on-primary disabled:opacity-60 transition-[transform,background-color]"
              >
                {generating
                  ? "Roa đang xếp lịch trình…"
                  : "Tạo bản nháp với Roa"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-[12px] border border-hairline bg-surface p-6 shadow-card flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="type-eyebrow text-secondary">
                Bản nháp do Roa soạn (chưa lưu thành v1)
              </p>
              <h2 className="mt-1 type-heading-2 text-ink tabular-nums">
                {title} ·{" "}
                {formatVnd(draftResult.draft.computed.total_cost_per_person)}
                /người
              </h2>
              <p className="mt-1 text-[13px] text-ink-muted">
                Mã mời nhóm:{" "}
                <span
                  translate="no"
                  className="font-mono font-semibold text-ink"
                >
                  {createdTrip?.inviteCode}
                </span>
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                disabled={generating || approving}
                onClick={() => void handleRegenerate()}
                className="min-h-11 rounded-[5px] border border-hairline bg-surface px-4 py-2 text-[15px] font-medium text-ink hover:bg-canvas-soft disabled:opacity-60 transition-colors"
              >
                {generating ? "Đang soạn lại…" : "Tạo lại bản nháp"}
              </button>
              <button
                type="button"
                disabled={approving || generating}
                onClick={() => void handleApproveV1()}
                className="min-h-11 rounded-[5px] bg-primary active:bg-primary-active active:scale-[0.97] px-6 py-2 text-[15px] font-medium text-on-primary disabled:opacity-60 transition-[transform,background-color]"
              >
                {approving ? "Đang lưu bản v1…" : "Duyệt thành bản v1"}
              </button>
            </div>
          </div>

          <div className="rounded-[12px] border border-hairline bg-surface p-5 space-y-2">
            <label
              htmlFor="regen-extra"
              className="block text-[13px] font-semibold text-ink"
            >
              Muốn Roa điều chỉnh thêm trước khi tạo lại?
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="regen-extra"
                type="text"
                value={extraRequest}
                onChange={(e) => setExtraRequest(e.target.value)}
                placeholder="Ví dụ: Giảm bớt điểm đi chiều ngày 1…"
                className="nomad-input min-h-11 flex-1 px-3 py-1.5 text-[15px]"
              />
              <button
                type="button"
                disabled={generating}
                onClick={() => void handleRegenerate()}
                className="min-h-11 rounded-[5px] border border-secondary/35 bg-surface px-4 py-2 text-[14px] font-medium text-secondary hover:bg-canvas-soft disabled:opacity-60 transition-colors"
              >
                Soạn lại theo yêu cầu
              </button>
            </div>
          </div>

          {draftResult.draft.warnings.length > 0 ? (
            <div className="space-y-2">
              {draftResult.draft.warnings.map((w, idx) => (
                <StatusBanner key={idx} tone="warning" message={w.message} />
              ))}
            </div>
          ) : null}

          <div className="space-y-4">
            {draftResult.draft.plan.days.map((day) => {
              const dayMetrics = draftResult.draft.computed.per_day.find(
                (d) => d.day === day.day,
              );
              return (
                <div
                  key={day.day}
                  className="rounded-[12px] border border-hairline bg-surface p-6 space-y-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-hairline pb-3">
                    <h3 className="type-heading-3 text-ink">
                      Ngày {day.day}: {day.title} ({formatDate(day.date)})
                    </h3>
                    <span className="text-[13px] font-semibold text-ink-muted tabular-nums">
                      {formatVnd(dayMetrics?.cost_per_person ?? 0)} · di chuyển{" "}
                      {formatDurationMinutes(dayMetrics?.travel_minutes ?? 0)}
                    </span>
                  </div>
                  <ul className="space-y-2.5">
                    {day.items.map((it) => (
                      <li
                        key={it.id}
                        className="flex flex-wrap items-start justify-between gap-2 rounded-[8px] border border-hairline bg-canvas-soft p-3.5 text-[14px]"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <p className="font-semibold text-ink">
                            <span className="text-secondary tabular-nums mr-2">
                              {it.start}–{it.end}
                            </span>
                            {it.name}
                          </p>
                          <p className="text-[13px] text-ink-muted">
                            {it.address}
                          </p>
                          <p className="text-[13px] text-ink-secondary">
                            {it.reason}
                          </p>
                        </div>
                        <span className="text-[13px] font-semibold text-ink tabular-nums shrink-0">
                          {formatVnd(it.cost_per_person)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function NewTripPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-4 animate-pulse">
          <div className="h-6 w-48 rounded-[6px] bg-canvas-soft" />
          <div className="h-10 w-80 rounded-[8px] bg-canvas-soft" />
          <div className="h-96 rounded-[12px] border border-hairline bg-surface" />
        </div>
      }
    >
      <NewTripContent />
    </Suspense>
  );
}
