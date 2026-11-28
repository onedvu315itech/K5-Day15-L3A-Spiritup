"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ChatPanel } from "@/components/chat-panel";
import {
  SuggestionFormDialog,
  SuggestionInboxDialog,
  VersionDiffDialog,
} from "@/components/feedback-modals";
import { ProposalPanel } from "@/components/proposal-panel";
import { StatusBanner } from "@/components/status-banner";
import { TripSidebar } from "@/components/trip-sidebar";
import { TripTimeline } from "@/components/trip-timeline";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/i18n";
import { mockApi } from "@/lib/mock-data";
import {
  ensureDemoSession,
  getTripSession,
  saveTripSession,
  type StoredTripSession,
} from "@/lib/storage";
import type {
  ChatMessage,
  MemberRole,
  PlanItem,
  PlanOp,
  PlanVersionResponse,
  Proposal,
  Suggestion,
  SuggestionCategory,
  TripDetailResponse,
  VersionDiffResponse,
  VersionListItem,
  VoteValue,
} from "@/lib/types";
import { useTripUpdates } from "@/lib/use-trip-updates";

type RightTab = "proposals" | "chat";
type MobileView = "plan" | "proposals" | "chat";

const emptySubscribe = () => () => {};

async function fetchWorkspaceBundle(
  tripId: string,
  token: string,
  versionToLoad?: number,
) {
  const [detail, plan, vers, props, chats, sugs] = await Promise.all([
    api.getTrip(tripId, token),
    api.getPlan(tripId, token, versionToLoad),
    api.getVersions(tripId, token),
    api.getProposals(tripId, token, "all"),
    api.getChat(tripId, token),
    api.getSuggestions(tripId, token, "all"),
  ]);
  return { detail, plan, vers, props, chats, sugs };
}

