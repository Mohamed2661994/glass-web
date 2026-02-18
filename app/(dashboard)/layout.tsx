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

  // ✅ لو مفيش توكن → يروح لصفحة الدخول
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
    }
  }, [router]);

  const branchName =
    user?.branch_id === 1
      ? "فرع القطاعي"
      : user?.branch_id === 2
        ? "فرع الجملة"
        : "النظام";

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <div className="print:hidden">
        <Sidebar onExpandChange={setSidebarOpen} />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
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
        <main className="flex-1 overflow-auto scrollbar-hide print:py-0">
          <PullToRefresh className="h-full overflow-auto scrollbar-hide">
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
