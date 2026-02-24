"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Loader2, Search } from "lucide-react";
import Link from "next/link";
import { useRealtime } from "@/hooks/use-realtime";

/* ========== Types ========== */
type SupplierBalanceItem = {
  supplier_id: number;
  supplier_name: string;
  total_purchases: number;
  total_paid_invoices: number;
  total_payments: number;
  balance_due: number;
  last_invoice_date?: string | null;
};

/* ========== Component ========== */
export default function SupplierBalancesPage() {
  const [data, setData] = useState<SupplierBalanceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState("");

  /* ========== Fetch ========== */
  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/reports/supplier-balances", {
        params: {
          supplier_name: supplierSearch || undefined,
        },
      });
      setData(Array.isArray(res.data) ? res.data : []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [supplierSearch]);

  /* Auto-search */
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchReport();
    }, 400);
    return () => clearTimeout(timer);
  }, [fetchReport]);

  useRealtime(["data:invoices", "data:cash"], fetchReport);

  /* ========== Totals ========== */
  const totalBalance = useMemo(
    () => data.reduce((sum, s) => sum + Number(s.balance_due || 0), 0),
    [data],
  );

  const totalPurchases = useMemo(
    () => data.reduce((sum, s) => sum + Number(s.total_purchases || 0), 0),
    [data],
  );

  return (
    <PageContainer size="xl">
      <div dir="rtl" className="space-y-4 py-6">
        <h1 className="text-2xl font-bold text-center">
          كشف حساب الموردين
        </h1>

        {/* Filters */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="relative max-w-md mx-auto">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="بحث باسم المورد..."
                value={supplierSearch}
                onChange={(e) => setSupplierSearch(e.target.value)}
                className="pr-9"
              />
            </div>
            {supplierSearch && (
              <div className="flex justify-center">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setSupplierSearch("")}
                >
                  مسح البحث
                </Button>
              </div>
            )}
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
                      <TableHead className="text-right">المورد</TableHead>
                      <TableHead className="text-center">آخر فاتورة</TableHead>
                      <TableHead className="text-center">
                        إجمالي المشتريات
                      </TableHead>
                      <TableHead className="text-center">
                        المدفوع (فواتير)
                      </TableHead>
                      <TableHead className="text-center">
                        دفعات نقدية
                      </TableHead>
                      <TableHead className="text-center">المديونية</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((item) => (
                      <TableRow key={item.supplier_id}>
                        <TableCell className="text-right font-medium">
                          <Link
                            href={`/reports/supplier-balances/${item.supplier_id}`}
                            className="text-primary hover:underline"
                          >
                            {item.supplier_name}
                          </Link>
                        </TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">
                          {item.last_invoice_date
                            ? new Date(
                                item.last_invoice_date,
                              ).toLocaleDateString("ar-EG")
                            : "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          {Math.round(
                            Number(item.total_purchases || 0),
                          ).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center">
                          {Math.round(
                            Number(item.total_paid_invoices || 0),
                          ).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center text-green-600">
                          {Math.round(
                            Number(item.total_payments || 0),
                          ).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center font-bold text-red-600">
                          {Math.round(
                            Number(item.balance_due || 0),
                          ).toLocaleString()}
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
            لا توجد بيانات
          </div>
        )}

        {/* Summary */}
        {!loading && data.length > 0 && (
          <div className="flex flex-wrap justify-center gap-4">
            <Badge variant="secondary">{data.length} مورد</Badge>
            <Badge variant="outline">
              إجمالي المشتريات: {Math.round(totalPurchases).toLocaleString()}{" "}
              جنيه
            </Badge>
            <Badge variant="destructive">
              إجمالي المديونية: {Math.round(totalBalance).toLocaleString()} جنيه
            </Badge>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
