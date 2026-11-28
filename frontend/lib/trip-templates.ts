export interface TripTemplate {
  id: string;
  title: string;
  titleEn: string;
  destination: string;
  region: string;
  regionEn: string;
  image: string;
  imageAlt: string;
  imageAltEn: string;
  durationLabel: string;
  durationLabelEn: string;
  daysCount: number;
  groupSize: number;
  budgetPerPerson: number;
  transport: string;
  interests: string[];
  constraints: string[];
  extraNote: string;
  summary: string;
  summaryEn: string;
  highlights: string[];
  badge: string;
  badgeEn: string;
}

export const TRIP_TEMPLATES: TripTemplate[] = [
  {
    id: "dalat-chill",
    title: "Đà Lạt săn mây & cà phê đồi 3N2Đ",
    titleEn: "Da Lat Cloud Hunting & Hilltop Cafes 3D2N",
    destination: "Đà Lạt",
    region: "Tây Nguyên",
    regionEn: "Central Highlands",
    image: "/images/tpl-dalat.jpg",
    imageAlt: "Đồi chè Cầu Đất trong sương sớm tại Đà Lạt, Việt Nam",
    imageAltEn: "Cau Dat tea hills in morning mist in Da Lat, Vietnam",
    durationLabel: "3 ngày 2 đêm",
    durationLabelEn: "3 days 2 nights",
    daysCount: 3,
    groupSize: 6,
    budgetPerPerson: 2500000,
    transport: "xe máy thuê",
    interests: ["Cà phê đồi", "Săn mây sáng sớm", "Ẩm thực địa phương"],
    constraints: ["Ưu tiên quán mở sớm", "Không đi đêm muộn"],
    extraNote: "Ưu tiên các quán cà phê view đồi và lẩu gà lá é buổi tối.",
    summary:
      "Lịch trình nhẹ nhàng cho nhóm bạn thích săn mây, cà phê đồi và ăn tối ấm cúng.",
    summaryEn:
      "Easy-paced itinerary for groups who love sunrise cloud hunting, hilltop cafes, and cozy hotpot.",
    highlights: ["Đồi chè Cầu Đất 05:15", "Túi Mơ To", "Lẩu gà lá é Tao Ngộ"],
    badge: "Phổ biến nhất",
    badgeEn: "Most popular",
  },
  {
    id: "danang-hoian",
    title: "Đà Nẵng – Hội An biển & phố cổ 4N3Đ",
    titleEn: "Da Nang – Hoi An Coast & Old Town 4D3N",
    destination: "Đà Nẵng - Hội An",
    region: "Miền Trung",
    regionEn: "Central Vietnam",
    image: "/images/tpl-hoian.jpg",
    imageAlt: "Phố cổ Hội An rực rỡ đèn lồng bên sông Thu Bồn lúc hoàng hôn",
    imageAltEn: "Hoi An Ancient Town glowing with lanterns along Thu Bon river at dusk",
    durationLabel: "4 ngày 3 đêm",
    durationLabelEn: "4 days 3 nights",
    daysCount: 4,
    groupSize: 8,
    budgetPerPerson: 3800000,
    transport: "ô tô / taxi nhóm",
    interests: ["Ẩm thực địa phương", "Check-in thiên nhiên", "Đi dạo nhẹ nhàng"],
    constraints: ["Ít di chuyển xa"],
    extraNote: "Kết hợp tắm biển Mỹ Khê buổi sáng và dạo phố cổ Hội An buổi tối.",
    summary:
      "Cân bằng giữa biển, ẩm thực miền Trung và đi bộ phố cổ không bị mệt.",
    summaryEn:
      "Balanced mix of beach mornings, Central Vietnamese cuisine, and lantern-lit Old Town walks.",
    highlights: ["Bán đảo Sơn Trà", "Phố cổ Hội An", "Chợ đêm & cao lầu"],
    badge: "Nhóm đông 6–10 người",
    badgeEn: "Groups 6–10",
  },
  {
    id: "phuquoc-sea",
    title: "Phú Quốc nghỉ dưỡng & hoàng hôn 3N2Đ",
    titleEn: "Phu Quoc Island Escape & Sunsets 3D2N",
    destination: "Phú Quốc",
    region: "Miền Nam",
    regionEn: "Southern Vietnam",
    image: "/images/tpl-phuquoc.jpg",
    imageAlt: "Biển xanh cát vàng và hàng dừa đón hoàng hôn tại đảo Phú Quốc",
    imageAltEn: "Turquoise sea, golden sand beach, and palms at sunset in Phu Quoc",
    durationLabel: "3 ngày 2 đêm",
    durationLabelEn: "3 days 2 nights",
    daysCount: 3,
    groupSize: 5,
    budgetPerPerson: 4500000,
    transport: "ô tô / taxi nhóm",
    interests: ["Check-in thiên nhiên", "Ẩm thực địa phương", "Đi dạo nhẹ nhàng"],
    constraints: ["Ít di chuyển xa", "Không đi đêm muộn"],
    extraNote: "Dành buổi chiều ngắm hoàng hôn bãi biển và ăn hải sản làng chài.",
    summary:
      "Nhịp đi thư giãn, tối ưu giờ mở cửa quán hải sản và điểm ngắm hoàng hôn.",
    summaryEn:
      "Relaxed island pace timed around seafood market hours and golden-hour viewpoints.",
    highlights: ["Bãi Sao", "Làng chài Hàm Ninh", "Sunset Sanato"],
    badge: "Nghỉ dưỡng",
    badgeEn: "Beach retreat",
  },
  {
    id: "sapa-mountain",
    title: "Sa Pa trekking nhẹ & bản làng 3N2Đ",
    titleEn: "Sa Pa Soft Trekking & Valleys 3D2N",
    destination: "Sa Pa",
    region: "Tây Bắc",
    regionEn: "Northwest",
    image: "/images/tpl-sapa.jpg",
    imageAlt: "Ruộng bậc thang xanh mướt và núi mây tại Sa Pa, Việt Nam",
    imageAltEn: "Emerald terraced rice fields and misty peaks in Sa Pa, Vietnam",
    durationLabel: "3 ngày 2 đêm",
    durationLabelEn: "3 days 2 nights",
    daysCount: 3,
    groupSize: 6,
    budgetPerPerson: 3000000,
    transport: "ô tô / taxi nhóm",
    interests: ["Săn mây sáng sớm", "Check-in thiên nhiên", "Ẩm thực địa phương"],
    constraints: ["Ưu tiên quán mở sớm", "Có người ăn chay"],
    extraNote: "Có lựa chọn món chay ở mỗi bữa và tránh leo dốc quá gắt.",
    summary:
      "Phù hợp nhóm thích không khí núi cao, săn mây Fansipan và ẩm thực Tây Bắc.",
    summaryEn:
      "Ideal for highland air, misty valley viewpoints, and Northwest dishes with vegetarian options.",
    highlights: ["Bản Cát Cát", "Đèo Ô Quy Hồ", "Cà phê view thung lũng"],
    badge: "Núi rừng",
    badgeEn: "Highlands",
  },
];

export function getTripTemplateById(id: string | null): TripTemplate | undefined {
  if (!id) return undefined;
  return TRIP_TEMPLATES.find((t) => t.id === id);
}
