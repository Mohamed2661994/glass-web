"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { Loader2, Printer } from "lucide-react";

/* ========== Types ========== */
type Invoice = {
  record_type: "invoice" | "payment";
  invoice_id: number;
  invoice_date: string;
  total: number;
  paid_amount: number;
  remaining_amount: number;
};

/* ========== Component ========== */
export default function CustomerDebtDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const customerName = decodeURIComponent(params.name as string);

  const [data, setData] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  /* ========== Fetch ========== */
  const fetchDetails = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/reports/customer-debt-details", {
        params: {
          customer_name: customerName,
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
  }, [customerName, fromDate, toDate]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  /* ========== Totals ========== */
  const totalAll = useMemo(
    () =>
      data
        .filter((i) => i.record_type === "invoice")
        .reduce((s, i) => s + Number(i.total), 0),
    [data],
  );

  const totalPaid = useMemo(
    () => data.reduce((s, i) => s + Number(i.paid_amount), 0),
    [data],
  );

  const totalRemaining = useMemo(
    () =>
      data
        .filter((i) => i.record_type === "invoice")
        .reduce((s, i) => s + Number(i.remaining_amount), 0),
    [data],
  );

  const netDebt = totalRemaining - totalPaid;

  return (
    <PageContainer size="xl">
      <div dir="rtl" className="space-y-4 py-6">
        <h1 className="text-2xl font-bold text-center">كشف حساب العميل</h1>

        {/* Customer name + Print */}
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-muted-foreground text-sm">اسم العميل</p>
            <p className="text-lg font-bold">{customerName}</p>
            {!loading && data.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  const params = new URLSearchParams();
                  if (fromDate) params.set("from", fromDate);
                  if (toDate) params.set("to", toDate);
                  const qs = params.toString();
                  router.push(
                    `/reports/customer-balances/${encodeURIComponent(customerName)}/print${qs ? `?${qs}` : ""}`,
                  );
                }}
              >
                <Printer className="h-4 w-4 ml-2" />
                طباعة كشف الحساب
              </Button>
            )}
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

        {/* Table */}
        {!loading && data.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-center">النوع</TableHead>
                      <TableHead className="text-center">رقم</TableHead>
                      <TableHead className="text-center">التاريخ</TableHead>
                      <TableHead className="text-center">الإجمالي</TableHead>
                      <TableHead className="text-center">المدفوع</TableHead>
                      <TableHead className="text-center">الباقي</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((inv) => (
                      <TableRow key={`${inv.record_type}-${inv.invoice_id}`}>
                        <TableCell className="text-center">
                          <Badge
                            variant={
                              inv.record_type === "invoice"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {inv.record_type === "invoice"
                              ? "فاتورة"
                              : "سند دفع"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {inv.invoice_id}
                        </TableCell>
                        <TableCell className="text-center text-xs">
                          {new Date(inv.invoice_date).toLocaleDateString(
                            "ar-EG",
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {inv.record_type === "invoice"
                            ? Number(inv.total).toLocaleString()
                            : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          {Number(inv.paid_amount).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center">
                          {inv.record_type === "invoice"
                            ? Number(inv.remaining_amount).toLocaleString()
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty */}
        {!loading && data.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            لا توجد بيانات لهذا العميل
          </div>
        )}

        {/* Summary */}
        {!loading && data.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4 justify-center text-sm">
                <div className="text-center">
                  <p className="text-muted-foreground">إجمالي الفواتير</p>
                  <p className="font-bold">{totalAll.toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground">إجمالي المدفوع</p>
                  <p className="font-bold text-green-600">
                    {totalPaid.toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground">إجمالي المتبقي</p>
                  <p className="font-bold">{totalRemaining.toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground">صافي المديونية</p>
                  <p className="font-bold text-red-600 text-lg">
                    {netDebt.toLocaleString()}
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
