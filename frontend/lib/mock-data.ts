import {
  ApiError,
  type ChatMessage,
  type CreateTripPayload,
  type CreateTripResponse,
  type DiffChange,
  type DraftProposalResponse,
  type GenerateDraftResponse,
  type InvitePreviewResponse,
  type JoinTripResponse,
  type MemberRole,
  type PlanComputed,
  type PlanData,
  type PlanItem,
  type PlanOp,
  type PlanVersionResponse,
  type PlanWarning,
  type Proposal,
  type SendChatResponse,
  type Suggestion,
  type SuggestionCategory,
  type SuggestionStatus,
  type TripDetailResponse,
  type TripEvent,
  type TripInfo,
  type TripMember,
  type UpdatesResponse,
  type VersionDiffResponse,
  type VersionListItem,
  type VoteValue,
} from "./types";

interface MockVersionRecord {
  version_no: number;
  source: "generate" | "proposal" | "revert";
  summary: string;
  created_by: { id: string; display_name: string };
  proposal: { id: string; number: number } | null;
  created_at: string;
  plan: PlanData;
}

interface MockTripStore {
  trip: TripInfo;
  members: TripMember[];
  tokens: Record<string, string>;
  draft: {
    plan: PlanData;
    computed: PlanComputed;
    agent_run_id: string;
  } | null;
  versions: MockVersionRecord[];
  proposals: Proposal[];
  suggestions: Suggestion[];
  chat: ChatMessage[];
  events: TripEvent[];
  nextProposalNo: number;
  nextItemSeq: number;
  nextChatId: number;
  nextEventId: number;
}

const DEMO_TRIP_ID = "demo-dalat-3n2d";
const DEMO_INVITE_CODE = "dalat3n2d0";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function computePlanMetrics(plan: PlanData, budgetPerPerson: number | null): PlanComputed {
  const per_day = plan.days.map((day) => {
    const dayCost = day.items.reduce((sum, item) => sum + item.cost_per_person, 0);
    const travel = Math.max(25, (day.items.length - 1) * 18);
    return {
      day: day.day,
      cost_per_person: dayCost,
      travel_minutes: day.items.length > 1 ? travel : 0,
    };
  });
  const total_cost_per_person = per_day.reduce((sum, d) => sum + d.cost_per_person, 0);
  const warnings: PlanWarning[] = [];

  for (const day of plan.days) {
    for (let i = 0; i < day.items.length; i += 1) {
      const current = day.items[i];
      if (current.name.toLowerCase().includes("lẩu gà") && current.start < "10:30") {
        warnings.push({
          item_id: current.id,
          type: "closed",
          message: `${current.name} thường mở từ 10:30, giờ hiện tại có thể chưa mở cửa.`,
        });
      }
      if (i > 0) {
        const prev = day.items[i - 1];
        if (current.start < prev.end) {
          warnings.push({
            item_id: current.id,
            type: "overlap",
            message: `Giờ bắt đầu ${current.start} chồng với "${prev.name}" (kết thúc ${prev.end}).`,
          });
        }
      }
    }
  }

  if (budgetPerPerson != null && total_cost_per_person > budgetPerPerson) {
    const firstItem = plan.days[0]?.items[0];
    if (firstItem) {
      warnings.push({
        item_id: firstItem.id,
        type: "over_budget",
        message: `Tổng ước tính vượt ngân sách mục tiêu ${budgetPerPerson.toLocaleString("vi-VN")} đ/người.`,
      });
    }
  }

  return { total_cost_per_person, per_day, warnings };
}

function applyOpsToPlan(
  sourcePlan: PlanData,
  ops: PlanOp[],
  nextId: () => string,
): { plan: PlanData; touchedIds: Set<string>; changes: DiffChange[] } {
  const plan = clone(sourcePlan);
  const touchedIds = new Set<string>();
  const changes: DiffChange[] = [];

  const findItemLocation = (itemId: string) => {
    for (const day of plan.days) {
      const index = day.items.findIndex((it) => it.id === itemId);
      if (index !== -1) {
        return { day, index, item: day.items[index] };
      }
    }
    return null;
  };

  for (const op of ops) {
    if (op.op === "add_item") {
      const targetDay = plan.days.find((d) => d.day === op.day);
      if (!targetDay) {
        throw new ApiError(422, "invalid_ops", `Không tìm thấy ngày ${op.day} trong lịch trình.`);
      }
      const newItem: PlanItem = {
        ...clone(op.item),
        id: nextId(),
      };
      if (op.after_id) {
        touchedIds.add(op.after_id);
        const idx = targetDay.items.findIndex((it) => it.id === op.after_id);
        if (idx === -1) {
          throw new ApiError(422, "invalid_ops", "Không tìm thấy mục tham chiếu để chèn sau.");
        }
        targetDay.items.splice(idx + 1, 0, newItem);
      } else {
        targetDay.items.unshift(newItem);
      }
      changes.push({
        type: "added",
        item_id: newItem.id,
        day: targetDay.day,
        name: newItem.name,
      });
    } else if (op.op === "update_item") {
      const loc = findItemLocation(op.item_id);
      if (!loc) {
        throw new ApiError(422, "invalid_ops", `Không tìm thấy mục ${op.item_id} để cập nhật.`);
      }
      touchedIds.add(op.item_id);
      const fields: Record<string, [unknown, unknown]> = {};
      for (const [k, v] of Object.entries(op.set)) {
        const prevVal = (loc.item as unknown as Record<string, unknown>)[k];
        if (prevVal !== v) {
          fields[k] = [prevVal, v];
          (loc.item as unknown as Record<string, unknown>)[k] = v;
        }
      }
      if (loc.item.end <= loc.item.start) {
        throw new ApiError(422, "invalid_ops", `Giờ kết thúc của "${loc.item.name}" phải sau giờ bắt đầu.`);
      }
      loc.day.items.sort((a, b) => a.start.localeCompare(b.start));
      changes.push({
        type: "updated",
        item_id: loc.item.id,
        name: loc.item.name,
        fields,
      });
    } else if (op.op === "remove_item") {
      const loc = findItemLocation(op.item_id);
      if (!loc) {
        throw new ApiError(422, "invalid_ops", `Không tìm thấy mục ${op.item_id} để xoá.`);
      }
      touchedIds.add(op.item_id);
      const [removed] = loc.day.items.splice(loc.index, 1);
      changes.push({
        type: "removed",
        item_id: removed.id,
        day: loc.day.day,
        name: removed.name,
      });
    } else if (op.op === "move_item") {
      const loc = findItemLocation(op.item_id);
      const destDay = plan.days.find((d) => d.day === op.to_day);
      if (!loc || !destDay) {
        throw new ApiError(422, "invalid_ops", "Không thể chuyển mục sang ngày đích.");
      }
      touchedIds.add(op.item_id);
      if (op.after_id) touchedIds.add(op.after_id);
      const fromDay = loc.day.day;
      const fromStart = loc.item.start;
      const [moved] = loc.day.items.splice(loc.index, 1);
      if (op.after_id) {
        const idx = destDay.items.findIndex((it) => it.id === op.after_id);
        if (idx === -1) {
          destDay.items.push(moved);
        } else {
          destDay.items.splice(idx + 1, 0, moved);
        }
      } else {
        destDay.items.unshift(moved);
      }
      changes.push({
        type: "moved",
        item_id: moved.id,
        name: moved.name,
        from: { day: fromDay, start: fromStart },
        to: { day: destDay.day, start: moved.start },
      });
    }
  }

  return { plan, touchedIds, changes };
}

