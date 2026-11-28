export type MemberRole = "leader" | "member";

export type PlanItemKind =
  | "food"
  | "cafe"
  | "sight"
  | "hotel"
  | "activity"
  | "move"
  | "other";

export interface PlanSource {
  type: "google" | "tiktok" | "instagram" | "manual";
  ref: string;
}

export interface PlanItem {
  id: string;
  start: string;
  end: string;
  kind: PlanItemKind;
  name: string;
  place_id: string | null;
  address: string;
  lat: number | null;
  lng: number | null;
  cost_per_person: number;
  reason: string;
  note: string;
  sources: PlanSource[];
}

export interface PlanDay {
  day: number;
  date: string;
  title: string;
  items: PlanItem[];
}

export interface PlanData {
  schema_version: number;
  transport: string;
  notes: string;
  days: PlanDay[];
}

export interface PlanWarning {
  item_id: string;
  type: "closed" | "overlap" | "over_budget" | "travel_time" | string;
  message: string;
}

export interface ComputedDay {
  day: number;
  cost_per_person: number;
  travel_minutes: number;
}

export interface PlanComputed {
  total_cost_per_person: number;
  per_day: ComputedDay[];
  warnings: PlanWarning[];
}

export type PlanOp =
  | {
      op: "add_item";
      day: number;
      after_id: string | null;
      item: Omit<PlanItem, "id">;
    }
  | {
      op: "update_item";
      item_id: string;
      set: Partial<Omit<PlanItem, "id">>;
    }
  | {
      op: "remove_item";
      item_id: string;
    }
  | {
      op: "move_item";
      item_id: string;
      to_day: number;
      after_id: string | null;
    };

export interface TripPreferences {
  interests: string[];
  constraints: string[];
  transport: string;
}

export interface TripMember {
  id: string;
  display_name: string;
  role: MemberRole;
}

export type GenerationStatus = "idle" | "running" | "done" | "failed";

export interface TripInfo {
  id: string;
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
  group_size: number;
  budget_per_person: number | null;
  preferences: TripPreferences;
  invite_code: string;
  current_version: number;
  generation_status: GenerationStatus;
}

export interface CreateTripPayload {
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
  group_size: number;
  budget_per_person: number | null;
  preferences: TripPreferences;
  leader_name: string;
}

export interface CreateTripResponse {
  trip: Pick<
    TripInfo,
    "id" | "title" | "current_version" | "generation_status" | "invite_code"
  >;
  member: TripMember;
  token: string;
  invite_url: string;
}

export interface InvitePreviewResponse {
  trip: {
    title: string;
    destination: string;
    start_date: string;
    end_date: string;
  };
  member_count: number;
}

export interface JoinTripResponse {
  trip_id: string;
  member: TripMember;
  token: string;
}

export interface TripDetailResponse {
  trip: TripInfo;
  members: TripMember[];
  me: {
    id: string;
    role: MemberRole;
  };
  counts: {
    open_proposals: number;
    new_suggestions?: number;
  };
}

export type GenerateDraftResponse =
  | {
      status: "ok";
      draft: {
        plan: PlanData;
        computed: PlanComputed;
        warnings: PlanWarning[];
      };
      agent_run_id: string;
    }
  | {
      status: "infeasible";
      draft: null;
      reasons: string[];
      agent_run_id: string;
    };

export interface PlanVersionResponse {
  version_no: number;
  is_current: boolean;
  plan: PlanData;
  computed: PlanComputed;
  source: "generate" | "proposal" | "revert";
  proposal: { id: string; number: number } | null;
  created_at: string;
}

export interface VersionListItem {
  version_no: number;
  source: "generate" | "proposal" | "revert";
  summary: string;
  created_by: { id: string; display_name: string };
  proposal: { id: string; number: number } | null;
  created_at: string;
}

export type DiffChange =
  | {
      type: "moved";
      item_id: string;
      name: string;
      from: { day: number; start: string };
      to: { day: number; start: string };
    }
  | {
      type: "updated";
      item_id: string;
      name?: string;
      fields: Record<string, [unknown, unknown]>;
    }
  | {
      type: "added";
      item_id: string;
      day: number;
      name: string;
    }
  | {
      type: "removed";
      item_id: string;
      day: number;
      name: string;
    };

export interface VersionDiffResponse {
  from: number;
  to: number;
  changes: DiffChange[];
  cost_delta_per_person: number;
}

export type ProposalKind = "edit" | "revert";
export type ProposalOrigin = "manual" | "agent" | "suggestion";
export type ProposalStatus =
  | "open"
  | "applied"
  | "reference"
  | "stale"
  | "withdrawn";
export type VoteValue = "agree" | "disagree";

export interface ProposalVotes {
  agree: number;
  disagree: number;
  required: number;
  majority: boolean;
  total_members: number;
  pending: string[];
}

export interface ProposalVoter {
  member: { id: string; display_name: string };
  value: VoteValue;
  updated_at: string;
}

export interface Proposal {
  id: string;
  number: number;
  kind: ProposalKind;
  origin: ProposalOrigin;
  author: { id: string; display_name: string };
  base_version: number;
  target_version: number | null;
  summary: string;
  reason: string | null;
  ops: PlanOp[] | null;
  preview: {
    changes: DiffChange[];
    cost_delta_per_person: number;
  };
  warnings: PlanWarning[];
  suggestion: { id: string; author: string } | null;
  status: ProposalStatus;
  close_reason: string | null;
  votes: ProposalVotes;
  votes_at_decision: {
    agree: number;
    disagree: number;
    pending: string[];
    required: number;
    majority: boolean;
  } | null;
  my_vote: VoteValue | null;
  applied_version: number | null;
  expires_at: string | null;
  created_at: string;
  closed_at: string | null;
  voters?: ProposalVoter[];
}

export interface DraftProposalResponse {
  base_version: number;
  ops: PlanOp[];
  summary: string;
  reason: string;
  preview: {
    changes: DiffChange[];
    cost_delta_per_person: number;
  };
  warnings: PlanWarning[];
}

export type SuggestionCategory =
  | "add"
  | "remove"
  | "change_time"
  | "replace"
  | "other";
export type SuggestionStatus = "new" | "converted" | "noted" | "declined";

export interface Suggestion {
  id: string;
  author: { id: string; display_name: string };
  day: number | null;
  item_id: string | null;
  item_name: string | null;
  category: SuggestionCategory;
  content: string;
  based_on_version: number;
  status: SuggestionStatus;
  leader_note: string | null;
  proposal: { id: string; number: number } | null;
  created_at: string;
}

export interface ChatMessage {
  id: number;
  role: "member" | "agent";
  author_name?: string;
  content: string;
  plan_version?: number;
  suggest_feedback?: boolean;
  created_at: string;
}

export interface SendChatResponse {
  question: ChatMessage;
  answer: ChatMessage;
}

export interface TripEvent {
  id: number;
  type:
    | "member_joined"
    | "version_created"
    | "proposal_created"
    | "vote_cast"
    | "proposal_applied"
    | "proposal_closed"
    | "suggestion_created"
    | "suggestion_handled"
    | "chat_message";
  payload: Record<string, unknown>;
  actor: string;
  created_at: string;
}

export interface UpdatesResponse {
  events: TripEvent[];
  last_event_id: number;
  current_version: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
