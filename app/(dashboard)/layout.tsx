"use client";

import { ReactNode, useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { MobileSidebar } from "@/components/mobile-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/app/context/auth-context";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const branchName =
    user?.branch_id === 1
      ? "فرع القطاعي"
      : user?.branch_id === 2
        ? "فرع الجملة"
        : "النظام";

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <Sidebar onExpandChange={setSidebarOpen} />

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ===== HEADER FULL WIDTH ===== */}
        <header className="h-16 border-b bg-background/80 backdrop-blur-md flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-4">
            <MobileSidebar />
            <div>
              <h1 className="text-lg font-semibold">Dashboard</h1>
              <span className="text-xs text-muted-foreground">
                {branchName}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-sm text-muted-foreground hidden md:block">
              {user?.username}
            </div>
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={logout}>
              تسجيل خروج
            </Button>
          </div>
        </header>

        {/* ===== CONTENT ONLY ===== */}
        <main className="flex-1 overflow-auto py-6">
          <div
            className="w-full flex justify-center transition-all duration-300"
            style={{
              paddingInlineStart: sidebarOpen ? 240 : 50,
              paddingInlineEnd: 50,
            }}
          >
            {/* 👇 العرض الجديد (أريح بصريًا) */}
            <div className="w-full max-w-[680px] px-4">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
