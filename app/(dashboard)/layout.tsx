"use client";

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Sidebar } from "@/components/sidebar";
import { MobileSidebar } from "@/components/mobile-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/app/context/auth-context";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { NotificationBell } from "@/components/notification-bell";
import { CashCounterModal } from "@/components/cash-counter-modal";
import { ProductFormDialog } from "@/components/product-form-dialog";
import { ProductLookupModal } from "@/components/product-lookup-modal";
import { ChatDrawer } from "@/components/chat-drawer";
import { PullToRefresh } from "@/components/pull-to-refresh";
import api, { API_URL } from "@/services/api";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { prefs } = useUserPreferences();
  const router = useRouter();
  const { setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [lookupOpen, setLookupOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  // F4 → open add product dialog, F1 → open product lookup
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "F4") {
        e.preventDefault();
        setProductDialogOpen(true);
      }
      if (e.key === "F1") {
        e.preventDefault();
        setLookupOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // استعادة ثيم اليوزر عند الدخول (only once on mount, not on prefs change)
  const themeRestoredRef = useRef(false);
  useEffect(() => {
    if (user?.id && !themeRestoredRef.current) {
      themeRestoredRef.current = true;
      const savedTheme =
        prefs.theme || localStorage.getItem(`theme_user_${user.id}`);
      if (savedTheme) {
        setTheme(savedTheme);
        document.documentElement.classList.remove("light", "dark");
        document.documentElement.classList.add(savedTheme);
      }
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply saved custom colors after theme is set
  useEffect(() => {
    if (!user?.id) return;
    const savedColors = prefs.customColors;
    if (!savedColors) return;
    const mode = document.documentElement.classList.contains("dark")
      ? "dark"
      : "light";
    const colors = savedColors[mode];
    if (!colors) return;
    const cssVarMap: Record<string, string> = {
      background: "--background",
      foreground: "--foreground",
      card: "--card",
      cardForeground: "--card-foreground",
      primary: "--primary",
      primaryForeground: "--primary-foreground",
      secondary: "--secondary",
      muted: "--muted",
      mutedForeground: "--muted-foreground",
      border: "--border",
      accent: "--accent",
      destructive: "--destructive",
    };
    for (const [key, cssVar] of Object.entries(cssVarMap)) {
      const val = (colors as Record<string, string | undefined>)[key];
      if (val) document.documentElement.style.setProperty(cssVar, val);
    }

    // Inject semantic number color overrides
    const semanticRules: string[] = [];
    if (colors.success) {
      const c = colors.success;
      semanticRules.push(
        `.text-green-600, .text-green-500, .text-green-400, .text-green-700, .text-emerald-600, .text-emerald-500, .text-emerald-400, .dark\\:text-green-400, .dark\\:text-green-300, .dark\\:text-green-500, .dark\\:text-emerald-400, .dark\\:text-emerald-300 { color: ${c} !important; }`,
      );
      semanticRules.push(
        `.bg-green-100, .bg-green-50, .bg-emerald-100, .bg-emerald-50, .bg-green-600, .dark\\:bg-green-900, .dark\\:bg-green-900\\/30, .dark\\:bg-green-950\\/20, .dark\\:bg-green-950\\/30 { background-color: color-mix(in srgb, ${c} 15%, transparent) !important; }`,
      );
      semanticRules.push(
        `.bg-green-500\\/10, .bg-emerald-500\\/10, .dark\\:bg-green-500\\/15 { background-color: color-mix(in srgb, ${c} 10%, transparent) !important; }`,
      );
      semanticRules.push(
        `.bg-green-500\\/5, .bg-emerald-500\\/5, .dark\\:bg-green-500\\/5 { background-color: color-mix(in srgb, ${c} 5%, transparent) !important; }`,
      );
      semanticRules.push(
        `.bg-green-500\\/15, .dark\\:bg-green-500\\/15 { background-color: color-mix(in srgb, ${c} 15%, transparent) !important; }`,
      );
      semanticRules.push(
        `.bg-green-900\\/30, .bg-green-950\\/20, .bg-green-950\\/30 { background-color: color-mix(in srgb, ${c} 20%, transparent) !important; }`,
      );
      semanticRules.push(
        `.border-green-200, .border-emerald-200, .border-green-500\\/20, .border-emerald-500\\/20, .border-green-500, .dark\\:border-green-800 { border-color: color-mix(in srgb, ${c} 30%, transparent) !important; }`,
      );
    }
    if (colors.danger) {
      const c = colors.danger;
      semanticRules.push(
        `.text-red-600, .text-red-500, .text-red-400, .text-red-700, .text-rose-600, .text-rose-500, .text-rose-400, .text-rose-700, .dark\\:text-red-400, .dark\\:text-red-300, .dark\\:text-red-500, .dark\\:text-rose-400, .dark\\:text-rose-300 { color: ${c} !important; }`,
      );
      semanticRules.push(
        `.bg-red-100, .bg-red-50, .bg-rose-100, .bg-rose-50, .dark\\:bg-red-900, .dark\\:bg-red-900\\/20, .dark\\:bg-red-900\\/30, .dark\\:bg-red-950\\/10, .dark\\:bg-red-950\\/20, .dark\\:bg-red-950\\/30, .dark\\:bg-rose-900 { background-color: color-mix(in srgb, ${c} 15%, transparent) !important; }`,
      );
      semanticRules.push(
        `.bg-red-500\\/10, .bg-rose-500\\/10, .dark\\:bg-red-500\\/15 { background-color: color-mix(in srgb, ${c} 10%, transparent) !important; }`,
      );
      semanticRules.push(
        `.bg-red-500\\/5, .bg-rose-500\\/5 { background-color: color-mix(in srgb, ${c} 5%, transparent) !important; }`,
      );
      semanticRules.push(
        `.bg-red-500\\/15, .dark\\:bg-red-500\\/15 { background-color: color-mix(in srgb, ${c} 15%, transparent) !important; }`,
      );
      semanticRules.push(
        `.bg-red-900\\/30, .bg-red-900\\/20, .bg-red-950\\/20, .bg-red-950\\/30, .bg-red-950\\/10, .bg-red-50\\/50, .dark\\:bg-red-50\\/50 { background-color: color-mix(in srgb, ${c} 20%, transparent) !important; }`,
      );
      semanticRules.push(
        `.border-red-200, .border-rose-200, .border-red-500, .border-red-500\\/20, .dark\\:border-red-800, .dark\\:border-rose-800 { border-color: color-mix(in srgb, ${c} 30%, transparent) !important; }`,
      );
    }
    if (colors.info) {
      const c = colors.info;
      semanticRules.push(
        `.text-blue-600, .text-blue-500, .text-blue-400, .text-blue-700, .dark\\:text-blue-400, .dark\\:text-blue-300, .dark\\:text-blue-500 { color: ${c} !important; }`,
      );
      semanticRules.push(
        `.bg-blue-100, .bg-blue-50, .dark\\:bg-blue-900, .dark\\:bg-blue-900\\/30, .dark\\:bg-blue-900\\/40, .dark\\:bg-blue-950\\/20, .dark\\:bg-blue-950\\/30, .dark\\:bg-blue-950\\/60 { background-color: color-mix(in srgb, ${c} 15%, transparent) !important; }`,
      );
      semanticRules.push(
        `.bg-blue-500\\/10, .dark\\:bg-blue-500\\/10 { background-color: color-mix(in srgb, ${c} 10%, transparent) !important; }`,
      );
      semanticRules.push(
        `.bg-blue-500\\/15, .dark\\:bg-blue-500\\/15 { background-color: color-mix(in srgb, ${c} 15%, transparent) !important; }`,
      );
      semanticRules.push(
        `.border-blue-200, .border-blue-500\\/20, .border-blue-800, .border-blue-900, .dark\\:border-blue-800 { border-color: color-mix(in srgb, ${c} 30%, transparent) !important; }`,
      );
    }
    if (colors.warning) {
      const c = colors.warning;
      semanticRules.push(
        `.text-amber-600, .text-amber-500, .text-orange-600, .text-orange-500, .text-orange-400, .text-yellow-700, .text-yellow-600, .text-yellow-500, .dark\\:text-amber-400, .dark\\:text-orange-400, .dark\\:text-yellow-400, .dark\\:text-yellow-500 { color: ${c} !important; }`,
      );
      semanticRules.push(
        `.bg-amber-100, .bg-amber-50, .bg-orange-100, .bg-orange-50, .bg-yellow-100, .bg-yellow-50, .dark\\:bg-orange-900\\/30, .dark\\:bg-orange-950\\/20, .dark\\:bg-amber-900, .dark\\:bg-amber-900\\/30 { background-color: color-mix(in srgb, ${c} 15%, transparent) !important; }`,
      );
      semanticRules.push(
        `.bg-amber-500\\/10, .bg-orange-500\\/10, .dark\\:bg-amber-500\\/10, .dark\\:bg-orange-500\\/10 { background-color: color-mix(in srgb, ${c} 10%, transparent) !important; }`,
      );
      semanticRules.push(
        `.bg-orange-900\\/30, .bg-orange-950\\/20 { background-color: color-mix(in srgb, ${c} 20%, transparent) !important; }`,
      );
      semanticRules.push(
        `.border-amber-200, .border-orange-200, .border-yellow-200, .border-amber-500\\/20, .border-orange-500\\/20, .dark\\:border-orange-800, .dark\\:border-amber-800 { border-color: color-mix(in srgb, ${c} 30%, transparent) !important; }`,
      );
    }
    let styleEl = document.getElementById(
      "semantic-color-overrides",
    ) as HTMLStyleElement | null;
    if (semanticRules.length > 0) {
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = "semantic-color-overrides";
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = semanticRules.join("\n");
    } else {
      styleEl?.remove();
    }
  }, [user?.id, prefs.customColors]); // eslint-disable-line react-hooks/exhaustive-deps

  // ✅ لو مفيش توكن → يروح لصفحة الدخول
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
    }
  }, [router]);

  // 🔔 Push notification subscription
  useEffect(() => {
    if (!user?.id) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const subscribeToPush = async () => {
      try {
        // Request notification permission
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;

        const registration = await navigator.serviceWorker.ready;

        // Get VAPID public key from backend
        const { data: vapidData } = await api.get("/push/vapid-key");
        const publicKey = vapidData.publicKey;

        // Convert VAPID key to Uint8Array
        const urlBase64ToUint8Array = (base64String: string) => {
          const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
          const base64 = (base64String + padding)
            .replace(/-/g, "+")
            .replace(/_/g, "/");
          const rawData = window.atob(base64);
          const outputArray = new Uint8Array(rawData.length);
          for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
          }
          return outputArray;
        };

        // Check for existing subscription
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          });
        }

        // Send subscription to backend
        const subJSON = subscription.toJSON();
        await api.post("/push/subscribe", {
          endpoint: subJSON.endpoint,
          keys: subJSON.keys,
        });
      } catch (err) {
        console.error("Push subscription error:", err);
      }
    };

    subscribeToPush();
  }, [user?.id]);

  const branchName =
    user?.branch_id === 1
      ? "فرع القطاعي"
      : user?.branch_id === 2
        ? "فرع الجملة"
        : "النظام";

  return (
    <div className="h-dvh flex bg-background overflow-hidden print:h-auto print:overflow-visible">
      {/* Sidebar */}
      <div className="print:hidden">
        <Sidebar onExpandChange={setSidebarOpen} />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* ===== HEADER FULL WIDTH ===== */}
        <header className="h-16 border-b bg-background/80 relative print:hidden">
          <div className="absolute inset-0 backdrop-blur-md pointer-events-none" />

          <div className="relative flex items-center justify-between px-2 sm:px-6 h-full">
            {/* LEFT */}
            <div className="flex items-center gap-1 sm:gap-3 shrink-0">
              <MobileSidebar />
            </div>

            {/* CENTER - Name + Branch */}
            <div
              className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center cursor-pointer select-none max-w-[45%]"
              onClick={() => router.push("/")}
              title="الرجوع للوحة التحكم"
            >
              <span className="text-sm sm:text-base font-bold truncate max-w-full">
                {user?.full_name || user?.username}
              </span>
              <span className="text-[10px] sm:text-xs text-muted-foreground leading-tight">
                {branchName}
              </span>
            </div>

            {/* RIGHT */}
            <div className="flex items-center gap-1 sm:gap-4 shrink-0">
              {mounted && user?.id && (
                <ChatDrawer userId={user.id} branchId={user.branch_id} />
              )}

              {mounted && user?.id && user?.branch_id === 2 && (
                <NotificationBell userId={user.id} branchId={user.branch_id} />
              )}

              <CashCounterModal />
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* ===== CONTENT ONLY ===== */}
        <main className="flex-1 min-h-0 overflow-hidden print:py-0">
          <PullToRefresh className="h-full overflow-y-auto scrollbar-hide">
            <div className="w-full px-4 py-6 print:px-0 print:py-0">
              {children}
            </div>
          </PullToRefresh>
        </main>
      </div>

      {/* F4 Add Product Dialog */}
      <ProductFormDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        onSuccess={() => setProductDialogOpen(false)}
      />

      {/* F1 Product Lookup Modal */}
      <ProductLookupModal
        open={lookupOpen}
        onOpenChange={setLookupOpen}
        branchId={user?.branch_id || 1}
      />
    </div>
  );
}