function buildPlanDiff(fromPlan: PlanData, toPlan: PlanData): DiffChange[] {
  const fromMap = new Map<string, { day: number; item: PlanItem }>();
  const toMap = new Map<string, { day: number; item: PlanItem }>();

  for (const d of fromPlan.days) {
    for (const item of d.items) fromMap.set(item.id, { day: d.day, item });
  }
  for (const d of toPlan.days) {
    for (const item of d.items) toMap.set(item.id, { day: d.day, item });
  }

  const changes: DiffChange[] = [];
  for (const [id, prev] of fromMap) {
    const next = toMap.get(id);
    if (!next) {
      changes.push({ type: "removed", item_id: id, day: prev.day, name: prev.item.name });
      continue;
    }
    if (prev.day !== next.day || prev.item.start !== next.item.start) {
      changes.push({
        type: "moved",
        item_id: id,
        name: next.item.name,
        from: { day: prev.day, start: prev.item.start },
        to: { day: next.day, start: next.item.start },
      });
    }
    if (prev.item.cost_per_person !== next.item.cost_per_person) {
      changes.push({
        type: "updated",
        item_id: id,
        name: next.item.name,
        fields: {
          cost_per_person: [prev.item.cost_per_person, next.item.cost_per_person],
        },
      });
    }
  }
  for (const [id, next] of toMap) {
    if (!fromMap.has(id)) {
      changes.push({ type: "added", item_id: id, day: next.day, name: next.item.name });
    }
  }
  return changes;
}

function buildDalatSeedPlan(): PlanData {
  return {
    schema_version: 1,
    transport: "xe máy thuê",
    notes: "Ưu tiên quán có chỗ cho nhóm 4 người, giờ mở cửa đã kiểm qua Google Places.",
    days: [
      {
        day: 1,
        date: "2026-12-18",
        title: "Nhận phòng & dạo trung tâm",
        items: [
          {
            id: "itm_ckin1",
            start: "11:30",
            end: "12:30",
            kind: "hotel",
            name: "Nhận phòng Homestay Thông Reo",
            place_id: "ChIJ_demo_homestay",
            address: "18 Đặng Thái Thân, Phường 3, Đà Lạt",
            lat: 11.9362,
            lng: 108.4453,
            cost_per_person: 450000,
            reason: "Gần bến xe, nhận phòng sớm để gửi đồ cho cả nhóm",
            note: "Đã tính 2 đêm chia 4 người",
            sources: [{ type: "google", ref: "ChIJ_demo_homestay" }],
          },
          {
            id: "itm_lunch1",
            start: "12:45",
            end: "14:00",
            kind: "food",
            name: "Bánh ướt lòng gà Trang",
            place_id: "ChIJ_demo_trang",
            address: "15F Tăng Bạt Hổ, Phường 1, Đà Lạt",
            lat: 11.9438,
            lng: 108.4366,
            cost_per_person: 65000,
            reason: "Mở xuyên trưa, nhiều món dễ ăn nhanh sau khi di chuyển",
            note: "Có phần trứng non không thịt cho bạn ăn chay tuỳ chọn",
            sources: [
              { type: "google", ref: "ChIJ_demo_trang" },
              { type: "tiktok", ref: "trending_spots:11" },
            ],
          },
          {
            id: "itm_dinh3",
            start: "14:30",
            end: "16:15",
            kind: "sight",
            name: "Dinh Bảo Đại III",
            place_id: "ChIJ_demo_dinh3",
            address: "1 Triệu Việt Vương, Phường 4, Đà Lạt",
            lat: 11.9309,
            lng: 108.4294,
            cost_per_person: 40000,
            reason: "Khuôn viên đồi thông thoáng, phù hợp đi chiều nhẹ nhàng",
            note: "",
            sources: [{ type: "google", ref: "ChIJ_demo_dinh3" }],
          },
          {
            id: "itm_laugalae",
            start: "18:30",
            end: "20:15",
            kind: "food",
            name: "Lẩu gà lá é Tao Ngộ",
            place_id: "ChIJ_demo_taongo",
            address: "27 Lê Đại Hành, Phường 3, Đà Lạt",
            lat: 11.9401,
            lng: 108.4375,
            cost_per_person: 135000,
            reason: "Đang được khen nhiều về nước dùng nóng, hợp thời tiết tối Đà Lạt",
            note: "Nên gọi thêm lẩu nấm riêng cho người ăn chay",
            sources: [
              { type: "google", ref: "ChIJ_demo_taongo" },
              { type: "tiktok", ref: "trending_spots:18" },
            ],
          },
        ],
      },
      {
        day: 2,
        date: "2026-12-19",
        title: "Săn mây Cầu Đất & cà phê đồi",
        items: [
          {
            id: "itm_7f3a2c",
            start: "05:15",
            end: "07:30",
            kind: "sight",
            name: "Đồi chè Cầu Đất",
            place_id: "ChIJ_demo_caudat",
            address: "Xuân Trường, Đà Lạt",
            lat: 11.861,
            lng: 108.554,
            cost_per_person: 0,
            reason: "Săn mây sớm theo nhu cầu nhóm, đón bình minh trên đồi chè",
            note: "Chuẩn bị áo ấm vì sáng sớm dưới 14°C",
            sources: [
              { type: "google", ref: "ChIJ_demo_caudat" },
              { type: "tiktok", ref: "trending_spots:42" },
            ],
          },
          {
            id: "itm_tuimoto",
            start: "08:30",
            end: "10:15",
            kind: "cafe",
            name: "Tiệm cà phê Túi Mơ To",
            place_id: "ChIJ_demo_tuimoto",
            address: "Hẻm 31 Sào Nam, Phường 11, Đà Lạt",
            lat: 11.9452,
            lng: 108.4728,
            cost_per_person: 85000,
            reason: "Cùng tuyến đường từ Cầu Đất về trung tâm, tránh quay đầu",
            note: "Mở từ 07:45",
            sources: [
              { type: "google", ref: "ChIJ_demo_tuimoto" },
              { type: "instagram", ref: "trending_spots:07" },
            ],
          },
          {
            id: "itm_chay2",
            start: "11:45",
            end: "13:00",
            kind: "food",
            name: "Nhà hàng chay Từ Hạnh",
            place_id: "ChIJ_demo_tuhanh",
            address: "17 Hoàng Văn Thụ, Phường 5, Đà Lạt",
            lat: 11.9412,
            lng: 108.4265,
            cost_per_person: 90000,
            reason: "Đáp ứng ràng buộc có thành viên ăn chay, giá vừa phải cho cả nhóm",
            note: "",
            sources: [{ type: "google", ref: "ChIJ_demo_tuhanh" }],
          },
        ],
      },
      {
        day: 3,
        date: "2026-12-20",
        title: "Hồ Tuyền Lâm & mua quà",
        items: [
          {
            id: "itm_tuyenlam",
            start: "08:00",
            end: "10:30",
            kind: "activity",
            name: "Chèo SUP Hồ Tuyền Lâm",
            place_id: "ChIJ_demo_tuyenlam",
            address: "Khu du lịch Hồ Tuyền Lâm, Phường 4, Đà Lạt",
            lat: 11.8975,
            lng: 108.4319,
            cost_per_person: 220000,
            reason: "Buổi sáng mặt hồ êm, kết thúc trước giờ trả phòng 12:00",
            note: "Đặt trước 1 ngày để giữ áo phao đủ 4 người",
            sources: [
              { type: "google", ref: "ChIJ_demo_tuyenlam" },
              { type: "tiktok", ref: "trending_spots:53" },
            ],
          },
          {
            id: "itm_cho3",
            start: "13:30",
            end: "15:00",
            kind: "other",
            name: "Chợ Đà Lạt & đặc sản dâu tây",
            place_id: "ChIJ_demo_chodl",
            address: "Nguyễn Thị Minh Khai, Phường 1, Đà Lạt",
            lat: 11.9424,
            lng: 108.4378,
            cost_per_person: 150000,
            reason: "Mua quà trước khi ra bến xe lúc 16:00",
            note: "",
            sources: [{ type: "google", ref: "ChIJ_demo_chodl" }],
          },
        ],
      },
    ],
  };
}

