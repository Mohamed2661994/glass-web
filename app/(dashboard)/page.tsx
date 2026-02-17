"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/auth-context";
import api from "@/services/api";
import {
  FileText,
  Truck,
  RefreshCw,
  Banknote,
  AlertTriangle,
  ShoppingCart,
  Settings2,
  GripVertical,
  Wallet,
  TrendingUp,
  TrendingDown,
  Plus,
  ArrowLeftRight,
  Package,
  Users,
  BarChart3,
  Bell,
  Link2,
  CircleDot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/* ---------- types ---------- */
interface Invoice {
  id: number;
  invoice_type: "retail" | "wholesale";
  movement_type: "sale" | "purchase";
  customer_name: string;
  total: number;
  payment_status: "paid" | "partial" | "unpaid";
  created_at: string;
}

interface Transfer {
  id: number;
  items_count: number;
  total_from_quantity: number;
  status: string;
  created_at: string;
}

interface DashboardStats {
  today_sales: number;
  today_invoices_count: number;
  today_cash: number;
  low_stock_count: number;
}

interface CashInItem {
  id: number;
  amount: number;
  paid_amount: number;
}

interface CashOutItem {
  id: number;
  amount: number;
}

interface Notification {
  id: number;
  message: string;
  is_read: boolean;
  created_at: string;
}

/* ---------- widget config ---------- */
type WidgetId =
  | "kpi_cards"
  | "recent_invoices"
  | "recent_transfers"
  | "cash_summary"
  | "quick_links"
  | "notifications";

interface WidgetConfig {
  id: WidgetId;
  label: string;
  visible: boolean;
  order: number;
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: "kpi_cards", label: "بطاقات الإحصائيات", visible: true, order: 0 },
  { id: "cash_summary", label: "ملخص الخزنة", visible: true, order: 1 },
  { id: "quick_links", label: "روابط سريعة", visible: true, order: 2 },
  { id: "recent_invoices", label: "آخر الفواتير", visible: true, order: 3 },
  { id: "recent_transfers", label: "آخر التحويلات", visible: true, order: 4 },
  { id: "notifications", label: "آخر الإشعارات", visible: true, order: 5 },
];

