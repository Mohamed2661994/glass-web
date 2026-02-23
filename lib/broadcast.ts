/**
 * Simple broadcast utility using BroadcastChannel API
 * Used to notify other tabs/pages about data changes
 */

const CHANNEL_NAME = "glass_system_updates";

export type UpdateEvent =
  | "invoice_created"
  | "invoice_updated"
  | "invoice_deleted"
  | "transfer_created";

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (!("BroadcastChannel" in window)) return null;
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL_NAME);
  }
  return channel;
}

/** Broadcast an update event to all other tabs */
export function broadcastUpdate(event: UpdateEvent) {
  const ch = getChannel();
  if (ch) {
    ch.postMessage({ type: event, timestamp: Date.now() });
  }
  // Also dispatch a local custom event for same-tab listeners
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("glass_update", { detail: { type: event } }),
    );
    // Invalidate product caches so they refetch on next mount
    try {
      localStorage.setItem(
        "products_cache_invalidated_at",
        Date.now().toString(),
      );
    } catch {}
  }
}

/** Listen for update events from other tabs and same tab */
export function onUpdate(
  events: UpdateEvent[],
  callback: (event: UpdateEvent) => void,
): () => void {
  const ch = getChannel();

  const handleBroadcast = (e: MessageEvent) => {
    if (events.includes(e.data?.type)) {
      callback(e.data.type);
    }
  };

  const handleLocal = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (events.includes(detail?.type)) {
      callback(detail.type);
    }
  };

  if (ch) {
    ch.addEventListener("message", handleBroadcast);
  }
  window.addEventListener("glass_update", handleLocal);

  // Return cleanup function
  return () => {
    if (ch) {
      ch.removeEventListener("message", handleBroadcast);
    }
    window.removeEventListener("glass_update", handleLocal);
  };
}
