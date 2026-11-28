import type { MemberRole } from "./types";

const STORAGE_KEY = "partaway:v1:sessions";

export interface StoredTripSession {
  tripId: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  token: string;
  memberId: string;
  displayName: string;
  role: MemberRole;
  inviteCode: string;
  updatedAt: string;
}

let sessionCache: Record<string, StoredTripSession> | null = null;

function readAll(): Record<string, StoredTripSession> {
  if (typeof window === "undefined") return {};
  if (sessionCache) return sessionCache;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      sessionCache = {};
      return sessionCache;
    }
    const parsed = JSON.parse(raw) as Record<string, StoredTripSession>;
    sessionCache = parsed && typeof parsed === "object" ? parsed : {};
    return sessionCache;
  } catch {
    sessionCache = {};
    return sessionCache;
  }
}

function writeAll(next: Record<string, StoredTripSession>): void {
  sessionCache = next;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors in restricted browsing contexts.
  }
}

export function listSavedTrips(): StoredTripSession[] {
  const map = readAll();
  return Object.values(map).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}

export function getTripSession(tripId: string): StoredTripSession | null {
  const map = readAll();
  return map[tripId] ?? null;
}

export function saveTripSession(session: StoredTripSession): void {
  const map = readAll();
  writeAll({
    ...map,
    [session.tripId]: session,
  });
}

export function removeTripSession(tripId: string): void {
  const map = readAll();
  if (!(tripId in map)) return;
  const copy = { ...map };
  delete copy[tripId];
  writeAll(copy);
}

export function ensureDemoSession(role: MemberRole = "leader"): StoredTripSession {
  const isLeader = role === "leader";
  const session: StoredTripSession = {
    tripId: "demo-dalat-3n2d",
    title: "Đà Lạt 3N2Đ — Nhóm bạn thân",
    destination: "Đà Lạt",
    startDate: "2026-12-18",
    endDate: "2026-12-20",
    token: isLeader ? "demo-token-leader-duc" : "demo-token-member-phuc",
    memberId: isLeader ? "mem_duc" : "mem_phuc",
    displayName: isLeader ? "Đức" : "Phúc",
    role,
    inviteCode: "dalat3n2d0",
    updatedAt: new Date().toISOString(),
  };
  saveTripSession(session);
  return session;
}
