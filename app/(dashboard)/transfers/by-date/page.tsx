"use client";

import { useEffect, useState, useCallback } from "react";
import api from "@/services/api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Printer } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/auth-context";

interface TransferRow {
  id: number;
  transfer_id: number;
  product_id: number;
  product_name: string;
  manufacturer: string;
  from_quantity: string;
  to_quantity: string;
  total_price: string;
  from_warehouse: string;
  to_warehouse: string;
  status: string;
  transfer_status: string;
  wholesale_package: string;
  created_at: string;
}

export default function TransfersByDatePage() {
  const router = useRouter();
  const { user } = useAuth();

  const [date, setDate] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });
  const [rows, setRows] = useState<TransferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingItem, setCancellingItem] = useState<number | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState<number | null>(
    null,
  );

  /* ========== Fetch ========== */
  const fetchTransfers = useCallback(async () => {
    if (!date) return;
    try {
      setLoading(true);
      const { data } = await api.get("/stock-transfers/by-date", {
        params: { date },
      });
      const items = data?.items ?? data;
      setRows(Array.isArray(items) ? items : []);
    } catch {
      toast.error("فشل تحميل التحويلات");
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  /* ========== Cancel Item ========== */
  const cancelItem = async (itemId: number) => {
    try {
      setCancellingItem(itemId);
      await api.post(`/stock-transfers/items/${itemId}/cancel`);
      toast.success("تم إلغاء الصنف");
      setShowCancelConfirm(null);
      fetchTransfers(); // Reload
    } catch (err: any) {
      toast.error(
        err?.response?.data?.error ||
          err?.response?.data?.message ||
          "فشل إلغاء الصنف",
      );
    } finally {
      setCancellingItem(null);
    }
  };

  /* ========== Total ========== */
  const totalPrice = rows
    .filter((r) => r.status !== "cancelled")
    .reduce((sum, r) => sum + (parseFloat(r.total_price) || 0), 0);

  /* ========== Print ========== */
  const handlePrint = () => {
    router.push(`/transfers/by-date/print?date=${date}`);
  };

  return (
    <div dir="rtl" className="max-w-4xl mx-auto space-y-4 py-6 px-4">
      <h1 className="text-2xl font-bold text-center mb-6">
        تحويلات حسب التاريخ
      </h1>

      {/* ===== Date Filter ===== */}
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
      </div>

      {/* ===== Loading ===== */}
      {loading && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4">
              <Skeleton className="h-6 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-0">
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ===== Summary ===== */}
      {!loading && (
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {new Date(date).toLocaleDateString("ar-EG", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
              <Badge>
                {rows.filter((r) => r.status !== "cancelled").length} صنف
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-bold">
                {Math.round(totalPrice).toLocaleString()} جنيه
              </span>
              <Button
                variant="outline"
                size="icon"
                className="print:hidden"
                onClick={handlePrint}
              >
                <Printer className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== Table ===== */}
      {!loading && rows.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">اسم الصنف</TableHead>
                    <TableHead className="text-center">مصنع</TableHead>
                    <TableHead className="text-center">من المخزن</TableHead>
                    <TableHead className="text-center">إلى المعرض</TableHead>
                    <TableHead className="text-center">السعر</TableHead>
                    <TableHead className="text-center">رقم التحويل</TableHead>
                    <TableHead className="text-center print:hidden">
                      إجراء
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const isCancelled = row.status === "cancelled";
                    return (
                      <TableRow
                        key={row.id}
                        className={isCancelled ? "opacity-40 line-through" : ""}
                      >
                        <TableCell className="text-right font-medium">
                          {row.product_name}
                        </TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">
                          {row.manufacturer}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.from_quantity}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.to_quantity}
                        </TableCell>
                        <TableCell className="text-center">
                          {Math.round(
                            parseFloat(row.total_price) || 0,
                          ).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center">
                          <Link
                            href={`/transfers/${row.transfer_id}`}
                            className="text-primary underline"
                          >
                            {row.transfer_id}
                          </Link>
                        </TableCell>
                        <TableCell className="text-center print:hidden">
                          {!isCancelled ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-600 text-xs"
                              onClick={() => setShowCancelConfirm(row.id)}
                            >
                              إلغاء
                            </Button>
                          ) : (
                            <Badge
                              variant="destructive"
                              className="text-[10px]"
                            >
                              ملغي
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!loading && rows.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          لا توجد تحويلات في هذا التاريخ
        </div>
      )}

      {/* ===== Cancel Confirm ===== */}
      <Dialog
        open={showCancelConfirm !== null}
        onOpenChange={() => setShowCancelConfirm(null)}
      >
        <DialogContent dir="rtl" className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle>تأكيد الإلغاء</DialogTitle>
          </DialogHeader>
          <p className="py-4 text-muted-foreground">
            هل تريد إلغاء هذا الصنف من التحويل؟
          </p>
          <div className="flex gap-3">
            <Button
              variant="destructive"
              className="flex-1"
              disabled={cancellingItem !== null}
              onClick={() => showCancelConfirm && cancelItem(showCancelConfirm)}
            >
              {cancellingItem !== null ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "تأكيد"
              )}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowCancelConfirm(null)}
            >
              رجوع
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
