"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/services/api";
import { noSpaces } from "@/lib/utils";
import { useAuth } from "@/app/context/auth-context";
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

/* ========== Types ========== */
type InventoryItem = {
  product_id: number;
  product_name: string;
  manufacturer_name?: string | null;
  warehouse_name: string | null;
  total_in: number;
  total_out: number;
  current_stock: number;
  package_name?: string | null;
};

type WarehouseFilter = "الكل" | "المخزن الرئيسي" | "مخزن المعرض";

/* ========== Component ========== */
export default function InventorySummaryPage() {
  const { user } = useAuth();
  const isShowroomUser = user?.branch_id === 1;
  const isWarehouseUser = user?.branch_id === 2;

  const [data, setData] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
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
      const res = await api.get("/reports/inventory-summary");
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

  /* ========== Filter ========== */
  const filteredData = useMemo(() => {
    let result = data;

    // قفل حسب صلاحية المستخدم
    if (isShowroomUser) {
      result = result.filter(
        (i) => (i.warehouse_name || "").trim() === "مخزن المعرض",
      );
    } else if (isWarehouseUser) {
      result = result.filter(
        (i) => (i.warehouse_name || "").trim() === "المخزن الرئيسي",
      );
    }

    // فلتر الزر
    if (selectedWarehouse !== "الكل") {
      result = result.filter(
        (item) =>
          (item.warehouse_name || "").trim() === selectedWarehouse.trim(),
      );
    }

    // بحث
    if (searchText.trim()) {
      const q = noSpaces(searchText).toLowerCase();
      result = result.filter(
        (item) =>
          noSpaces(item.product_name).toLowerCase().includes(q) ||
          noSpaces(item.manufacturer_name || "").toLowerCase().includes(q),
      );
    }

    return result;
  }, [data, selectedWarehouse, searchText, isShowroomUser, isWarehouseUser]);

  /* ========== Problem count ========== */
  const problemCount = filteredData.filter((item) => {
    const diff =
      Number(item.current_stock || 0) -
      (Number(item.total_in || 0) - Number(item.total_out || 0));
    return diff !== 0;
  }).length;

  /* ========== Warehouse buttons (only if not locked) ========== */
  const warehouseOptions: WarehouseFilter[] =
    !isShowroomUser && !isWarehouseUser
      ? ["الكل", "المخزن الرئيسي", "مخزن المعرض"]
      : [];

  return (
    <PageContainer size="xl">
      <div dir="rtl" className="space-y-4 py-6">
        <h1 className="text-2xl font-bold text-center">تقرير حركة المخزون</h1>

        {/* Search */}
        <div className="relative max-w-md mx-auto">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم أو المصنع..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pr-9"
          />
        </div>

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

        {/* Problem badge */}
        {!loading && problemCount > 0 && (
          <p className="text-center text-red-500 font-bold text-sm">
            ⚠️ يوجد {problemCount} صنف به فرق في الرصيد
          </p>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Table */}
        {!loading && filteredData.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الصنف</TableHead>
                      <TableHead className="text-center">المخزن</TableHead>
                      <TableHead className="text-center">العبوات</TableHead>
                      <TableHead className="text-center">وارد</TableHead>
                      <TableHead className="text-center">صادر</TableHead>
                      <TableHead className="text-center">الرصيد</TableHead>
                      <TableHead className="text-center">الفرق</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.map((item, idx) => {
                      const totalIn = Number(item.total_in || 0);
                      const totalOut = Number(item.total_out || 0);
                      const currentStock = Number(item.current_stock || 0);
                      const expectedStock = totalIn - totalOut;
                      const difference = currentStock - expectedStock;
                      const hasProblem = difference !== 0;

                      return (
                        <TableRow
                          key={`${item.product_id}-${item.warehouse_name}-${idx}`}
                          className={
                            hasProblem ? "bg-red-50 dark:bg-red-950/20" : ""
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
                          <TableCell className="text-center">
                            {totalIn}
                          </TableCell>
                          <TableCell className="text-center">
                            {totalOut}
                          </TableCell>
                          <TableCell className="text-center font-bold">
                            {currentStock}
                          </TableCell>
                          <TableCell
                            className={`text-center font-bold ${hasProblem ? "text-red-600" : "text-green-600"}`}
                          >
                            {difference}
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

        {/* Empty */}
        {!loading && filteredData.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            لا توجد بيانات
          </div>
        )}

        {/* Count badge */}
        {!loading && filteredData.length > 0 && (
          <div className="text-center">
            <Badge variant="secondary">{filteredData.length} صنف</Badge>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