function getDashboardConfig(userId: number): WidgetConfig[] {
  try {
    const raw = localStorage.getItem(`dashboard_config_${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as WidgetConfig[];
      const map = new Map(parsed.map((w) => [w.id, w]));
      return DEFAULT_WIDGETS.map((dw) => map.get(dw.id) ?? dw).sort(
        (a, b) => a.order - b.order,
      );
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_WIDGETS;
}

function saveDashboardConfig(userId: number, config: WidgetConfig[]) {
  localStorage.setItem(`dashboard_config_${userId}`, JSON.stringify(config));
}

/* ---------- helpers ---------- */
const paymentBadge = (s: string) => {
  switch (s) {
    case "paid":
      return <Badge className="bg-green-600">مدفوعة</Badge>;
    case "partial":
      return <Badge className="bg-yellow-500">جزئي</Badge>;
    default:
      return <Badge variant="destructive">غير مدفوعة</Badge>;
  }
};

const movementLabel = (m: string) =>
  m === "sale" ? "بيع" : m === "purchase" ? "شراء" : m;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("ar-EG", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/* ========================================= */
export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const branchId = user?.branch_id;
  const invoiceType = branchId === 1 ? "retail" : "wholesale";

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadingInv, setLoadingInv] = useState(true);
  const [loadingTr, setLoadingTr] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  /* cash summary */
  const [cashInTotal, setCashInTotal] = useState(0);
  const [cashOutTotal, setCashOutTotal] = useState(0);
  const [loadingCash, setLoadingCash] = useState(true);

  /* notifications */
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(true);

  /* ---------- widget customization ---------- */
  const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_WIDGETS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  useEffect(() => {
    if (user?.id) setWidgets(getDashboardConfig(user.id));
  }, [user?.id]);

  const isVisible = useCallback(
    (id: WidgetId) => widgets.find((w) => w.id === id)?.visible ?? true,
    [widgets],
  );

  const toggleWidget = useCallback(
    (id: WidgetId) => {
      setWidgets((prev) => {
        const next = prev.map((w) =>
          w.id === id ? { ...w, visible: !w.visible } : w,
        );
        if (user?.id) saveDashboardConfig(user.id, next);
        return next;
      });
    },
    [user?.id],
  );

  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    setWidgets((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx, 1);
      next.splice(idx, 0, moved);
      const reordered = next.map((w, i) => ({ ...w, order: i }));
      if (user?.id) saveDashboardConfig(user.id, reordered);
      return reordered;
    });
    setDragIdx(idx);
  };
  const handleDragEnd = () => setDragIdx(null);

  const sortedWidgets = useMemo(
    () => [...widgets].sort((a, b) => a.order - b.order),
    [widgets],
  );

  /* re-fetch when page becomes visible (user navigates back) */
  useEffect(() => {
    const onFocus = () => setRefreshKey((k) => k + 1);
    const onVisibility = () => {
      if (document.visibilityState === "visible") onFocus();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  /* fetch invoices */
  useEffect(() => {
    if (!branchId) return;
    setLoadingInv(true);
    (async () => {
      try {
        const { data } = await api.get("/invoices", {
          params: { limit: 10, invoice_type: invoiceType, _t: Date.now() },
        });
        setInvoices(Array.isArray(data) ? data : (data.data ?? []));
      } catch {
        /* silent */
      } finally {
        setLoadingInv(false);
      }
    })();
  }, [branchId, invoiceType, refreshKey]);

  /* fetch dashboard stats */
  useEffect(() => {
    if (!branchId) return;
    setLoadingStats(true);
    (async () => {
      try {
        const { data } = await api.get("/dashboard/stats", {
          params: { invoice_type: invoiceType, _t: Date.now() },
        });
        setStats(data);
      } catch {
        /* silent */
      } finally {
        setLoadingStats(false);
      }
    })();
  }, [branchId, invoiceType, refreshKey]);

  /* fetch transfers (branch 2 only) */
  useEffect(() => {
    if (branchId !== 2) {
      setLoadingTr(false);
      return;
    }
    setLoadingTr(true);
    (async () => {
      try {
        const { data } = await api.get("/stock-transfers", {
          params: { limit: 10, _t: Date.now() },
        });
        setTransfers(data?.data ?? []);
      } catch {
        /* silent */
      } finally {
        setLoadingTr(false);
      }
    })();
  }, [branchId, refreshKey]);

  /* fetch cash summary */
  useEffect(() => {
    if (!branchId) return;
    setLoadingCash(true);
    (async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        const [inRes, outRes] = await Promise.all([
          api.get("/cash-in", { params: { branch_id: branchId } }),
          api.get("/cash/out", {
            params: { branch_id: branchId, from_date: today, to_date: today },
          }),
        ]);
        const inItems: CashInItem[] = inRes.data?.data ?? [];
        const outItems: CashOutItem[] = outRes.data?.data ?? [];
        setCashInTotal(
          inItems.reduce((s, i) => s + Number(i.paid_amount || i.amount || 0), 0),
        );
        setCashOutTotal(
          outItems.reduce((s, i) => s + Number(i.amount || 0), 0),
        );
      } catch {
        /* silent */
      } finally {
        setLoadingCash(false);
      }
    })();
  }, [branchId, refreshKey]);

  /* fetch notifications */
  useEffect(() => {
    setLoadingNotifs(true);
    (async () => {
      try {
        const { data } = await api.get("/notifications");
        setNotifications(Array.isArray(data) ? data.slice(0, 8) : []);
      } catch {
        /* silent */
      } finally {
        setLoadingNotifs(false);
      }
    })();
  }, [refreshKey]);

  /* ---------- skeleton rows ---------- */
  const skelRows = (cols: number) =>
    Array.from({ length: 5 }).map((_, i) => (
      <TableRow key={i}>
        {Array.from({ length: cols }).map((_, j) => (
          <TableCell key={j}>
            <Skeleton className="h-4 w-full" />
          </TableCell>
        ))}
      </TableRow>
    ));

  /* ---------- widget renderers ---------- */
  const renderWidget = (id: WidgetId) => {
    switch (id) {
      case "kpi_cards":
        return (
          <div key={id} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-lg bg-blue-100 dark:bg-blue-900/30 p-2.5">
                  <ShoppingCart className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">مبيعات اليوم</p>
                  {loadingStats ? (
                    <Skeleton className="h-6 w-20 mt-1" />
                  ) : (
                    <p className="text-lg font-bold">
                      {Math.round(stats?.today_sales ?? 0).toLocaleString()} ج
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-lg bg-green-100 dark:bg-green-900/30 p-2.5">
                  <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">فواتير اليوم</p>
                  {loadingStats ? (
                    <Skeleton className="h-6 w-12 mt-1" />
                  ) : (
                    <p className="text-lg font-bold">
                      {stats?.today_invoices_count ?? 0}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-lg bg-emerald-100 dark:bg-emerald-900/30 p-2.5">
                  <Banknote className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">نقدية اليوم</p>
                  {loadingStats ? (
                    <Skeleton className="h-6 w-20 mt-1" />
                  ) : (
                    <p className="text-lg font-bold">
                      {Math.round(stats?.today_cash ?? 0).toLocaleString()} ج
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-lg bg-orange-100 dark:bg-orange-900/30 p-2.5">
                  <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">أصناف منخفضة</p>
                  {loadingStats ? (
                    <Skeleton className="h-6 w-12 mt-1" />
                  ) : (
                    <p className="text-lg font-bold">
                      {stats?.low_stock_count ?? 0}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case "recent_invoices":
        return (
          <Card key={id}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5" />
                آخر الفواتير
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setRefreshKey((k) => k + 1)}
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Badge variant="outline">{invoices.length} فاتورة</Badge>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">#</TableHead>
                    <TableHead className="text-right">العميل</TableHead>
                    <TableHead className="text-right">النوع</TableHead>
                    <TableHead className="text-right">الإجمالي</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingInv ? (
                    skelRows(6)
                  ) : invoices.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-8 text-muted-foreground"
                      >
                        لا توجد فواتير
                      </TableCell>
                    </TableRow>
                  ) : (
                    invoices.map((inv) => (
                      <TableRow
                        key={inv.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`/invoices/${inv.id}`)}
                      >
                        <TableCell className="font-medium">{inv.id}</TableCell>
                        <TableCell>{inv.customer_name || "—"}</TableCell>
                        <TableCell>
                          {movementLabel(inv.movement_type)}
                        </TableCell>
                        <TableCell>
                          {Math.round(inv.total).toLocaleString()} ج
                        </TableCell>
                        <TableCell>
                          {paymentBadge(inv.payment_status)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {formatDate(inv.created_at)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );

      case "recent_transfers":
        if (branchId !== 2) return null;
        return (
          <Card key={id}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Truck className="h-5 w-5" />
                آخر التحويلات
              </CardTitle>
              <Badge variant="outline">{transfers.length} تحويل</Badge>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">رقم التحويل</TableHead>
                    <TableHead className="text-right">عدد الأصناف</TableHead>
                    <TableHead className="text-right">إجمالي الكمية</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingTr ? (
                    skelRows(5)
                  ) : transfers.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center py-8 text-muted-foreground"
                      >
                        لا توجد تحويلات
                      </TableCell>
                    </TableRow>
                  ) : (
                    transfers.map((tr) => (
                      <TableRow
                        key={tr.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => router.push(`/transfers/${tr.id}`)}
                      >
                        <TableCell className="font-medium">{tr.id}</TableCell>
                        <TableCell>{tr.items_count}</TableCell>
                        <TableCell>{tr.total_from_quantity}</TableCell>
                        <TableCell>
                          {tr.status === "cancelled" ? (
                            <Badge variant="destructive">ملغي</Badge>
                          ) : (
                            <Badge className="bg-green-600">تم</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {formatDate(tr.created_at)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );

      /* ===== Cash Summary Widget ===== */
      case "cash_summary": {
        const netCash = cashInTotal - cashOutTotal;
        return (
          <Card key={id}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Wallet className="h-5 w-5" />
                ملخص الخزنة (اليوم)
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setRefreshKey((k) => k + 1)}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {loadingCash ? (
                <div className="grid grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 rounded-xl" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  {/* وارد */}
                  <div className="rounded-xl bg-green-500/10 dark:bg-green-500/15 p-4 text-center">
                    <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto mb-1" />
                    <p className="text-[11px] text-muted-foreground mb-1">
                      الوارد
                    </p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">
                      {Math.round(cashInTotal).toLocaleString()}
                    </p>
                  </div>
                  {/* منصرف */}
                  <div className="rounded-xl bg-red-500/10 dark:bg-red-500/15 p-4 text-center">
                    <TrendingDown className="h-5 w-5 text-red-500 dark:text-red-400 mx-auto mb-1" />
                    <p className="text-[11px] text-muted-foreground mb-1">
                      المنصرف
                    </p>
                    <p className="text-lg font-bold text-red-500 dark:text-red-400">
                      {Math.round(cashOutTotal).toLocaleString()}
                    </p>
                  </div>
                  {/* صافي */}
                  <div
                    className={`rounded-xl p-4 text-center ${
                      netCash >= 0
                        ? "bg-blue-500/10 dark:bg-blue-500/15"
                        : "bg-orange-500/10 dark:bg-orange-500/15"
                    }`}
                  >
                    <Banknote
                      className={`h-5 w-5 mx-auto mb-1 ${
                        netCash >= 0
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-orange-600 dark:text-orange-400"
                      }`}
                    />
                    <p className="text-[11px] text-muted-foreground mb-1">
                      الصافي
                    </p>
                    <p
                      className={`text-lg font-bold ${
                        netCash >= 0
                          ? "text-blue-600 dark:text-blue-400"
                          : "text-orange-600 dark:text-orange-400"
                      }`}
                    >
                      {Math.round(netCash).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      }

      /* ===== Quick Links Widget ===== */
      case "quick_links": {
        const links = [
          {
            label: "فاتورة جديدة",
            href:
              branchId === 1
                ? "/invoices/create/retail"
                : "/invoices/create/wholesale",
            icon: Plus,
            color: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
          },
          {
            label: "الفواتير",
            href: "/invoices",
            icon: FileText,
            color: "bg-green-500/10 text-green-600 dark:text-green-400",
          },
          {
            label: "الأصناف",
            href: "/products",
            icon: Package,
            color: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
          },
          {
            label: "تحويل مخزون",
            href: "/stock-transfer",
            icon: ArrowLeftRight,
            color: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
          },
          {
            label: "وارد الخزنة",
            href: "/cash/in",
            icon: TrendingUp,
            color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
          },
          {
            label: "أرصدة العملاء",
            href: "/reports/customer-balances",
            icon: Users,
            color: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
          },
          {
            label: "جرد المخزون",
            href: "/reports/inventory-summary",
            icon: BarChart3,
            color: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
          },
          {
            label: "ملخص الخزنة",
            href: "/cash/summary",
            icon: Wallet,
            color: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
          },
        ];
        return (
          <Card key={id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Link2 className="h-5 w-5" />
                روابط سريعة
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {links.map((link) => (
                  <button
                    key={link.href}
                    onClick={() => router.push(link.href)}
                    className={`flex flex-col items-center gap-2 rounded-xl p-3 transition-all hover:scale-105 hover:shadow-md ${link.color}`}
                  >
                    <link.icon className="h-5 w-5" />
                    <span className="text-xs font-medium">{link.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      }

      /* ===== Notifications Widget ===== */
      case "notifications":
        return (
          <Card key={id}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bell className="h-5 w-5" />
                آخر الإشعارات
              </CardTitle>
              <Badge variant="outline">
                {notifications.filter((n) => !n.is_read).length} جديد
              </Badge>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {loadingNotifs ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-10 w-full rounded-lg" />
                  ))}
                </div>
              ) : notifications.length === 0 ? (
                <p className="text-center py-6 text-muted-foreground text-sm">
                  لا توجد إشعارات
                </p>
              ) : (
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`flex items-start gap-3 rounded-lg p-2.5 transition-colors ${
                        notif.is_read
                          ? "bg-muted/30"
                          : "bg-blue-500/5 border border-blue-500/20"
                      }`}
                    >
                      <CircleDot
                        className={`h-3 w-3 mt-1.5 shrink-0 ${
                          notif.is_read
                            ? "text-muted-foreground"
                            : "text-blue-500"
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-relaxed">
                          {notif.message}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {formatDate(notif.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      {/* ====== Header with settings ====== */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">لوحة التحكم</h1>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings2 className="h-4 w-4" />
          تخصيص
        </Button>
      </div>

      {/* ====== Render widgets in order ====== */}
      {sortedWidgets.map((w) => (w.visible ? renderWidget(w.id) : null))}

      {/* ====== Settings Dialog ====== */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              تخصيص لوحة التحكم
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            اختر الأقسام اللي عايز تظهر، واسحب لترتيبها.
          </p>
          <div className="space-y-1">
            {sortedWidgets.map((w, idx) => (
              <div
                key={w.id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                className={`flex items-center justify-between p-3 rounded-lg border cursor-grab active:cursor-grabbing transition-colors ${
                  dragIdx === idx
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <Label
                    htmlFor={`widget-${w.id}`}
                    className="cursor-pointer font-medium"
                  >
                    {w.label}
                  </Label>
                </div>
                <Switch
                  id={`widget-${w.id}`}
                  checked={w.visible}
                  onCheckedChange={() => toggleWidget(w.id)}
                />
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