function buildDemoStore(): MockTripStore {
  const v1Plan = buildDalatSeedPlan();
  const v2Plan = clone(v1Plan);
  // v2 slightly changed homestay note and added afternoon cafe on day 2
  v2Plan.days[1].items.push({
    id: "itm_binhyen",
    start: "15:30",
    end: "17:15",
    kind: "cafe",
    name: "Đợi Một Người Cafe",
    place_id: "ChIJ_demo_doimotnguoi",
    address: "Tổ dân phố 65, Khởi Nghĩa Bắc Sơn, Phường 10, Đà Lạt",
    lat: 11.9261,
    lng: 108.4498,
    cost_per_person: 75000,
    reason: "Ngắm hoàng hôn rừng thông, tách riêng khỏi lộ trình sáng",
    note: "",
    sources: [
      { type: "google", ref: "ChIJ_demo_doimotnguoi" },
      { type: "tiktok", ref: "trending_spots:24" },
    ],
  });

  const members: TripMember[] = [
    { id: "mem_duc", display_name: "Đức", role: "leader" },
    { id: "mem_phuc", display_name: "Phúc", role: "member" },
    { id: "mem_toan", display_name: "Toàn", role: "member" },
    { id: "mem_khuong", display_name: "Khương", role: "member" },
  ];

  const proposalOps: PlanOp[] = [
    {
      op: "move_item",
      item_id: "itm_dinh3",
      to_day: 2,
      after_id: "itm_chay2",
    },
    {
      op: "update_item",
      item_id: "itm_dinh3",
      set: { start: "13:30", end: "15:00" },
    },
  ];
  const previewResult = applyOpsToPlan(v2Plan, proposalOps, () => "itm_tmp");

  const demoProposal: Proposal = {
    id: "prop_7",
    number: 7,
    kind: "edit",
    origin: "agent",
    author: { id: "mem_duc", display_name: "Đức" },
    base_version: 2,
    target_version: null,
    summary: "Chuyển Dinh Bảo Đại III sang đầu giờ chiều ngày 2",
    reason: "Chiều ngày 1 vừa nhận phòng xong hơi gấp, dời sang ngày 2 nhẹ hơn",
    ops: proposalOps,
    preview: {
      changes: previewResult.changes,
      cost_delta_per_person: 0,
    },
    warnings: [],
    suggestion: null,
    status: "open",
    close_reason: null,
    votes: {
      agree: 2,
      disagree: 0,
      required: 3,
      majority: false,
      total_members: 4,
      pending: ["Phúc", "Khương"],
    },
    votes_at_decision: null,
    my_vote: "agree",
    applied_version: null,
    expires_at: null,
    created_at: "2026-11-27T07:10:00Z",
    closed_at: null,
    voters: [
      {
        member: { id: "mem_duc", display_name: "Đức" },
        value: "agree",
        updated_at: "2026-11-27T07:10:00Z",
      },
      {
        member: { id: "mem_toan", display_name: "Toàn" },
        value: "agree",
        updated_at: "2026-11-27T07:15:00Z",
      },
    ],
  };

  const demoSuggestion: Suggestion = {
    id: "sug_1",
    author: { id: "mem_phuc", display_name: "Phúc" },
    day: 1,
    item_id: "itm_lunch1",
    item_name: "Bánh ướt lòng gà Trang",
    category: "replace",
    content: "Bữa trưa ngày 1 đổi sang quán có nhiều món chay hơn vì có 1 bạn ăn chay trường.",
    based_on_version: 2,
    status: "new",
    leader_note: null,
    proposal: null,
    created_at: "2026-11-27T07:20:00Z",
  };

  const demoChat: ChatMessage[] = [
    {
      id: 1,
      role: "member",
      author_name: "Phúc",
      content: "Ngày 2 tổng thời gian di chuyển khoảng bao lâu vậy Roa?",
      created_at: "2026-11-27T07:22:00Z",
    },
    {
      id: 2,
      role: "agent",
      content:
        "Theo bản v2, ngày 2 gồm 4 điểm từ Đồi chè Cầu Đất về trung tâm, tổng thời gian di chuyển ước tính khoảng 54 phút bằng xe máy.",
      plan_version: 2,
      suggest_feedback: false,
      created_at: "2026-11-27T07:22:04Z",
    },
    {
      id: 3,
      role: "member",
      author_name: "Toàn",
      content: "Đổi giúp mình bữa trưa ngày 1 sang quán lẩu rau Leguda được không?",
      created_at: "2026-11-27T07:25:00Z",
    },
    {
      id: 4,
      role: "agent",
      content:
        "Mình chỉ có quyền xem và giải đáp về lịch trình hiện tại (v2), không tự sửa plan. Bạn có thể gửi góp ý này để nhóm trưởng Đức tạo đề xuất cho cả nhóm bỏ phiếu nhé.",
      plan_version: 2,
      suggest_feedback: true,
      created_at: "2026-11-27T07:25:05Z",
    },
  ];

  return {
    trip: {
      id: DEMO_TRIP_ID,
      title: "Đà Lạt 3N2Đ — Nhóm bạn thân",
      destination: "Đà Lạt",
      start_date: "2026-12-18",
      end_date: "2026-12-20",
      group_size: 4,
      budget_per_person: 2500000,
      preferences: {
        interests: ["cà phê đồi", "săn mây", "ẩm thực địa phương"],
        constraints: ["1 người ăn chay", "không đi quá gấp buổi sáng"],
        transport: "xe máy thuê",
      },
      invite_code: DEMO_INVITE_CODE,
      current_version: 2,
      generation_status: "done",
    },
    members,
    tokens: {
      "demo-token-leader-duc": "mem_duc",
      "demo-token-member-phuc": "mem_phuc",
      "demo-token-member-toan": "mem_toan",
      "demo-token-member-khuong": "mem_khuong",
    },
    draft: null,
    versions: [
      {
        version_no: 2,
        source: "proposal",
        summary: "Áp dụng đề xuất #6 (3/4 đồng ý) — thêm quán cà phê chiều ngày 2",
        created_by: { id: "mem_duc", display_name: "Đức" },
        proposal: { id: "prop_6", number: 6 },
        created_at: "2026-11-27T07:05:00Z",
        plan: v2Plan,
      },
      {
        version_no: 1,
        source: "generate",
        summary: "Duyệt lịch trình ban đầu do Roa soạn",
        created_by: { id: "mem_duc", display_name: "Đức" },
        proposal: null,
        created_at: "2026-11-27T06:45:00Z",
        plan: v1Plan,
      },
    ],
    proposals: [demoProposal],
    suggestions: [demoSuggestion],
    chat: demoChat,
    events: [],
    nextProposalNo: 8,
    nextItemSeq: 100,
    nextChatId: 5,
    nextEventId: 10,
  };
}

