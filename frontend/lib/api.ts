import { authApi } from "./auth-api";
import { isMockInviteCode, isMockTripId, mockApi } from "./mock-data";
import {
  ApiError,
  type ApiErrorBody,
  type CreateTripPayload,
  type CreateTripResponse,
  type DraftProposalResponse,
  type GenerateDraftResponse,
  type InvitePreviewResponse,
  type JoinTripResponse,
  type PlanData,
  type PlanOp,
  type PlanVersionResponse,
  type Proposal,
  type SendChatResponse,
  type Suggestion,
  type SuggestionCategory,
  type SuggestionStatus,
  type TripDetailResponse,
  type UpdatesResponse,
  type VersionDiffResponse,
  type VersionListItem,
  type VoteValue,
  type ChatMessage,
} from "./types";

const BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"
).replace(/\/$/, "");

const USE_MOCK_ENV = process.env.NEXT_PUBLIC_USE_MOCK === "true";

function shouldUseMockByTrip(tripId?: string): boolean {
  if (USE_MOCK_ENV) return true;
  if (tripId && isMockTripId(tripId)) return true;
  return false;
}

function shouldUseMockByInvite(inviteCode?: string): boolean {
  if (USE_MOCK_ENV) return true;
  if (inviteCode && isMockInviteCode(inviteCode)) return true;
  return false;
}

