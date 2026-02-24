"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import api from "@/services/api";
import { PageContainer } from "@/components/layout/page-container";
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
import { Loader2 } from "lucide-react";
import { useRealtime } from "@/hooks/use-realtime";

/* ========== Types ========== */
type StatementRow = {
  record_type: "invoice" | "payment";
  record_id: number;
  record_date: string;
  total: number;
  paid_amount: number;
  remaining_amount: number;
  notes?: string | null;
  permission_number?: string | null;
};

/* ========== Component ========== */
export default function SupplierDebtDetailsPage() {
  const params = useParams();
  const supplierId = params.id as string;

  const [supplierName, setSupplierName] = useState("");
  const [data, setData] = useState<StatementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  /* ========== Fetch supplier info ========== */
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/suppliers/${supplierId}`);
        setSupplierName(res.data.name || `مورد #${supplierId}`);
      } catch {
        setSupplierName(`مورد #${supplierId}`);
      }
    })();
  }, [supplierId]);

  /* ========== Fetch statement ========== */
  const fetchDetails = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/reports/supplier-debt-details", {
        params: {
          supplier_id: supplierId,
          from: fromDate || undefined,
          to: toDate || undefined,
        },
      });
      setData(res.data || []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [supplierId, fromDate, toDate]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  useRealtime(["data:invoices", "data:cash"], fetchDetails);

  /* ========== Running Balance ========== */
  const runningBalances = useMemo(() => {
    const balances: number[] = [];
    let balance = 0;
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (row.record_type === "invoice") {
        balance += Number(row.total) - Number(row.paid_amount);
      } else {
        balance -= Number(row.paid_amount);
      }
      balances.push(balance);
    }
    return balances;
  }, [data]);

  /* ========== Totals ========== */
  const invoices = data.filter((r) => r.record_type === "invoice");
  const payments = data.filter((r) => r.record_type === "payment");

  const totalPurchases = invoices.reduce((s, i) => s + Number(i.total), 0);
  const totalPaidInvoices = invoices.reduce(
    (s, i) => s + Number(i.paid_amount),
    0,
  );
  const totalPayments = payments.reduce((s, i) => s + Number(i.paid_amount), 0);
  const netDebt = totalPurchases - totalPaidInvoices - totalPayments;

  return (
    <PageContainer size="xl">
      <div dir="rtl" className="space-y-4 py-6">
        <h1 className="text-2xl font-bold text-center">كشف حساب المورد</h1>

        {/* Supplier name */}
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-muted-foreground text-sm">اسم المورد</p>
            <p className="text-lg font-bold">{supplierName || "..."}</p>
          </CardContent>
        </Card>

        {/* Date filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 justify-center items-end">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">
                  من تاريخ
                </label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-44"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">
                  إلى تاريخ
                </label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-44"
                />
              </div>
              {(fromDate || toDate) && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setFromDate("");
                    setToDate("");
                  }}
                >
                  مسح
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Table (Desktop) + Cards (Mobile) */}
        {!loading && data.length > 0 && (
          <>
            {/* Desktop Table */}
            <Card className="hidden md:block">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-center">النوع</TableHead>
                        <TableHead className="text-center">رقم</TableHead>
                        <TableHead className="text-center">التاريخ</TableHead>
                        <TableHead className="text-center">
                          إجمالي الفاتورة
                        </TableHead>
                        <TableHead className="text-center">المدفوع</TableHead>
                        <TableHead className="text-center">
                          الرصيد التراكمي
                        </TableHead>
                        <TableHead className="text-center">ملاحظات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.map((row, idx) => (
                        <TableRow key={`${row.record_type}-${row.record_id}`}>
                          <TableCell className="text-center">
                            <Badge
                              variant={
                                row.record_type === "invoice"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {row.record_type === "invoice"
                                ? "فاتورة مشتريات"
                                : "دفعة نقدية"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {row.record_type === "invoice"
                              ? `#${row.record_id}`
                              : row.permission_number || `#${row.record_id}`}
                          </TableCell>
                          <TableCell className="text-center text-xs">
                            {new Date(row.record_date).toLocaleDateString(
                              "ar-EG",
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {row.record_type === "invoice"
                              ? Math.round(Number(row.total)).toLocaleString()
                              : "—"}
                          </TableCell>
                          <TableCell className="text-center text-green-600">
                            {Math.round(
                              Number(row.paid_amount),
                            ).toLocaleString()}
                          </TableCell>
                          <TableCell
                            className={`text-center font-bold ${
                              runningBalances[idx] > 0
                                ? "text-red-600"
                                : runningBalances[idx] < 0
                                  ? "text-green-600"
                                  : ""
                            }`}
                          >
                            {Math.round(runningBalances[idx]).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground max-w-[120px] truncate">
                            {row.notes || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-2">
              {data.map((row, idx) => (
                <Card
                  key={`m-${row.record_type}-${row.record_id}`}
                  className="overflow-hidden"
                >
                  <CardContent className="p-3 space-y-2">
                    {/* Row 1 */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            row.record_type === "invoice"
                              ? "default"
                              : "secondary"
                          }
                          className="text-xs"
                        >
                          {row.record_type === "invoice" ? "فاتورة" : "دفعة"}
                        </Badge>
                        <span className="font-bold text-sm">
                          {row.record_type === "invoice"
                            ? `#${row.record_id}`
                            : row.permission_number || `#${row.record_id}`}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(row.record_date).toLocaleDateString("ar-EG")}
                      </span>
                    </div>

                    {/* Row 2 */}
                    <div className="grid grid-cols-3 gap-1 text-center text-xs">
                      <div>
                        <p className="text-muted-foreground">الإجمالي</p>
                        <p className="font-medium">
                          {row.record_type === "invoice"
                            ? Math.round(Number(row.total)).toLocaleString()
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">المدفوع</p>
                        <p className="font-medium text-green-600">
                          {Math.round(Number(row.paid_amount)).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">الرصيد</p>
                        <p
                          className={`font-bold ${
                            runningBalances[idx] > 0
                              ? "text-red-600"
                              : runningBalances[idx] < 0
                                ? "text-green-600"
                                : ""
                          }`}
                        >
                          {Math.round(runningBalances[idx]).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Notes */}
                    {row.notes && (
                      <p className="text-[11px] text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 rounded px-2 py-1">
                        {row.notes}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* Empty */}
        {!loading && data.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            لا توجد بيانات لهذا المورد
          </div>
        )}

        {/* Summary */}
        {!loading && data.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4 justify-center text-sm">
                <div className="text-center">
                  <p className="text-muted-foreground">إجمالي المشتريات</p>
                  <p className="font-bold">
                    {Math.round(totalPurchases).toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground">مدفوع (فواتير)</p>
                  <p className="font-bold text-green-600">
                    {Math.round(totalPaidInvoices).toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground">دفعات نقدية</p>
                  <p className="font-bold text-green-600">
                    {Math.round(totalPayments).toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground">صافي المديونية</p>
                  <p
                    className={`font-bold text-lg ${
                      netDebt > 0
                        ? "text-red-600"
                        : netDebt < 0
                          ? "text-green-600"
                          : ""
                    }`}
                  >
                    {Math.round(netDebt).toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
