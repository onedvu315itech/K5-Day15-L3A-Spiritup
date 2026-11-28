const vndFormatter = new Intl.NumberFormat("vi-VN");

const shortDateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatVnd(amount: number | null | undefined): string {
  if (amount == null) return "Chưa đặt";
  if (amount === 0) return "Miễn phí";
  return `${vndFormatter.format(amount)}\u00A0đ`;
}

/** Giá một mục trong plan: giá null nghĩa là kho chưa có giá. */
export function formatItemCost(item: {
  cost_per_person: number | null;
  price_unverified?: boolean;
}): string {
  if (item.cost_per_person == null) return "Chưa rõ giá";
  const text = formatVnd(item.cost_per_person);
  return item.price_unverified ? `${text} (chưa xác minh)` : text;
}

export function formatSignedVnd(delta: number): string {
  if (delta === 0) return "Không đổi chi phí";
  const sign = delta > 0 ? "+" : "-";
  return `${sign}${vndFormatter.format(Math.abs(delta))}\u00A0đ/người`;
}

export function formatDate(isoDate: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return shortDateFormatter.format(parsed);
}

export function formatDateTime(isoTimestamp: string): string {
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) return isoTimestamp;
  return dateTimeFormatter.format(parsed);
}

export function formatDurationMinutes(minutes: number): string {
  if (minutes <= 0) return "0 phút";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} phút`;
  if (mins === 0) return `${hours} giờ`;
  return `${hours} giờ ${mins} phút`;
}
