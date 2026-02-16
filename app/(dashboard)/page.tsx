"use client";

import { useEffect, useState } from "react";
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
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/auth-context";
import api from "@/services/api";
import { FileText, Truck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  const [loadingInv, setLoadingInv] = useState(true);
  const [loadingTr, setLoadingTr] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

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

  return (
    <div className="p-4 md:p-6" dir="rtl">
      <div
        className={`grid gap-6 ${branchId === 2 ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"}`}
      >
        {/* ====== آخر الفواتير ====== */}
        <Card>
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
                      <TableCell>{movementLabel(inv.movement_type)}</TableCell>
                      <TableCell>
                        {Math.round(inv.total).toLocaleString()} ج
                      </TableCell>
                      <TableCell>{paymentBadge(inv.payment_status)}</TableCell>
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

        {/* ====== آخر التحويلات (فرع الجملة فقط) ====== */}
        {branchId === 2 && (
          <Card>
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
        )}
      </div>
    </div>
  );
}
