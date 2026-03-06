"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "@/services/api";
import { useAuth } from "@/app/context/auth-context";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent } from "@/components/ui/card";
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
import { ExportButtons, type ExportColumn } from "@/components/export-buttons";
import { Input } from "@/components/ui/input";
import { multiWordMatch, multiWordScore } from "@/lib/utils";
import { useRealtime } from "@/hooks/use-realtime";
import { Skeleton } from "@/components/ui/skeleton";

/* ========== Types ========== */
type LowStockItem = {
  product_id: number;
  product_name: string;
  manufacturer_name?: string | null;
  warehouse_name: string;
  current_stock: number;
  package_name?: string | null;
};

type WarehouseFilter = "الكل" | "المخزن الرئيسي" | "مخزن المعرض";

/* ========== Component ========== */
export default function LowStockReportPage() {
  const { user } = useAuth();
  const isShowroomUser = user?.branch_id === 1;
  const isWarehouseUser = user?.branch_id === 2;

  const [data, setData] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const tableRef = useRef<HTMLDivElement>(null);
  const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseFilter>(
    isShowroomUser
      ? "مخزن المعرض"
      : isWarehouseUser
        ? "المخزن الرئيسي"
        : "الكل",
  );

  /* ========== Fetch ========== */
  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/reports/low-stock");
      setData(Array.isArray(res.data) ? res.data : []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  useRealtime(["data:products", "data:stock", "data:invoices"], fetchReport);

  /* ========== Filter ========== */
  const filteredData = useMemo(() => {
    let result = data;

    // قفل حسب صلاحية المستخدم
    if (isShowroomUser) {
      result = result.filter((i) => i.warehouse_name === "مخزن المعرض");
    } else if (isWarehouseUser) {
      result = result.filter((i) => i.warehouse_name === "المخزن الرئيسي");
    }

    // فلتر الزر
    if (selectedWarehouse !== "الكل") {
      result = result.filter(
        (item) => item.warehouse_name?.trim() === selectedWarehouse.trim(),
      );
    }

    // بحث
    if (search.trim()) {
      result = result.filter((item) =>
        multiWordMatch(
          search,
          item.product_name,
          item.manufacturer_name,
          item.package_name,
          String(item.product_id),
        ),
      );
      // ترتيب حسب الأقرب
      result = [...result].sort((a, b) => {
        const scoreA = multiWordScore(
          search,
          a.product_name,
          a.manufacturer_name,
          a.package_name,
          String(a.product_id),
        );
        const scoreB = multiWordScore(
          search,
          b.product_name,
          b.manufacturer_name,
          b.package_name,
          String(b.product_id),
        );
        return scoreB - scoreA;
      });
    }

    return result;
  }, [data, selectedWarehouse, search, isShowroomUser, isWarehouseUser]);

  /* ========== Warehouse buttons ========== */
  const warehouseOptions: WarehouseFilter[] =
    !isShowroomUser && !isWarehouseUser
      ? ["الكل", "المخزن الرئيسي", "مخزن المعرض"]
      : [];

  /* ========== Export columns ========== */
  const exportColumns: ExportColumn[] = [
    { header: "الصنف", key: "product_name_full", width: 30 },
    { header: "المخزن", key: "warehouse_name", width: 16 },
    { header: "العبوات", key: "pkg", width: 14 },
    { header: "الرصيد الحالي", key: "current_stock", width: 12 },
  ];

  const exportData = filteredData.map((item) => ({
    ...item,
    product_name_full:
      item.product_name +
      (item.manufacturer_name ? ` - ${item.manufacturer_name}` : ""),
    pkg: item.package_name || "—",
  }));

  return (
    <PageContainer size="xl">
      <div dir="rtl" className="space-y-4 py-6">
        <h1 className="text-2xl font-bold text-center">تقرير نقص المخزون</h1>

        {/* Warehouse filter */}
        {warehouseOptions.length > 0 && (
          <div className="flex justify-center gap-2">
            {warehouseOptions.map((w) => (
              <Button
                key={w}
                variant={selectedWarehouse === w ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedWarehouse(w)}
              >
                {w}
              </Button>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="relative max-w-md mx-auto">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ابحث باسم الصنف أو المصنع..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9"
          />
        </div>

        {/* Loading Skeleton */}
        {loading && (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right"><Skeleton className="h-4 w-20" /></TableHead>
                    <TableHead className="text-center"><Skeleton className="h-4 w-20 mx-auto" /></TableHead>
                    <TableHead className="text-center"><Skeleton className="h-4 w-20 mx-auto" /></TableHead>
                    <TableHead className="text-center"><Skeleton className="h-4 w-24 mx-auto" /></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...Array(8)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="h-4 w-24 mx-auto" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
                      <TableCell className="text-center"><Skeleton className="h-6 w-12 mx-auto rounded-full" /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Export buttons */}
        {!loading && filteredData.length > 0 && (
          <div className="flex justify-center">
            <ExportButtons
              tableRef={tableRef}
              columns={exportColumns}
              data={exportData}
              filename={`نقص-المخزون-${new Date().toISOString().slice(0, 10)}`}
              title="تقرير نقص المخزون"
            />
          </div>
        )}

        {/* Table */}
        {!loading && filteredData.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <div className="hidden md:block overflow-x-auto" ref={tableRef}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الصنف</TableHead>
                      <TableHead className="text-center">المخزن</TableHead>
                      <TableHead className="text-center">العبوات</TableHead>
                      <TableHead className="text-center">
                        الرصيد الحالي
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.map((item) => {
                      const isCritical = item.current_stock <= 2;

                      return (
                        <TableRow
                          key={`${item.product_id}-${item.warehouse_name}`}
                          className={
                            isCritical ? "bg-red-50 dark:bg-red-950/20" : ""
                          }
                        >
                          <TableCell className="text-right">
                            <div className="font-medium">
                              {item.product_name}
                            </div>
                            {item.manufacturer_name && (
                              <div className="text-xs text-muted-foreground">
                                {item.manufacturer_name}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-center text-xs">
                            {item.warehouse_name}
                          </TableCell>
                          <TableCell className="text-center text-xs">
                            {item.package_name || "—"}
                          </TableCell>
                          <TableCell
                            className={`text-center font-bold ${isCritical ? "text-red-600" : ""}`}
                          >
                            {item.current_stock}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="md:hidden p-3 space-y-2" dir="rtl">
                {filteredData.map((item) => {
                  const isCritical = Number(item.current_stock || 0) <= 2;

                  return (
                    <div
                      key={`m-${item.product_id}-${item.warehouse_name}`}
                      className={`rounded-lg border p-3 space-y-2 ${
                        isCritical
                          ? "bg-red-50 dark:bg-red-950/20 border-red-500/30"
                          : "bg-card"
                      }`}
                    >
                      <div className="text-sm font-semibold leading-6">
                        {item.product_name}
                      </div>

                      {item.manufacturer_name && (
                        <div className="text-xs text-muted-foreground">
                          {item.manufacturer_name}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-md bg-muted/40 p-2">
                          <div className="text-muted-foreground">المخزن</div>
                          <div className="font-medium mt-0.5">
                            {item.warehouse_name || "—"}
                          </div>
                        </div>

                        <div className="rounded-md bg-muted/40 p-2">
                          <div className="text-muted-foreground">العبوات</div>
                          <div className="font-medium mt-0.5">
                            {item.package_name || "—"}
                          </div>
                        </div>

                        <div className="rounded-md bg-muted/40 p-2 col-span-2">
                          <div className="text-muted-foreground">
                            الرصيد الحالي
                          </div>
                          <div
                            className={`font-bold mt-0.5 ${isCritical ? "text-red-600" : "text-green-600"}`}
                          >
                            {item.current_stock}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty */}
        {!loading && filteredData.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            لا توجد أصناف منخفضة المخزون
          </div>
        )}

        {/* Count */}
        {!loading && filteredData.length > 0 && (
          <div className="text-center">
            <Badge variant="secondary">{filteredData.length} صنف منخفض</Badge>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
