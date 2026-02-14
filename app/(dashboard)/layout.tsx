"use client";

import { ReactNode, useEffect, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { MobileSidebar } from "@/components/mobile-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/app/context/auth-context";
import { NotificationBell } from "@/components/notification-bell";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

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

          <div className="relative flex items-center justify-between px-6 h-full">
            {/* LEFT */}
            <div className="flex items-center gap-3">
              <MobileSidebar />
              <div>
                <h1 className="text-lg font-semibold">Dashboard</h1>
                <span className="text-xs text-muted-foreground">
                  {branchName}
                </span>
              </div>
            </div>

            {/* CENTER - Username */}
            <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
              <span className="text-base font-bold">{user?.username}</span>
            </div>

            {/* RIGHT */}
            <div className="flex items-center gap-4">
              {mounted && user?.id && user?.branch_id === 2 && (
                <NotificationBell userId={user.id} branchId={user.branch_id} />
              )}

              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* ===== CONTENT ONLY ===== */}
        <main className="flex-1 overflow-auto scrollbar-hide py-6 print:py-0">
          <div className="w-full px-4 print:px-0">{children}</div>
        </main>
      </div>
    </div>
  );
}
