"use client";

import { useEffect, useRef } from "react";
import { api } from "./api";
import type { TripEvent } from "./types";

interface UseTripUpdatesOptions {
  tripId: string;
  token: string | null;
  since: number;
  enabled: boolean;
  onEvents: (events: TripEvent[], lastEventId: number) => void;
}

export function useTripUpdates({
  tripId,
  token,
  since,
  enabled,
  onEvents,
}: UseTripUpdatesOptions): void {
  const sinceRef = useRef(since);
  const onEventsRef = useRef(onEvents);

  useEffect(() => {
    sinceRef.current = since;
  }, [since]);

  useEffect(() => {
    onEventsRef.current = onEvents;
  }, [onEvents]);

  useEffect(() => {
    if (!enabled || !token) return;

    let cancelled = false;

    const poll = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        const res = await api.getUpdates(tripId, token, sinceRef.current);
        if (!cancelled && res.events.length > 0) {
          sinceRef.current = res.last_event_id;
          onEventsRef.current(res.events, res.last_event_id);
        }
      } catch {
        // Silent retry on next 5s interval so polling never interrupts the user.
      }
    };

    const timer = window.setInterval(poll, 5000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void poll();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [tripId, token, enabled]);
}
