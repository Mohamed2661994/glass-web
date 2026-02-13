"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  FileText,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  onExpandChange?: (open: boolean) => void;
}

export function Sidebar({ onExpandChange }: SidebarProps) {
  const pathname = usePathname();

  const [pinned, setPinned] = useState(false);
  const [branchId, setBranchId] = useState<number | null>(null);

  const open = pinned;

  useEffect(() => {
    onExpandChange?.(open);
  }, [open, onExpandChange]);

  useEffect(() => {
    const user = localStorage.getItem("user");
    if (user) setBranchId(JSON.parse(user).branch_id);
  }, []);

  const routes = [
    { label: "Dashboard", icon: LayoutDashboard, href: "/" },
    { label: "الاصناف", icon: Package, href: "/products" },
    { label: "قائمة الفواتير", icon: FileText, href: "/invoices" },
    ...(branchId === 1
      ? [
          {
            label: "إنشاء فاتورة قطاعي",
            icon: FileText,
            href: "/invoices/create/retail",
          },
        ]
      : branchId === 2
        ? [
            {
              label: "إنشاء فاتورة جملة",
              icon: FileText,
              href: "/invoices/create/wholesale",
            },
          ]
        : []),
  ];

  return (
    <aside
      className={cn(
        "hidden lg:flex h-screen flex-col border-l bg-background transition-all duration-300",
        open ? "w-60" : "w-[72px]",
      )}
    >
      {/* Header */}
      <div className="h-16 flex items-center px-3 border-b">
        <button
          onClick={() => setPinned(!pinned)}
          className="p-2 rounded-lg hover:bg-muted"
        >
          {pinned ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <PanelLeftOpen className="h-4 w-4" />
          )}
        </button>

        {open && <span className="mr-2 font-bold text-sm">Glass System</span>}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {routes.map((route) => {
          const Icon = route.icon;
          const isActive = pathname === route.href;

          return (
            <Link
              key={route.href}
              href={route.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-2 py-2 text-sm transition-colors",
                isActive
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              {/* icon */}
              <div className="w-8 flex justify-center">
                <Icon className="h-5 w-5" />
              </div>

              {/* النص يظهر فقط لما يفتح */}
              {open && (
                <span className="mr-2 whitespace-nowrap">{route.label}</span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
