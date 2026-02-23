"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/app/context/auth-context";
import api from "@/services/api";

/* ─────────────── types ─────────────── */

export interface DashboardWidgetPref {
  id: string;
  visible: boolean;
  order: number;
  size: "full" | "half";
}

export interface QuickLinkPref {
  id: string;
  label: string;
  href: string;
  icon: string;
  color: string;
}

export interface SidebarPref {
  pinned: boolean;
  openGroups: Record<string, boolean>;
}

export interface ChatPrefs {
  myBubbleColor?: string; // hex color for my messages
  otherBubbleColor?: string; // hex color for other's messages
  notificationSound?: string; // sound file name or /uploads/sounds/... path
  customSoundName?: string; // display name for custom uploaded sound
}

export interface CustomColors {
  background?: string;
  foreground?: string;
  card?: string;
  cardForeground?: string;
  primary?: string;
  primaryForeground?: string;
  secondary?: string;
  muted?: string;
  mutedForeground?: string;
  border?: string;
  accent?: string;
  destructive?: string;
  /* Semantic number colors */
  success?: string; // green numbers (positive, income, in-stock)
  danger?: string; // red numbers (negative, expenses, out-of-stock)
  info?: string; // blue numbers (links, edit icons, info)
  warning?: string; // amber/orange numbers (prices, warnings)
}

export interface UserPreferences {
  dashboard_widgets?: DashboardWidgetPref[];
  quick_links?: QuickLinkPref[];
  sidebar?: SidebarPref;
  theme?: string;
  chat?: ChatPrefs;
  customColors?: { light?: CustomColors; dark?: CustomColors };
  dash_invoice_view?: "table" | "compact" | "cards";
  dash_transfer_view?: "table" | "cards";
  products_view?: "cards" | "compact" | "table" | "split";
  /** Any future per-user preferences can be added here */
  [key: string]: unknown;
}

/* ─────────── local storage keys ─────────── */
const PREFS_KEY = (uid: number) => `user_prefs_${uid}`;

/* ─── debounce helper ─── */
function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
  };
  return debounced;
}

/* ────────────────────────────────────────────
   Hook: useUserPreferences
   - Reads from localStorage keyed by user.id
   - Tries to load from backend on first mount
   - Saves to localStorage immediately + debounced save to backend
   ──────────────────────────────────────────── */