const stores = new Map<string, MockTripStore>();
const inviteIndex = new Map<string, string>();

function ensureDemoSeeded(): void {
  if (!stores.has(DEMO_TRIP_ID)) {
    stores.set(DEMO_TRIP_ID, buildDemoStore());
    inviteIndex.set(DEMO_INVITE_CODE, DEMO_TRIP_ID);
  }
}

function getStore(tripId: string): MockTripStore {
  ensureDemoSeeded();
  const store = stores.get(tripId);
  if (!store) {
    throw new ApiError(404, "not_found", "Không tìm thấy chuyến đi.");
  }
  return store;
}

function requireMember(store: MockTripStore, token: string): TripMember {
  const memberId = store.tokens[token];
  const member = store.members.find((m) => m.id === memberId);
  if (!member) {
    throw new ApiError(401, "unauthorized", "Phiên truy cập không hợp lệ hoặc đã hết hạn.");
  }
  return member;
}

function requireLeader(store: MockTripStore, token: string): TripMember {
  const member = requireMember(store, token);
  if (member.role !== "leader") {
    throw new ApiError(403, "not_leader", "Chỉ nhóm trưởng mới được thực hiện thao tác này.");
  }
  return member;
}

function recomputeProposalVotes(proposal: Proposal, store: MockTripStore): void {
  const voters = proposal.voters ?? [];
  const agree = voters.filter((v) => v.value === "agree").length;
  const disagree = voters.filter((v) => v.value === "disagree").length;
  const votedIds = new Set(voters.map((v) => v.member.id));
  const pending = store.members
    .filter((m) => !votedIds.has(m.id))
    .map((m) => m.display_name);
  const required = Math.floor(store.members.length / 2) + 1;
  proposal.votes = {
    agree,
    disagree,
    required,
    majority: agree >= required,
    total_members: store.members.length,
    pending,
  };
}

function buildPlanForTrip(payload: TripInfo): PlanData {
  const base = buildDalatSeedPlan();
  const start = new Date(payload.start_date);
  const end = new Date(payload.end_date);
  const diffDays = Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())
    ? 3
    : Math.max(1, Math.min(5, Math.round((end.getTime() - start.getTime()) / 86400000) + 1));

  base.transport = payload.preferences.transport || "xe máy thuê";
  base.days = Array.from({ length: diffDays }, (_, idx) => {
    const template = base.days[idx % base.days.length];
    const dateObj = new Date(start.getTime() + idx * 86400000);
    const isoDate = Number.isNaN(dateObj.getTime())
      ? payload.start_date
      : dateObj.toISOString().slice(0, 10);
    return {
      day: idx + 1,
      date: isoDate,
      title: idx < 3 ? template.title : `Khám phá ${payload.destination} ngày ${idx + 1}`,
      items: template.items.map((item, itemIdx) => ({
        ...clone(item),
        id: `itm_d${idx + 1}_${itemIdx + 1}`,
      })),
    };
  });
  return base;
}

