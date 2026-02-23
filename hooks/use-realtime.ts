"use client";

import { useEffect, useRef } from "react";
import { useSocket } from "@/app/context/socket-context";

/**
 * Re-fetch data when a real-time event fires on the given channel(s).
 *
 * @param channels  One or more data channels, e.g. "data:invoices"
 * @param refetch   The function to call when an event arrives
 * @param debounceMs  Debounce window (default 500ms) to avoid rapid re-fetches
 */
export function useRealtime(
  channels: string | string[],
  refetch: () => void,
  debounceMs = 500,
) {
  const { on } = useSocket();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refetchRef = useRef(refetch);
  refetchRef.current = refetch;

  useEffect(() => {
    const list = Array.isArray(channels) ? channels : [channels];

    const unsubs = list.map((ch) =>
      on(ch, () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          refetchRef.current();
        }, debounceMs);
      }),
    );

    return () => {
      unsubs.forEach((u) => u());
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [channels, on, debounceMs]);
}