export function useUserPreferences() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [prefs, setPrefsState] = useState<UserPreferences>({});
  const [loaded, setLoaded] = useState(false);
  const syncRef = useRef<ReturnType<typeof debounce> | null>(null);

  /* ── Load preferences (localStorage first, then try backend) ── */
  useEffect(() => {
    if (!userId) return;

    // 1. Load from localStorage immediately
    try {
      const raw = localStorage.getItem(PREFS_KEY(userId));
      if (raw) {
        const parsed = JSON.parse(raw) as UserPreferences;
        setPrefsState(parsed);
      }
    } catch {
      // ignore
    }

    // 2. Also migrate old keys (backward compat)
    migrateOldKeys(userId, setPrefsState);

    // 3. Try to load from backend (takes priority if available)
    (async () => {
      try {
        const { data } = await api.get("/user/preferences");
        if (data && typeof data === "object" && Object.keys(data).length > 0) {
          const serverPrefs = data as UserPreferences;
          setPrefsState((prev) => {
            const merged = { ...prev, ...serverPrefs };
            localStorage.setItem(PREFS_KEY(userId), JSON.stringify(merged));
            return merged;
          });
        }
      } catch {
        // Backend doesn't support preferences yet — that's fine
      } finally {
        setLoaded(true);
      }
    })();
  }, [userId]);

  /* ── Debounced sync to backend ── */
  useEffect(() => {
    syncRef.current = debounce(async (...args: unknown[]) => {
      const prefsToSave = args[0] as UserPreferences;
      try {
        await api.put("/user/preferences", prefsToSave);
      } catch {
        // Backend doesn't support it yet — silently fail
      }
    }, 2000);

    return () => syncRef.current?.cancel();
  }, []);

  /* ── Save helper ── */
  const setPrefs = useCallback(
    (
      updater: UserPreferences | ((prev: UserPreferences) => UserPreferences),
    ) => {
      if (!userId) return;

      setPrefsState((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;

        // Save to localStorage immediately
        localStorage.setItem(PREFS_KEY(userId), JSON.stringify(next));

        // Debounced sync to backend
        syncRef.current?.(next);

        return next;
      });
    },
    [userId],
  );

  /* ── Convenience setters ── */

  const setDashboardWidgets = useCallback(
    (widgets: DashboardWidgetPref[]) => {
      setPrefs((prev) => ({ ...prev, dashboard_widgets: widgets }));
    },
    [setPrefs],
  );

  const setQuickLinks = useCallback(
    (links: QuickLinkPref[]) => {
      setPrefs((prev) => ({ ...prev, quick_links: links }));
    },
    [setPrefs],
  );

  const setSidebar = useCallback(
    (sidebar: SidebarPref | ((prev: SidebarPref) => SidebarPref)) => {
      setPrefs((prev) => {
        const current = prev.sidebar ?? { pinned: false, openGroups: {} };
        const next = typeof sidebar === "function" ? sidebar(current) : sidebar;
        return { ...prev, sidebar: next };
      });
    },
    [setPrefs],
  );

  const setThemePref = useCallback(
    (theme: string) => {
      setPrefs((prev) => ({ ...prev, theme }));
    },
    [setPrefs],
  );

  const setDashInvoiceView = useCallback(
    (dash_invoice_view: "table" | "compact" | "cards") => {
      setPrefs((prev) => ({ ...prev, dash_invoice_view }));
    },
    [setPrefs],
  );

  const setProductsView = useCallback(
    (products_view: "cards" | "compact" | "table" | "split") => {
      setPrefs((prev) => ({ ...prev, products_view }));
    },
    [setPrefs],
  );

  const setDashTransferView = useCallback(
    (dash_transfer_view: "table" | "cards") => {
      setPrefs((prev) => ({ ...prev, dash_transfer_view }));
    },
    [setPrefs],
  );

  return {
    prefs,
    loaded,
    setPrefs,
    setDashboardWidgets,
    setQuickLinks,
    setSidebar,
    setThemePref,
    setDashInvoiceView,
    setProductsView,
    setDashTransferView,
  };
}

/* ────── Migrate old localStorage keys to new system ────── */
function migrateOldKeys(
  userId: number,
  setPrefsState: React.Dispatch<React.SetStateAction<UserPreferences>>,
) {
  try {
    let migrated = false;
    const updates: Partial<UserPreferences> = {};

    // Old dashboard config
    const oldDashboard = localStorage.getItem(`dashboard_config_${userId}`);
    if (oldDashboard) {
      updates.dashboard_widgets = JSON.parse(oldDashboard);
      migrated = true;
    }

    // Old quick links
    const oldLinks = localStorage.getItem(`quick_links_${userId}`);
    if (oldLinks) {
      updates.quick_links = JSON.parse(oldLinks);
      migrated = true;
    }

    // Old theme
    const oldTheme = localStorage.getItem(`theme_user_${userId}`);
    if (oldTheme) {
      updates.theme = oldTheme;
      migrated = true;
    }

    // Old view modes (device-local → synced)
    const oldDashView = localStorage.getItem("dash_invoice_view");
    if (oldDashView) {
      updates.dash_invoice_view = oldDashView as "table" | "compact" | "cards";
      migrated = true;
    }
    const oldProductsView = localStorage.getItem("products_view");
    if (oldProductsView) {
      updates.products_view = oldProductsView as "cards" | "compact" | "table" | "split";
      migrated = true;
    }

    if (migrated) {
      setPrefsState((prev) => {
        const merged = { ...prev, ...updates };
        localStorage.setItem(PREFS_KEY(userId), JSON.stringify(merged));
        return merged;
      });

      // Clean up old keys (optional - keeps things tidy)
      // We keep them for now for backward compatibility
    }
  } catch {
    // ignore migration errors
  }
}