function WorkspaceContent() {
  const params = useParams<{ tripId: string }>();
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tripId = decodeURIComponent(params?.tripId ?? "");

  const urlTab = searchParams.get("tab");
  const initialRightTab: RightTab = urlTab === "chat" ? "chat" : "proposals";
  const initialMobileTab: MobileView =
    urlTab === "chat" ? "chat" : urlTab === "proposals" ? "proposals" : "plan";

  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const [sessionOverride, setSessionOverride] =
    useState<StoredTripSession | null>(null);

  const session: StoredTripSession | null = useMemo(() => {
    if (!isClient || !tripId) return null;
    if (sessionOverride && sessionOverride.tripId === tripId) {
      return sessionOverride;
    }
    const stored = getTripSession(tripId);
    if (stored) return stored;
    if (tripId === "demo-dalat-3n2d") {
      return ensureDemoSession("leader");
    }
    return null;
  }, [isClient, tripId, sessionOverride]);
  const sessionChecked = isClient;

  const [tripDetail, setTripDetail] = useState<TripDetailResponse | null>(null);
  const [planVersion, setPlanVersion] = useState<PlanVersionResponse | null>(
    null,
  );
  const [versions, setVersions] = useState<VersionListItem[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [lastEventId, setLastEventId] = useState(0);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [rightTab, setRightTab] = useState<RightTab>(initialRightTab);
  const [mobileView, setMobileView] = useState<MobileView>(initialMobileTab);
  const [infoSheetOpen, setInfoSheetOpen] = useState(false);
  const infoDialogRef = useRef<HTMLDialogElement>(null);
  const infoTitleId = useId();

  const [sugFormState, setSugFormState] = useState<{
    open: boolean;
    day: number;
    item?: PlanItem | null;
    content?: string;
  }>({ open: false, day: 1 });
  const [inboxOpen, setInboxOpen] = useState(false);
  const [diffModal, setDiffModal] = useState<VersionDiffResponse | null>(null);
  const [editPrefill, setEditPrefill] = useState<{
    suggestionId?: string;
    prefillText?: string;
  } | null>(null);

  const loadWorkspace = useCallback(
    async (activeToken: string, versionToLoad?: number) => {
      const data = await fetchWorkspaceBundle(
        tripId,
        activeToken,
        versionToLoad,
      );
      setTripDetail(data.detail);
      setPlanVersion(data.plan);
      setVersions(data.vers.items);
      setProposals(data.props.items);
      setChatMessages(data.chats.items);
      setSuggestions(data.sugs.items);
    },
    [tripId],
  );

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    fetchWorkspaceBundle(tripId, session.token)
      .then((data) => {
        if (cancelled) return;
        setTripDetail(data.detail);
        setPlanVersion(data.plan);
        setVersions(data.vers.items);
        setProposals(data.props.items);
        setChatMessages(data.chats.items);
        setSuggestions(data.sugs.items);
        setErrorMsg(null);
      })
      .catch((err) => {
        if (!cancelled) {
          setErrorMsg(
            err instanceof Error
              ? err.message
              : "Không tải được dữ liệu chuyến đi.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tripId, session]);

  useTripUpdates({
    tripId,
    token: session?.token ?? null,
    since: lastEventId,
    enabled: Boolean(session && tripDetail),
    onEvents: (_events, nextEventId) => {
      setLastEventId(nextEventId);
      if (session) {
        void loadWorkspace(session.token, planVersion?.version_no);
      }
    },
  });

  useEffect(() => {
    const dialog = infoDialogRef.current;
    if (!dialog) return;
    if (infoSheetOpen && !dialog.open) dialog.showModal();
    else if (!infoSheetOpen && dialog.open) dialog.close();
  }, [infoSheetOpen]);

  useEffect(() => {
    const dialog = infoDialogRef.current;
    if (!dialog) return;
    const handleClose = () => {
      dialog.returnValue = "";
      setInfoSheetOpen(false);
    };
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, []);

  const syncTabUrl = (nextTab: MobileView) => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("tab", nextTab);
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  };

  const handleSwitchDemoRole = (nextRole: MemberRole) => {
    if (tripId !== "demo-dalat-3n2d" || !session) return;
    const nextCreds = mockApi.ensureRoleToken(tripId, nextRole);
    const updated: StoredTripSession = {
      ...session,
      token: nextCreds.token,
      memberId: nextCreds.memberId,
      displayName: nextCreds.displayName,
      role: nextRole,
      updatedAt: new Date().toISOString(),
    };
    saveTripSession(updated);
    setSessionOverride(updated);
  };

  if (sessionChecked && !session) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <div className="rounded-[16px] border border-hairline bg-surface p-8 shadow-card space-y-4">
          <h1 className="type-heading-2 text-ink">
            Chưa có phiên truy cập chuyến đi này
          </h1>
          <p className="text-[15px] text-ink-muted">
            Bạn cần mở đường link mời do nhóm trưởng gửi và nhập tên hiển thị trước khi vào không gian chuyến đi.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center rounded-[5px] bg-primary active:bg-primary-active px-5 py-2 text-[15px] font-semibold text-on-primary transition-colors"
            >
              Về trang chủ nhập mã mời
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !tripDetail || !planVersion || !session) {
    return (
      <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 space-y-5">
        {errorMsg ? (
          <StatusBanner tone="error" message={errorMsg} />
        ) : (
          <div aria-label="Đang tải không gian chuyến đi" className="space-y-5 animate-pulse">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-4">
              <div className="space-y-2">
                <div className="h-7 w-56 rounded-[8px] bg-canvas-soft" />
                <div className="h-4 w-72 rounded-[6px] bg-canvas-soft" />
              </div>
              <div className="h-10 w-44 rounded-[8px] bg-canvas-soft" />
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)_360px]">
              <div className="hidden lg:block space-y-4">
                <div className="h-44 rounded-[12px] border border-hairline bg-surface" />
                <div className="h-36 rounded-[12px] border border-hairline bg-surface" />
              </div>
              <div className="space-y-4">
                <div className="h-24 rounded-[12px] border border-hairline bg-surface" />
                <div className="h-64 rounded-[12px] border border-hairline bg-surface" />
              </div>
              <div className="hidden lg:block h-80 rounded-[12px] border border-hairline bg-surface" />
            </div>
          </div>
        )}
      </div>
    );
  }

  const isLeader = tripDetail.me.role === "leader";

  const handleSelectVersion = async (versionNo: number) => {
    try {
      const next = await api.getPlan(tripId, session.token, versionNo);
      setPlanVersion(next);
      setInfoSheetOpen(false);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Không tải được phiên bản.",
      );
    }
  };

  const handleCompareVersion = async (versionNo: number) => {
    try {
      const diff = await api.getVersionDiff(
        tripId,
        session.token,
        tripDetail.trip.current_version,
        versionNo,
      );
      setDiffModal(diff);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Không so sánh được phiên bản.",
      );
    }
  };

  const handleRevertVersion = async (versionNo: number) => {
    try {
      await api.createProposal(tripId, session.token, {
        kind: "revert",
        base_version: tripDetail.trip.current_version,
        target_version: versionNo,
        summary: `Khôi phục lịch trình về phiên bản v${versionNo}`,
        reason: "Tạo đề xuất khôi phục để nhóm xem và xác nhận",
        origin: "manual",
      });
      await loadWorkspace(session.token);
      setRightTab("proposals");
      setMobileView("proposals");
      setInfoSheetOpen(false);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Không tạo được đề xuất khôi phục.",
      );
    }
  };

  const handleSubmitProposal = async (payload: {
    base_version: number;
    ops: PlanOp[];
    summary: string;
    reason?: string;
    origin: "manual" | "agent" | "suggestion";
    suggestion_id?: string | null;
    expires_at?: string | null;
  }) => {
    await api.createProposal(tripId, session.token, {
      kind: "edit",
      ...payload,
    });
    setEditPrefill(null);
    await loadWorkspace(session.token);
    setRightTab("proposals");
    setMobileView("proposals");
  };

  const handleVote = async (proposalId: string, value: VoteValue) => {
    await api.castVote(tripId, proposalId, session.token, value);
    await loadWorkspace(session.token, planVersion.version_no);
  };

  const handleApplyProposal = async (proposalId: string) => {
    await api.applyProposal(tripId, proposalId, session.token);
    await loadWorkspace(session.token);
  };

  const handleCloseProposal = async (proposalId: string) => {
    await api.closeProposal(tripId, proposalId, session.token);
    await loadWorkspace(session.token, planVersion.version_no);
  };

  const handleWithdrawProposal = async (proposalId: string) => {
    await api.withdrawProposal(tripId, proposalId, session.token);
    await loadWorkspace(session.token, planVersion.version_no);
  };

  const handleCreateSuggestion = async (payload: {
    day: number | null;
    item_id: string | null;
    category: SuggestionCategory;
    content: string;
    based_on_version: number;
  }) => {
    await api.createSuggestion(tripId, session.token, payload);
    await loadWorkspace(session.token, planVersion.version_no);
  };

  const handleUpdateSuggestion = async (
    suggestionId: string,
    status: "noted" | "declined",
    note?: string,
  ) => {
    await api.updateSuggestion(tripId, suggestionId, session.token, {
      status,
      leader_note: note,
    });
    await loadWorkspace(session.token, planVersion.version_no);
  };

  const handleSendChat = async (text: string) => {
    await api.sendChat(tripId, session.token, text);
    await loadWorkspace(session.token, planVersion.version_no);
  };

  const sidebarNode = (
    <TripSidebar
      trip={tripDetail.trip}
      members={tripDetail.members}
      myMemberId={tripDetail.me.id}
      isLeader={isLeader}
      versions={versions}
      viewingVersion={planVersion.version_no}
      newSuggestionsCount={tripDetail.counts.new_suggestions ?? 0}
      onSelectVersion={(v) => void handleSelectVersion(v)}
      onCompareVersion={(v) => void handleCompareVersion(v)}
      onRevertVersion={(v) => void handleRevertVersion(v)}
      onOpenSuggestionInbox={() => {
        setInfoSheetOpen(false);
        setInboxOpen(true);
      }}
    />
  );

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 space-y-5">
      {/* Workspace header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline pb-4">
        <div className="min-w-0">
          <h1 className="type-heading-2 text-ink break-words">
            {tripDetail.trip.title}
          </h1>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            {t("Đang đăng nhập tên", "Signed in as")}{" "}
            <strong className="font-semibold text-ink">
              {session.displayName}
            </strong>{" "}
            · {isLeader ? t("Nhóm trưởng", "Leader") : t("Thành viên", "Member")} ·{" "}
            {t("Đang xem", "Viewing")}{" "}
            <span className="tabular-nums font-semibold text-ink">
              v{planVersion.version_no}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {tripId === "demo-dalat-3n2d" ? (
            <div className="inline-flex items-center rounded-[8px] border border-hairline bg-surface p-1 text-[13px]">
              <span className="px-2 text-ink-muted hidden sm:inline">
                {t("Thử vai trò:", "Try role:")}
              </span>
              <button
                type="button"
                onClick={() => handleSwitchDemoRole("leader")}
                className={`min-h-8 rounded-[5px] px-2.5 py-1 font-medium transition-colors ${
                  isLeader
                    ? "bg-primary text-on-primary"
                    : "text-ink hover:bg-canvas-soft"
                }`}
              >
                {t("Nhóm trưởng", "Leader")}
              </button>
              <button
                type="button"
                onClick={() => handleSwitchDemoRole("member")}
                className={`min-h-8 rounded-[5px] px-2.5 py-1 font-medium transition-colors ${
                  !isLeader
                    ? "bg-primary text-on-primary"
                    : "text-ink hover:bg-canvas-soft"
                }`}
              >
                {t("Thành viên", "Member")}
              </button>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setInfoSheetOpen(true)}
            className="min-h-10 rounded-[5px] border border-hairline bg-surface px-3.5 py-1.5 text-[13px] font-medium text-ink hover:bg-canvas-soft lg:hidden"
          >
            {t("Thông tin & Lịch sử", "Info & History")}
          </button>
        </div>
      </div>

      {errorMsg ? (
        <StatusBanner
          tone="error"
          message={errorMsg}
          onDismiss={() => setErrorMsg(null)}
        />
      ) : null}

      {/* Mobile 375px switcher */}
      <div
        role="tablist"
        aria-label="Chuyển vùng làm việc"
        className="grid grid-cols-3 gap-1 rounded-[8px] border border-hairline bg-surface p-1 lg:hidden"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mobileView === "plan"}
          onClick={() => {
            setMobileView("plan");
            syncTabUrl("plan");
          }}
          className={`min-h-10 rounded-[5px] text-[13px] font-medium transition-colors ${
            mobileView === "plan"
              ? "bg-primary text-on-primary"
              : "text-ink-muted"
          }`}
        >
          {t("Lịch trình", "Itinerary")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileView === "proposals"}
          onClick={() => {
            setMobileView("proposals");
            setRightTab("proposals");
            syncTabUrl("proposals");
          }}
          className={`min-h-10 rounded-[5px] text-[13px] font-medium transition-colors tabular-nums ${
            mobileView === "proposals"
              ? "bg-primary text-on-primary"
              : "text-ink-muted"
          }`}
        >
          {t("Đề xuất", "Proposals")} ({tripDetail.counts.open_proposals})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileView === "chat"}
          onClick={() => {
            setMobileView("chat");
            setRightTab("chat");
            syncTabUrl("chat");
          }}
          className={`min-h-10 rounded-[5px] text-[13px] font-medium transition-colors ${
            mobileView === "chat"
              ? "bg-primary text-on-primary"
              : "text-ink-muted"
          }`}
        >
          {t("Hỏi Roa", "Ask Roa")}
        </button>
      </div>

      {/* 3-Column Desktop Layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_minmax(0,1fr)_360px] lg:items-start">
        <div className="hidden lg:block">{sidebarNode}</div>

        <div
          className={
            mobileView === "plan" ? "block min-w-0" : "hidden lg:block min-w-0"
          }
        >
          <TripTimeline
            key={`${planVersion.version_no}-${editPrefill?.suggestionId ?? "none"}`}
            plan={planVersion.plan}
            computed={planVersion.computed}
            versionNo={planVersion.version_no}
            isCurrent={planVersion.is_current}
            isLeader={isLeader}
            initialEditRequest={editPrefill}
            onReturnToCurrent={() =>
              void handleSelectVersion(tripDetail.trip.current_version)
            }
            onDraftWithRoa={(reqText, sugId) =>
              api.draftProposal(tripId, session.token, reqText, sugId)
            }
            onSubmitProposal={handleSubmitProposal}
            onOpenSuggestionModal={(day, item) =>
              setSugFormState({ open: true, day, item, content: "" })
            }
          />
        </div>

        <div
          className={
            mobileView === "proposals" || mobileView === "chat"
              ? "block min-w-0"
              : "hidden lg:block min-w-0"
          }
        >
          <div className="rounded-[12px] border border-hairline bg-surface p-4 space-y-4">
            <div
              role="tablist"
              aria-label="Đề xuất và trò chuyện"
              className="hidden lg:grid grid-cols-2 gap-1 rounded-[8px] border border-hairline bg-canvas-soft p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={rightTab === "proposals"}
                onClick={() => {
                  setRightTab("proposals");
                  syncTabUrl("proposals");
                }}
                className={`min-h-9 rounded-[5px] text-[13px] font-medium transition-colors tabular-nums ${
                  rightTab === "proposals"
                    ? "bg-surface text-ink shadow-card"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                {t("Đề xuất", "Proposals")} ({tripDetail.counts.open_proposals})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={rightTab === "chat"}
                onClick={() => {
                  setRightTab("chat");
                  syncTabUrl("chat");
                }}
                className={`min-h-9 rounded-[5px] text-[13px] font-medium transition-colors ${
                  rightTab === "chat"
                    ? "bg-surface text-ink shadow-card"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                {t("Trò chuyện với Roa", "Chat with Roa")}
              </button>
            </div>

            {(rightTab === "proposals" && mobileView !== "chat") ||
            mobileView === "proposals" ? (
              <ProposalPanel
                proposals={proposals}
                isLeader={isLeader}
                onVote={handleVote}
                onApply={handleApplyProposal}
                onClose={handleCloseProposal}
                onWithdraw={handleWithdrawProposal}
              />
            ) : (
              <ChatPanel
                messages={chatMessages}
                isLeader={isLeader}
                onSend={handleSendChat}
                onCreateSuggestionFromChat={(prefill) =>
                  setSugFormState({
                    open: true,
                    day: planVersion.plan.days[0]?.day ?? 1,
                    content: prefill,
                  })
                }
              />
            )}
          </div>
        </div>
      </div>

      <dialog ref={infoDialogRef} aria-labelledby={infoTitleId} className="w-full">
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h1 id={infoTitleId} className="type-title text-ink">
              Thông tin &amp; Lịch sử
            </h1>
            <button
              type="button"
              autoFocus
              onClick={() => setInfoSheetOpen(false)}
              className="rounded-[5px] border border-hairline bg-surface px-3 py-1.5 text-[13px] font-medium text-ink hover:bg-canvas-soft"
            >
              Đóng
            </button>
          </div>
          {sidebarNode}
        </div>
      </dialog>

      <SuggestionFormDialog
        key={`${sugFormState.day}-${sugFormState.item?.id ?? "all"}-${sugFormState.content ?? ""}`}
        open={sugFormState.open}
        plan={planVersion.plan}
        currentVersion={tripDetail.trip.current_version}
        defaultDay={sugFormState.day}
        defaultItem={sugFormState.item}
        defaultContent={sugFormState.content}
        onClose={() => setSugFormState((s) => ({ ...s, open: false }))}
        onSubmit={handleCreateSuggestion}
      />

      <SuggestionInboxDialog
        open={inboxOpen}
        suggestions={suggestions}
        onClose={() => setInboxOpen(false)}
        onConvertToEdit={(sug) => {
          setInboxOpen(false);
          setEditPrefill({
            suggestionId: sug.id,
            prefillText: sug.content,
          });
          setMobileView("plan");
        }}
        onHandle={handleUpdateSuggestion}
      />

      <VersionDiffDialog diff={diffModal} onClose={() => setDiffModal(null)} />
    </div>
  );
}

export default function TripWorkspacePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[1280px] px-4 py-8 text-[15px] text-ink-muted">
          Đang tải không gian chuyến đi…
        </div>
      }
    >
      <WorkspaceContent />
    </Suspense>
  );
}