async function request<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, headers, ...rest } = options;
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/api/v1${path}`, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
    });
  } catch {
    throw new ApiError(
      0,
      "network_error",
      "Không kết nối được tới máy chủ. Kiểm tra lại mạng hoặc trạng thái backend.",
    );
  }

  if (!response.ok) {
    let parsed: ApiErrorBody | null = null;
    try {
      parsed = (await response.json()) as ApiErrorBody;
    } catch {
      parsed = null;
    }
    const err = parsed?.error;
    throw new ApiError(
      response.status,
      err?.code ?? "http_error",
      err?.message ?? `Yêu cầu thất bại (mã ${response.status}).`,
      err?.details,
    );
  }

  return (await response.json()) as T;
}

export const api = {
  auth: authApi,

  createTrip(payload: CreateTripPayload): Promise<CreateTripResponse> {
    if (USE_MOCK_ENV) return mockApi.createTrip(payload);
    return request<CreateTripResponse>("/trips", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  getInvitePreview(inviteCode: string): Promise<InvitePreviewResponse> {
    if (shouldUseMockByInvite(inviteCode)) {
      return mockApi.getInvitePreview(inviteCode);
    }
    return request<InvitePreviewResponse>(`/join/${encodeURIComponent(inviteCode)}`);
  },

  joinTrip(inviteCode: string, displayName: string): Promise<JoinTripResponse> {
    if (shouldUseMockByInvite(inviteCode)) {
      return mockApi.joinTrip(inviteCode, displayName);
    }
    return request<JoinTripResponse>(`/join/${encodeURIComponent(inviteCode)}`, {
      method: "POST",
      body: JSON.stringify({ display_name: displayName }),
    });
  },

  getTrip(tripId: string, token: string): Promise<TripDetailResponse> {
    if (shouldUseMockByTrip(tripId)) return mockApi.getTrip(tripId, token);
    return request<TripDetailResponse>(`/trips/${encodeURIComponent(tripId)}`, {
      token,
    });
  },

  generateDraft(
    tripId: string,
    token: string,
    extraRequest?: string,
  ): Promise<GenerateDraftResponse> {
    if (shouldUseMockByTrip(tripId)) {
      return mockApi.generateDraft(tripId, token, extraRequest);
    }
    return request<GenerateDraftResponse>(
      `/trips/${encodeURIComponent(tripId)}/generate`,
      {
        method: "POST",
        token,
        body: JSON.stringify(
          extraRequest?.trim() ? { extra_request: extraRequest.trim() } : {},
        ),
      },
    );
  },

  approveInitialPlan(
    tripId: string,
    token: string,
    plan: PlanData,
    agentRunId: string,
  ): Promise<{ version: PlanVersionResponse }> {
    if (shouldUseMockByTrip(tripId)) {
      return mockApi.approveInitialPlan(tripId, token, plan);
    }
    return request<{ version: PlanVersionResponse }>(
      `/trips/${encodeURIComponent(tripId)}/plan`,
      {
        method: "POST",
        token,
        body: JSON.stringify({ plan, agent_run_id: agentRunId }),
      },
    );
  },

  getPlan(
    tripId: string,
    token: string,
    version?: number,
  ): Promise<PlanVersionResponse> {
    if (shouldUseMockByTrip(tripId)) {
      return mockApi.getPlan(tripId, token, version);
    }
    const query = version != null ? `?version=${version}` : "";
    return request<PlanVersionResponse>(
      `/trips/${encodeURIComponent(tripId)}/plan${query}`,
      { token },
    );
  },

  getVersions(
    tripId: string,
    token: string,
  ): Promise<{ items: VersionListItem[] }> {
    if (shouldUseMockByTrip(tripId)) return mockApi.getVersions(tripId, token);
    return request<{ items: VersionListItem[] }>(
      `/trips/${encodeURIComponent(tripId)}/versions`,
      { token },
    );
  },

  getVersionDiff(
    tripId: string,
    token: string,
    versionNo: number,
    against?: number,
  ): Promise<VersionDiffResponse> {
    if (shouldUseMockByTrip(tripId)) {
      return mockApi.getVersionDiff(tripId, token, versionNo, against);
    }
    const query = against != null ? `?against=${against}` : "";
    return request<VersionDiffResponse>(
      `/trips/${encodeURIComponent(tripId)}/versions/${versionNo}/diff${query}`,
      { token },
    );
  },

  draftProposal(
    tripId: string,
    token: string,
    requestText: string,
    suggestionId?: string | null,
  ): Promise<DraftProposalResponse> {
    if (shouldUseMockByTrip(tripId)) {
      return mockApi.draftProposal(tripId, token, requestText);
    }
    return request<DraftProposalResponse>(
      `/trips/${encodeURIComponent(tripId)}/proposals/draft`,
      {
        method: "POST",
        token,
        body: JSON.stringify({
          request: requestText,
          suggestion_id: suggestionId ?? null,
        }),
      },
    );
  },

  createProposal(
    tripId: string,
    token: string,
    payload: {
      kind: "edit" | "revert";
      base_version: number;
      ops?: PlanOp[];
      target_version?: number;
      summary: string;
      reason?: string;
      origin: "manual" | "agent" | "suggestion";
      suggestion_id?: string | null;
      expires_at?: string | null;
    },
  ): Promise<Proposal> {
    if (shouldUseMockByTrip(tripId)) {
      return mockApi.createProposal(tripId, token, payload);
    }
    return request<Proposal>(`/trips/${encodeURIComponent(tripId)}/proposals`, {
      method: "POST",
      token,
      body: JSON.stringify(payload),
    });
  },

  getProposals(
    tripId: string,
    token: string,
    status: "open" | "closed" | "all" = "open",
  ): Promise<{ items: Proposal[] }> {
    if (shouldUseMockByTrip(tripId)) {
      return mockApi.getProposals(tripId, token, status);
    }
    return request<{ items: Proposal[] }>(
      `/trips/${encodeURIComponent(tripId)}/proposals?status=${status}`,
      { token },
    );
  },

  castVote(
    tripId: string,
    proposalId: string,
    token: string,
    value: VoteValue,
  ): Promise<{ proposal: Proposal }> {
    if (shouldUseMockByTrip(tripId)) {
      return mockApi.castVote(tripId, proposalId, token, value);
    }
    return request<{ proposal: Proposal }>(
      `/proposals/${encodeURIComponent(proposalId)}/vote`,
      {
        method: "PUT",
        token,
        body: JSON.stringify({ value }),
      },
    );
  },

  applyProposal(
    tripId: string,
    proposalId: string,
    token: string,
  ): Promise<{ proposal: Proposal; new_version: number }> {
    if (shouldUseMockByTrip(tripId)) {
      return mockApi.applyProposal(tripId, proposalId, token);
    }
    return request<{ proposal: Proposal; new_version: number }>(
      `/proposals/${encodeURIComponent(proposalId)}/apply`,
      {
        method: "POST",
        token,
        body: JSON.stringify({}),
      },
    );
  },

  closeProposal(
    tripId: string,
    proposalId: string,
    token: string,
    note?: string,
  ): Promise<Proposal> {
    if (shouldUseMockByTrip(tripId)) {
      return mockApi.closeProposal(tripId, proposalId, token);
    }
    return request<Proposal>(
      `/proposals/${encodeURIComponent(proposalId)}/close`,
      {
        method: "POST",
        token,
        body: JSON.stringify(note ? { note } : {}),
      },
    );
  },

  withdrawProposal(
    tripId: string,
    proposalId: string,
    token: string,
  ): Promise<Proposal> {
    if (shouldUseMockByTrip(tripId)) {
      return mockApi.withdrawProposal(tripId, proposalId, token);
    }
    return request<Proposal>(
      `/proposals/${encodeURIComponent(proposalId)}/withdraw`,
      {
        method: "POST",
        token,
        body: JSON.stringify({}),
      },
    );
  },

  createSuggestion(
    tripId: string,
    token: string,
    payload: {
      day: number | null;
      item_id: string | null;
      category: SuggestionCategory;
      content: string;
      based_on_version: number;
    },
  ): Promise<Suggestion> {
    if (shouldUseMockByTrip(tripId)) {
      return mockApi.createSuggestion(tripId, token, payload);
    }
    return request<Suggestion>(
      `/trips/${encodeURIComponent(tripId)}/suggestions`,
      {
        method: "POST",
        token,
        body: JSON.stringify(payload),
      },
    );
  },

  getSuggestions(
    tripId: string,
    token: string,
    status?: SuggestionStatus | "all",
  ): Promise<{ items: Suggestion[] }> {
    if (shouldUseMockByTrip(tripId)) {
      return mockApi.getSuggestions(tripId, token, status);
    }
    const query = status ? `?status=${status}` : "";
    return request<{ items: Suggestion[] }>(
      `/trips/${encodeURIComponent(tripId)}/suggestions${query}`,
      { token },
    );
  },

  updateSuggestion(
    tripId: string,
    suggestionId: string,
    token: string,
    payload: { status: "noted" | "declined"; leader_note?: string },
  ): Promise<Suggestion> {
    if (shouldUseMockByTrip(tripId)) {
      return mockApi.updateSuggestion(tripId, suggestionId, token, payload);
    }
    return request<Suggestion>(
      `/suggestions/${encodeURIComponent(suggestionId)}`,
      {
        method: "PATCH",
        token,
        body: JSON.stringify(payload),
      },
    );
  },

  sendChat(
    tripId: string,
    token: string,
    message: string,
  ): Promise<SendChatResponse> {
    if (shouldUseMockByTrip(tripId)) {
      return mockApi.sendChat(tripId, token, message);
    }
    return request<SendChatResponse>(
      `/trips/${encodeURIComponent(tripId)}/chat`,
      {
        method: "POST",
        token,
        body: JSON.stringify({ message }),
      },
    );
  },

  getChat(tripId: string, token: string): Promise<{ items: ChatMessage[] }> {
    if (shouldUseMockByTrip(tripId)) return mockApi.getChat(tripId, token);
    return request<{ items: ChatMessage[] }>(
      `/trips/${encodeURIComponent(tripId)}/chat`,
      { token },
    );
  },

  getUpdates(
    tripId: string,
    token: string,
    since: number,
  ): Promise<UpdatesResponse> {
    if (shouldUseMockByTrip(tripId)) {
      return mockApi.getUpdates(tripId, token, since);
    }
    return request<UpdatesResponse>(
      `/trips/${encodeURIComponent(tripId)}/updates?since=${since}`,
      { token },
    );
  },
};