function pushEvent(
  store: MockTripStore,
  type: TripEvent["type"],
  actor: string,
  payload: Record<string, unknown>,
): void {
  store.events.push({
    id: store.nextEventId++,
    type,
    actor,
    payload,
    created_at: new Date().toISOString(),
  });
}

export function isMockTripId(tripId: string): boolean {
  return tripId === DEMO_TRIP_ID || stores.has(tripId);
}

export function isMockInviteCode(inviteCode: string): boolean {
  return inviteCode === DEMO_INVITE_CODE || inviteIndex.has(inviteCode);
}

export const mockApi = {
  async createTrip(payload: CreateTripPayload): Promise<CreateTripResponse> {
    ensureDemoSeeded();
    const id = `trip_${Math.random().toString(36).slice(2, 10)}`;
    const inviteCode = Math.random().toString(36).slice(2, 12);
    const leaderId = `mem_${Math.random().toString(36).slice(2, 8)}`;
    const token = `tok_${Math.random().toString(36).slice(2, 14)}`;

    const trip: TripInfo = {
      id,
      title: payload.title,
      destination: payload.destination,
      start_date: payload.start_date,
      end_date: payload.end_date,
      group_size: payload.group_size,
      budget_per_person: payload.budget_per_person,
      preferences: payload.preferences,
      invite_code: inviteCode,
      current_version: 0,
      generation_status: "idle",
    };
    const leader: TripMember = {
      id: leaderId,
      display_name: payload.leader_name,
      role: "leader",
    };

    stores.set(id, {
      trip,
      members: [leader],
      tokens: { [token]: leaderId },
      draft: null,
      versions: [],
      proposals: [],
      suggestions: [],
      chat: [],
      events: [],
      nextProposalNo: 1,
      nextItemSeq: 1,
      nextChatId: 1,
      nextEventId: 1,
    });
    inviteIndex.set(inviteCode, id);

    return {
      trip: {
        id: trip.id,
        title: trip.title,
        current_version: 0,
        generation_status: "idle",
        invite_code: inviteCode,
      },
      member: leader,
      token,
      invite_url: `/join/${inviteCode}`,
    };
  },

  async getInvitePreview(inviteCode: string): Promise<InvitePreviewResponse> {
    ensureDemoSeeded();
    const tripId = inviteIndex.get(inviteCode);
    if (!tripId) {
      throw new ApiError(404, "not_found", "Link mời không tồn tại hoặc đã hết hạn.");
    }
    const store = getStore(tripId);
    return {
      trip: {
        title: store.trip.title,
        destination: store.trip.destination,
        start_date: store.trip.start_date,
        end_date: store.trip.end_date,
      },
      member_count: store.members.length,
    };
  },

  async joinTrip(inviteCode: string, displayName: string): Promise<JoinTripResponse> {
    ensureDemoSeeded();
    const tripId = inviteIndex.get(inviteCode);
    if (!tripId) {
      throw new ApiError(404, "not_found", "Không tìm thấy chuyến đi theo mã mời này.");
    }
    const store = getStore(tripId);
    const trimmed = displayName.trim();
    if (store.members.some((m) => m.display_name.toLowerCase() === trimmed.toLowerCase())) {
      throw new ApiError(409, "name_taken", "Tên hiển thị này đã có người dùng trong chuyến đi, hãy chọn tên khác.");
    }
    const member: TripMember = {
      id: `mem_${Math.random().toString(36).slice(2, 8)}`,
      display_name: trimmed,
      role: "member",
    };
    const token = `tok_${Math.random().toString(36).slice(2, 14)}`;
    store.members.push(member);
    store.tokens[token] = member.id;
    pushEvent(store, "member_joined", member.display_name, { member_id: member.id });
    return { trip_id: store.trip.id, member, token };
  },

  async getTrip(tripId: string, token: string): Promise<TripDetailResponse> {
    const store = getStore(tripId);
    const me = requireMember(store, token);
    const openProposals = store.proposals.filter((p) => p.status === "open").length;
    const newSuggestions = store.suggestions.filter((s) => s.status === "new").length;
    return {
      trip: clone(store.trip),
      members: clone(store.members),
      me: { id: me.id, role: me.role },
      counts:
        me.role === "leader"
          ? { open_proposals: openProposals, new_suggestions: newSuggestions }
          : { open_proposals: openProposals },
    };
  },

  async generateDraft(
    tripId: string,
    token: string,
    extraRequest?: string,
  ): Promise<GenerateDraftResponse> {
    const store = getStore(tripId);
    requireLeader(store, token);
    if (store.trip.current_version > 0) {
      throw new ApiError(409, "plan_exists", "Chuyến đi đã có phiên bản v1, không thể tạo lại bản đầu.");
    }
    const agentRunId = `run_${Math.random().toString(36).slice(2, 10)}`;

    if (
      store.trip.budget_per_person !== null &&
      store.trip.budget_per_person < 600000
    ) {
      store.trip.generation_status = "done";
      return {
        status: "infeasible",
        draft: null,
        reasons: [
          `Ngân sách ${store.trip.budget_per_person.toLocaleString("vi-VN")} đ/người không đủ cho lịch trình ${store.trip.destination} kèm chi phí lưu trú và ăn uống.`,
          "Gợi ý: tăng ngân sách lên tối thiểu 1.200.000 đ/người hoặc rút ngắn số ngày.",
        ],
        agent_run_id: agentRunId,
      };
    }

    const plan = buildPlanForTrip(store.trip);
    if (extraRequest?.trim()) {
      plan.notes = `${plan.notes} Yêu cầu bổ sung: ${extraRequest.trim()}.`;
    }
    const computed = computePlanMetrics(plan, store.trip.budget_per_person);
    store.draft = { plan, computed, agent_run_id: agentRunId };
    store.trip.generation_status = "done";
    return {
      status: "ok",
      draft: {
        plan: clone(plan),
        computed,
        warnings: computed.warnings,
      },
      agent_run_id: agentRunId,
    };
  },

  async approveInitialPlan(
    tripId: string,
    token: string,
    plan: PlanData,
  ): Promise<{ version: PlanVersionResponse }> {
    const store = getStore(tripId);
    const leader = requireLeader(store, token);
    if (store.trip.current_version > 0) {
      throw new ApiError(409, "plan_exists", "Chuyến đi đã có bản v1.");
    }
    const computed = computePlanMetrics(plan, store.trip.budget_per_person);
    const createdAt = new Date().toISOString();
    const record: MockVersionRecord = {
      version_no: 1,
      source: "generate",
      summary: "Duyệt lịch trình ban đầu do Roa soạn",
      created_by: { id: leader.id, display_name: leader.display_name },
      proposal: null,
      created_at: createdAt,
      plan: clone(plan),
    };
    store.versions.unshift(record);
    store.trip.current_version = 1;
    pushEvent(store, "version_created", leader.display_name, { version_no: 1 });

    return {
      version: {
        version_no: 1,
        is_current: true,
        plan: clone(plan),
        computed,
        source: "generate",
        proposal: null,
        created_at: createdAt,
      },
    };
  },

  async getPlan(
    tripId: string,
    token: string,
    version?: number,
  ): Promise<PlanVersionResponse> {
    const store = getStore(tripId);
    requireMember(store, token);
    const targetNo = version ?? store.trip.current_version;
    const found = store.versions.find((v) => v.version_no === targetNo);
    if (!found) {
      throw new ApiError(404, "not_found", "Không tìm thấy phiên bản lịch trình.");
    }
    return {
      version_no: found.version_no,
      is_current: found.version_no === store.trip.current_version,
      plan: clone(found.plan),
      computed: computePlanMetrics(found.plan, store.trip.budget_per_person),
      source: found.source,
      proposal: found.proposal,
      created_at: found.created_at,
    };
  },

  async getVersions(tripId: string, token: string): Promise<{ items: VersionListItem[] }> {
    const store = getStore(tripId);
    requireMember(store, token);
    return {
      items: store.versions.map((v) => ({
        version_no: v.version_no,
        source: v.source,
        summary: v.summary,
        created_by: v.created_by,
        proposal: v.proposal,
        created_at: v.created_at,
      })),
    };
  },

  async getVersionDiff(
    tripId: string,
    token: string,
    versionNo: number,
    against?: number,
  ): Promise<VersionDiffResponse> {
    const store = getStore(tripId);
    requireMember(store, token);
    const fromNo = against ?? Math.max(1, versionNo - 1);
    const fromVer = store.versions.find((v) => v.version_no === fromNo);
    const toVer = store.versions.find((v) => v.version_no === versionNo);
    if (!fromVer || !toVer) {
      throw new ApiError(404, "not_found", "Không tìm thấy phiên bản để so sánh.");
    }
    const fromCost = computePlanMetrics(fromVer.plan, store.trip.budget_per_person).total_cost_per_person;
    const toCost = computePlanMetrics(toVer.plan, store.trip.budget_per_person).total_cost_per_person;
    return {
      from: fromNo,
      to: versionNo,
      changes: buildPlanDiff(fromVer.plan, toVer.plan),
      cost_delta_per_person: toCost - fromCost,
    };
  },

  async draftProposal(
    tripId: string,
    token: string,
    request: string,
  ): Promise<DraftProposalResponse> {
    const store = getStore(tripId);
    requireLeader(store, token);
    const current = store.versions.find((v) => v.version_no === store.trip.current_version);
    if (!current) {
      throw new ApiError(404, "not_found", "Chưa có phiên bản lịch trình để sửa.");
    }
    const firstDay = current.plan.days[0];
    const firstItem = firstDay?.items[0];
    const ops: PlanOp[] = firstItem
      ? [
          {
            op: "update_item",
            item_id: firstItem.id,
            set: { note: `Ghi chú từ Roa: ${request.trim()}` },
          },
        ]
      : [];
    const applied = applyOpsToPlan(current.plan, ops, () => `itm_${store.nextItemSeq++}`);
    const computed = computePlanMetrics(applied.plan, store.trip.budget_per_person);
    return {
      base_version: current.version_no,
      ops,
      summary: `Roa soạn theo yêu cầu: "${request.trim()}"`,
      reason: "Đã kiểm tra ràng buộc giờ mở cửa trên phiên bản hiện tại.",
      preview: {
        changes: applied.changes,
        cost_delta_per_person: 0,
      },
      warnings: computed.warnings,
    };
  },

  async createProposal(
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
    const store = getStore(tripId);
    const leader = requireLeader(store, token);
    const baseVer = store.versions.find((v) => v.version_no === payload.base_version);
    if (!baseVer) {
      throw new ApiError(409, "version_conflict", "Phiên bản gốc không tồn tại.");
    }

    let changes: DiffChange[] = [];
    let costDelta = 0;
    let warnings: PlanWarning[] = [];

    if (payload.kind === "edit") {
      const ops = payload.ops ?? [];
      const res = applyOpsToPlan(baseVer.plan, ops, () => `itm_prev_${store.nextItemSeq++}`);
      changes = res.changes;
      const baseCost = computePlanMetrics(baseVer.plan, store.trip.budget_per_person).total_cost_per_person;
      const nextMetrics = computePlanMetrics(res.plan, store.trip.budget_per_person);
      costDelta = nextMetrics.total_cost_per_person - baseCost;
      warnings = nextMetrics.warnings;
    } else {
      const targetVer = store.versions.find((v) => v.version_no === payload.target_version);
      if (!targetVer) {
        throw new ApiError(404, "not_found", "Không tìm thấy phiên bản đích để khôi phục.");
      }
      changes = buildPlanDiff(baseVer.plan, targetVer.plan);
    }

    const linkedSuggestion = payload.suggestion_id
      ? store.suggestions.find((s) => s.id === payload.suggestion_id)
      : undefined;

    const number = store.nextProposalNo++;
    const proposal: Proposal = {
      id: `prop_${number}`,
      number,
      kind: payload.kind,
      origin: payload.origin,
      author: { id: leader.id, display_name: leader.display_name },
      base_version: payload.base_version,
      target_version: payload.target_version ?? null,
      summary: payload.summary,
      reason: payload.reason ?? null,
      ops: payload.ops ?? null,
      preview: { changes, cost_delta_per_person: costDelta },
      warnings,
      suggestion: linkedSuggestion
        ? { id: linkedSuggestion.id, author: linkedSuggestion.author.display_name }
        : null,
      status: "open",
      close_reason: null,
      votes: {
        agree: 1,
        disagree: 0,
        required: Math.floor(store.members.length / 2) + 1,
        majority: 1 >= Math.floor(store.members.length / 2) + 1,
        total_members: store.members.length,
        pending: store.members.filter((m) => m.id !== leader.id).map((m) => m.display_name),
      },
      votes_at_decision: null,
      my_vote: "agree",
      applied_version: null,
      expires_at: payload.expires_at ?? null,
      created_at: new Date().toISOString(),
      closed_at: null,
      voters: [
        {
          member: { id: leader.id, display_name: leader.display_name },
          value: "agree",
          updated_at: new Date().toISOString(),
        },
      ],
    };

    if (linkedSuggestion) {
      linkedSuggestion.status = "converted";
      linkedSuggestion.proposal = { id: proposal.id, number: proposal.number };
    }

    store.proposals.unshift(proposal);
    pushEvent(store, "proposal_created", leader.display_name, { proposal_id: proposal.id });
    return clone(proposal);
  },

  async getProposals(
    tripId: string,
    token: string,
    status: "open" | "closed" | "all" = "open",
  ): Promise<{ items: Proposal[] }> {
    const store = getStore(tripId);
    const me = requireMember(store, token);
    const items = store.proposals
      .filter((p) => {
        if (status === "open") return p.status === "open";
        if (status === "closed") return p.status !== "open";
        return true;
      })
      .map((p) => {
        const copy = clone(p);
        const mine = copy.voters?.find((v) => v.member.id === me.id);
        copy.my_vote = mine?.value ?? null;
        return copy;
      });
    return { items };
  },

  async castVote(
    tripId: string,
    proposalId: string,
    token: string,
    value: VoteValue,
  ): Promise<{ proposal: Proposal }> {
    const store = getStore(tripId);
    const me = requireMember(store, token);
    const proposal = store.proposals.find((p) => p.id === proposalId);
    if (!proposal) {
      throw new ApiError(404, "not_found", "Không tìm thấy đề xuất.");
    }
    if (proposal.status !== "open") {
      throw new ApiError(410, "proposal_closed", "Đề xuất đã đóng, không thể bỏ phiếu.");
    }
    const voters = proposal.voters ?? [];
    const existing = voters.find((v) => v.member.id === me.id);
    const now = new Date().toISOString();
    if (existing) {
      existing.value = value;
      existing.updated_at = now;
    } else {
      voters.push({
        member: { id: me.id, display_name: me.display_name },
        value,
        updated_at: now,
      });
    }
    proposal.voters = voters;
    recomputeProposalVotes(proposal, store);
    proposal.my_vote = value;
    pushEvent(store, "vote_cast", me.display_name, {
      proposal_id: proposal.id,
      agree: proposal.votes.agree,
      disagree: proposal.votes.disagree,
    });
    return { proposal: clone(proposal) };
  },

  async applyProposal(
    tripId: string,
    proposalId: string,
    token: string,
  ): Promise<{ proposal: Proposal; new_version: number }> {
    const store = getStore(tripId);
    const leader = requireLeader(store, token);
    const proposal = store.proposals.find((p) => p.id === proposalId);
    if (!proposal) {
      throw new ApiError(404, "not_found", "Không tìm thấy đề xuất.");
    }
    if (proposal.status !== "open") {
      throw new ApiError(410, "proposal_closed", "Đề xuất này đã được xử lý trước đó.");
    }

    const currentVer = store.versions.find((v) => v.version_no === store.trip.current_version);
    if (!currentVer) {
      throw new ApiError(404, "not_found", "Không có phiên bản hiện tại.");
    }

    let nextPlan: PlanData;
    if (proposal.kind === "revert") {
      if (store.trip.current_version !== proposal.base_version) {
        proposal.status = "stale";
        proposal.close_reason = "conflict";
        proposal.closed_at = new Date().toISOString();
        throw new ApiError(409, "proposal_stale", "Plan đã có thay đổi mới, đề xuất khôi phục đã cũ.");
      }
      const targetVer = store.versions.find((v) => v.version_no === proposal.target_version);
      if (!targetVer) {
        throw new ApiError(404, "not_found", "Không tìm thấy phiên bản đích.");
      }
      nextPlan = clone(targetVer.plan);
    } else {
      const applied = applyOpsToPlan(
        currentVer.plan,
        proposal.ops ?? [],
        () => `itm_${store.nextItemSeq++}`,
      );
      nextPlan = applied.plan;
    }

    const newVersionNo = store.trip.current_version + 1;
    const now = new Date().toISOString();
    store.versions.unshift({
      version_no: newVersionNo,
      source: proposal.kind === "revert" ? "revert" : "proposal",
      summary: `Áp dụng đề xuất #${proposal.number} (${proposal.votes.agree}/${proposal.votes.total_members} đồng ý)`,
      created_by: { id: leader.id, display_name: leader.display_name },
      proposal: { id: proposal.id, number: proposal.number },
      created_at: now,
      plan: nextPlan,
    });
    store.trip.current_version = newVersionNo;

    proposal.status = "applied";
    proposal.applied_version = newVersionNo;
    proposal.closed_at = now;
    proposal.votes_at_decision = {
      agree: proposal.votes.agree,
      disagree: proposal.votes.disagree,
      pending: proposal.votes.pending,
      required: proposal.votes.required,
      majority: proposal.votes.majority,
    };

    pushEvent(store, "proposal_applied", leader.display_name, {
      proposal_id: proposal.id,
      version_no: newVersionNo,
    });

    return { proposal: clone(proposal), new_version: newVersionNo };
  },

  async closeProposal(
    tripId: string,
    proposalId: string,
    token: string,
  ): Promise<Proposal> {
    const store = getStore(tripId);
    const leader = requireLeader(store, token);
    const proposal = store.proposals.find((p) => p.id === proposalId);
    if (!proposal) {
      throw new ApiError(404, "not_found", "Không tìm thấy đề xuất.");
    }
    if (proposal.status !== "open") {
      throw new ApiError(410, "proposal_closed", "Đề xuất đã đóng.");
    }
    proposal.status = "reference";
    proposal.close_reason = "leader_closed";
    proposal.closed_at = new Date().toISOString();
    proposal.votes_at_decision = {
      agree: proposal.votes.agree,
      disagree: proposal.votes.disagree,
      pending: proposal.votes.pending,
      required: proposal.votes.required,
      majority: proposal.votes.majority,
    };
    pushEvent(store, "proposal_closed", leader.display_name, { proposal_id: proposal.id });
    return clone(proposal);
  },

  async withdrawProposal(
    tripId: string,
    proposalId: string,
    token: string,
  ): Promise<Proposal> {
    const store = getStore(tripId);
    const leader = requireLeader(store, token);
    const proposal = store.proposals.find((p) => p.id === proposalId);
    if (!proposal) {
      throw new ApiError(404, "not_found", "Không tìm thấy đề xuất.");
    }
    if (proposal.status !== "open") {
      throw new ApiError(410, "proposal_closed", "Đề xuất đã đóng.");
    }
    proposal.status = "withdrawn";
    proposal.close_reason = "withdrawn";
    proposal.closed_at = new Date().toISOString();
    pushEvent(store, "proposal_closed", leader.display_name, { proposal_id: proposal.id });
    return clone(proposal);
  },

  async createSuggestion(
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
    const store = getStore(tripId);
    const me = requireMember(store, token);
    const current = store.versions.find((v) => v.version_no === payload.based_on_version);
    let itemName: string | null = null;
    if (current && payload.item_id) {
      for (const d of current.plan.days) {
        const hit = d.items.find((it) => it.id === payload.item_id);
        if (hit) itemName = hit.name;
      }
    }
    const suggestion: Suggestion = {
      id: `sug_${Math.random().toString(36).slice(2, 8)}`,
      author: { id: me.id, display_name: me.display_name },
      day: payload.day,
      item_id: payload.item_id,
      item_name: itemName,
      category: payload.category,
      content: payload.content.trim(),
      based_on_version: payload.based_on_version,
      status: "new",
      leader_note: null,
      proposal: null,
      created_at: new Date().toISOString(),
    };
    store.suggestions.unshift(suggestion);
    pushEvent(store, "suggestion_created", me.display_name, { suggestion_id: suggestion.id });
    return clone(suggestion);
  },

  async getSuggestions(
    tripId: string,
    token: string,
    status?: SuggestionStatus | "all",
  ): Promise<{ items: Suggestion[] }> {
    const store = getStore(tripId);
    const me = requireMember(store, token);
    const list = store.suggestions.filter((s) => {
      if (me.role !== "leader" && s.author.id !== me.id) return false;
      if (status && status !== "all") return s.status === status;
      return true;
    });
    return { items: clone(list) };
  },

  async updateSuggestion(
    tripId: string,
    suggestionId: string,
    token: string,
    payload: { status: "noted" | "declined"; leader_note?: string },
  ): Promise<Suggestion> {
    const store = getStore(tripId);
    const leader = requireLeader(store, token);
    const sug = store.suggestions.find((s) => s.id === suggestionId);
    if (!sug) {
      throw new ApiError(404, "not_found", "Không tìm thấy góp ý.");
    }
    sug.status = payload.status;
    sug.leader_note = payload.leader_note?.trim() || null;
    pushEvent(store, "suggestion_handled", leader.display_name, { suggestion_id: sug.id });
    return clone(sug);
  },

  async sendChat(
    tripId: string,
    token: string,
    message: string,
  ): Promise<SendChatResponse> {
    const store = getStore(tripId);
    const me = requireMember(store, token);
    const now = new Date().toISOString();
    const trimmed = message.trim();
    const question: ChatMessage = {
      id: store.nextChatId++,
      role: "member",
      author_name: me.display_name,
      content: trimmed,
      created_at: now,
    };

    const lower = trimmed.toLowerCase();
    const wantsEdit =
      lower.includes("đổi") ||
      lower.includes("thêm") ||
      lower.includes("xoá") ||
      lower.includes("xóa") ||
      lower.includes("sửa") ||
      lower.includes("chuyển");

    const currentVer = store.versions.find((v) => v.version_no === store.trip.current_version);
    const computed = currentVer
      ? computePlanMetrics(currentVer.plan, store.trip.budget_per_person)
      : null;

    let replyContent = `Theo bản v${store.trip.current_version}, tổng chi phí ước tính là ${computed ? computed.total_cost_per_person.toLocaleString("vi-VN") : "0"} đ/người và tất cả địa điểm đều lấy từ dữ liệu đã kiểm.`;
    if (wantsEdit) {
      replyContent =
        "Roa chỉ hỗ trợ tra cứu và giải đáp trên phiên bản hiện tại, không tự thay đổi lịch trình. Nếu bạn muốn đổi mục này, hãy bấm nút gửi góp ý bên dưới để nhóm trưởng xem xét tạo đề xuất nhé.";
    } else if (lower.includes("ngày 2") || lower.includes("di chuyển")) {
      const day2 = computed?.per_day.find((d) => d.day === 2);
      replyContent = day2
        ? `Ở bản v${store.trip.current_version}, ngày 2 có tổng thời gian di chuyển khoảng ${day2.travel_minutes} phút và chi phí ước tính ${day2.cost_per_person.toLocaleString("vi-VN")} đ/người.`
        : "Chưa thấy thông tin ngày 2 trong phiên bản hiện tại.";
    }

    const answer: ChatMessage = {
      id: store.nextChatId++,
      role: "agent",
      content: replyContent,
      plan_version: store.trip.current_version,
      suggest_feedback: wantsEdit,
      created_at: new Date().toISOString(),
    };
    store.chat.push(question, answer);
    pushEvent(store, "chat_message", me.display_name, { message_id: answer.id });
    return { question: clone(question), answer: clone(answer) };
  },

  async getChat(tripId: string, token: string): Promise<{ items: ChatMessage[] }> {
    const store = getStore(tripId);
    requireMember(store, token);
    return { items: clone(store.chat) };
  },

  async getUpdates(
    tripId: string,
    token: string,
    since = 0,
  ): Promise<UpdatesResponse> {
    const store = getStore(tripId);
    requireMember(store, token);
    const events = store.events.filter((e) => e.id > since).slice(0, 100);
    const last_event_id = events.length > 0 ? events[events.length - 1].id : since;
    return {
      events: clone(events),
      last_event_id,
      current_version: store.trip.current_version,
    };
  },

  ensureRoleToken(tripId: string, role: MemberRole): { memberId: string; displayName: string; token: string } {
    const store = getStore(tripId);
    const target = store.members.find((m) => m.role === role) ?? store.members[0];
    const tokenEntry = Object.entries(store.tokens).find(([, memId]) => memId === target.id);
    return {
      memberId: target.id,
      displayName: target.display_name,
      token: tokenEntry ? tokenEntry[0] : "demo-token-leader-duc",
    };
  },
};
