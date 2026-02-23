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
  BarChart3,
  AlertTriangle,
  Users,
  DollarSign,
  Activity,
  Settings,
  LogOut,
  ClipboardList,
  FilePlus2,
  PackagePlus,
  Factory,
  ShieldOff,
  Store,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/app/context/auth-context";
import { useUserPreferences } from "@/hooks/use-user-preferences";
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
  const { user, logout } = useAuth();
  const { prefs, setSidebar } = useUserPreferences();

  const savedSidebar = prefs.sidebar;
  const [pinned, setPinnedLocal] = useState(false);
  const branchId = user?.branch_id ?? null;
  const isAdmin = user?.role === "admin" || user?.id === 7;
  const [openGroups, setOpenGroupsLocal] = useState<Record<string, boolean>>(
    {},
  );
  const sidebarRef = useRef<HTMLElement>(null);

  const open = isMobile ? true : pinned;

  // Restore saved sidebar state when preferences load
  useEffect(() => {
    if (savedSidebar) {
      if (savedSidebar.pinned !== undefined)
        setPinnedLocal(savedSidebar.pinned);
      // Groups always start closed — user opens them manually
    }
  }, [savedSidebar]);

  // Wrapper to persist pinned state
  const setPinned = useCallback(
    (val: boolean | ((prev: boolean) => boolean)) => {
      setPinnedLocal((prev) => {
        const next = typeof val === "function" ? val(prev) : val;
        setSidebar((s) => ({ ...s, pinned: next }));
        return next;
      });
    },
    [setSidebar],
  );

  // Wrapper to persist open groups
  const setOpenGroups = useCallback(
    (
      updater:
        | Record<string, boolean>
        | ((prev: Record<string, boolean>) => Record<string, boolean>),
    ) => {
      setOpenGroupsLocal((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        setSidebar((s) => ({ ...s, openGroups: next }));
        return next;
      });
    },
    [setSidebar],
  );

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

  // User data now comes from useAuth() context — no localStorage read needed

  // Groups always start closed — no auto-open

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

  const reportsGroup: RouteGroup = {
    label: "التقارير",
    icon: BarChart3,
    children: [
      {
        label: "حركة المخزون",
        icon: Activity,
        href: "/reports/inventory-summary",
      },
      { label: "نقص المخزون", icon: AlertTriangle, href: "/reports/low-stock" },
      {
        label: "قيمة المخزون",
        icon: DollarSign,
        href: "/reports/inventory-value",
      },
      {
        label: "مديونية العملاء",
        icon: Users,
        href: "/reports/customer-balances",
      },
      {
        label: "حركة الأصناف",
        icon: BarChart3,
        href: "/reports/product-movement",
      },
    ],
  };

  const routes: SidebarEntry[] = [
    { label: "لوحة التحكم", icon: LayoutDashboard, href: "/" },
    { label: "الاصناف", icon: Package, href: "/products" },
    { label: "المصانع", icon: Factory, href: "/manufacturers" },
    { label: "العملاء", icon: Users, href: "/customers" },
    { label: "الموردين", icon: Store, href: "/suppliers" },
    { label: "قائمة الفواتير", icon: ClipboardList, href: "/invoices" },
    ...(branchId === 1
      ? [
          {
            label: "فاتورة قطاعي",
            icon: FileText,
            href: "/invoices/create/retail",
          },
          {
            label: "فاتورة جملة",
            icon: FilePlus2,
            href: "/invoices/create/wholesale",
          },
          {
            label: "فاتورة تحويل",
            icon: Truck,
            href: "/stock-transfer",
          },
          {
            label: "تحويلات حسب التاريخ",
            icon: CalendarDays,
            href: "/transfers/by-date",
          },
          ...(isAdmin
            ? [
                {
                  label: "رصيد أول المدة",
                  icon: PackagePlus,
                  href: "/opening-stock",
                },
                {
                  label: "تعطيل أصناف بالجملة",
                  icon: ShieldOff,
                  href: "/products/bulk-deactivate",
                },
              ]
            : []),
          cashGroup,
          reportsGroup,
        ]
      : branchId === 2
        ? [
            {
              label: "فاتورة جملة",
              icon: FilePlus2,
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
            ...(isAdmin
              ? [
                  {
                    label: "رصيد أول المدة",
                    icon: PackagePlus,
                    href: "/opening-stock",
                  },
                  {
                    label: "تعطيل أصناف بالجملة",
                    icon: ShieldOff,
                    href: "/products/bulk-deactivate",
                  },
                ]
              : []),
            cashGroup,
            reportsGroup,
          ]
        : []),
  ];

  return (
    <aside
      ref={sidebarRef}
      className={cn(
        "flex-col bg-background transition-all duration-300",
        isMobile
          ? "flex w-full h-full border-0"
          : "hidden lg:flex h-screen border-l sticky top-0",
        !isMobile && (open ? "w-60" : "w-[72px]"),
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
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto scrollbar-hide">
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
              replace={entry.href === "/"}
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

      {/* Settings + Logout at bottom */}
      <div className="p-2 border-t space-y-1">
        <Link
          href="/settings"
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-3 rounded-xl px-2 py-2 text-sm transition-colors",
            pathname === "/settings" || pathname.startsWith("/settings/")
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          <div className="w-8 flex justify-center">
            <Settings className="h-5 w-5" />
          </div>
          {open && <span className="mr-2 whitespace-nowrap">الإعدادات</span>}
        </Link>

        <button
          onClick={() => {
            onNavigate?.();
            logout();
          }}
          className={cn(
            "w-full flex items-center gap-3 rounded-xl px-2 py-2 text-sm transition-colors",
            "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
          )}
        >
          <div className="w-8 flex justify-center">
            <LogOut className="h-5 w-5" />
          </div>
          {open && <span className="mr-2 whitespace-nowrap">تسجيل خروج</span>}
        </button>
      </div>
    </aside>
  );
}
