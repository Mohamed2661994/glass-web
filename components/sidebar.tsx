"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  FileText,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowLeftRight,
  Truck,
  CalendarDays,
  Wallet,
  List,
  BookOpen,
  ChevronDown,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type RouteItem = {
  label: string;
  icon: LucideIcon;
  href: string;
};

type RouteGroup = {
  label: string;
  icon: LucideIcon;
  children: RouteItem[];
};

type SidebarEntry = RouteItem | RouteGroup;

const isGroup = (entry: SidebarEntry): entry is RouteGroup =>
  "children" in entry;

interface SidebarProps {
  onExpandChange?: (open: boolean) => void;
  isMobile?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({
  onExpandChange,
  isMobile,
  onNavigate,
}: SidebarProps) {
  const pathname = usePathname();

  const [pinned, setPinned] = useState(false);
  const [branchId, setBranchId] = useState<number | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const sidebarRef = useRef<HTMLElement>(null);

  const open = isMobile ? true : pinned;

  // Close sidebar when clicking outside
  useEffect(() => {
    if (isMobile || !pinned) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        sidebarRef.current &&
        !sidebarRef.current.contains(e.target as Node)
      ) {
        setPinned(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [pinned, isMobile]);

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  useEffect(() => {
    onExpandChange?.(open);
  }, [open, onExpandChange]);

  useEffect(() => {
    const user = localStorage.getItem("user");
    if (user) setBranchId(JSON.parse(user).branch_id);
  }, []);

  // Auto-open cash group if current path is inside /cash
  useEffect(() => {
    if (pathname.startsWith("/cash")) {
      setOpenGroups((prev) => ({ ...prev, الخزنة: true }));
    }
  }, [pathname]);

  const cashGroup: RouteGroup = {
    label: "الخزنة",
    icon: Wallet,
    children: [
      { label: "صرف نقدي", icon: Wallet, href: "/cash/out" },
      { label: "عرض المنصرف", icon: List, href: "/cash/out/list" },
      { label: "وارد الخزنة", icon: Wallet, href: "/cash/in" },
      { label: "عرض الوارد", icon: List, href: "/cash/in/list" },
      { label: "اليومية", icon: BookOpen, href: "/cash/summary" },
    ],
  };

  const routes: SidebarEntry[] = [
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
          {
            label: "إنشاء فاتورة جملة",
            icon: FileText,
            href: "/invoices/create/wholesale",
          },
          cashGroup,
        ]
      : branchId === 2
        ? [
            {
              label: "إنشاء فاتورة جملة",
              icon: FileText,
              href: "/invoices/create/wholesale",
            },
            {
              label: "استبدال مصنع",
              icon: ArrowLeftRight,
              href: "/replace",
            },
            {
              label: "تحويل للمعرض",
              icon: Truck,
              href: "/stock-transfer",
            },
            {
              label: "تحويلات حسب التاريخ",
              icon: CalendarDays,
              href: "/transfers/by-date",
            },
            cashGroup,
          ]
        : []),
  ];

  return (
    <aside
      ref={sidebarRef}
      className={cn(
        "h-screen flex-col border-l bg-background transition-all duration-300",
        isMobile ? "flex w-64" : "hidden lg:flex",
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
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {routes.map((entry) => {
          if (isGroup(entry)) {
            const groupOpen = openGroups[entry.label] ?? false;
            const GroupIcon = entry.icon;
            const hasActiveChild = entry.children.some(
              (c) => pathname === c.href,
            );

            return (
              <div key={entry.label}>
                {/* Group header */}
                <button
                  onClick={() => {
                    if (!open) {
                      setPinned(true);
                      setOpenGroups((prev) => ({
                        ...prev,
                        [entry.label]: true,
                      }));
                    } else {
                      toggleGroup(entry.label);
                    }
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-2 py-2 text-sm transition-colors w-full",
                    hasActiveChild
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <div className="w-8 flex justify-center">
                    <GroupIcon className="h-5 w-5" />
                  </div>

                  {open && (
                    <>
                      <span className="mr-2 whitespace-nowrap flex-1 text-right">
                        {entry.label}
                      </span>
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 transition-transform duration-200",
                          groupOpen && "rotate-180",
                        )}
                      />
                    </>
                  )}
                </button>

                {/* Group children */}
                {open && groupOpen && (
                  <div className="mr-6 mt-1 space-y-1 border-r pr-2">
                    {entry.children.map((child) => {
                      const ChildIcon = child.icon;
                      const isActive = pathname === child.href;

                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={onNavigate}
                          className={cn(
                            "flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm transition-colors",
                            isActive
                              ? "bg-muted text-foreground"
                              : "text-muted-foreground hover:bg-muted",
                          )}
                        >
                          <div className="w-6 flex justify-center">
                            <ChildIcon className="h-4 w-4" />
                          </div>
                          <span className="whitespace-nowrap">
                            {child.label}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          // Regular route item
          const Icon = entry.icon;
          const isActive = pathname === entry.href;

          return (
            <Link
              key={entry.href}
              href={entry.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-xl px-2 py-2 text-sm transition-colors",
                isActive
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              <div className="w-8 flex justify-center">
                <Icon className="h-5 w-5" />
              </div>

              {open && (
                <span className="mr-2 whitespace-nowrap">{entry.label}</span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
