"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/services/api";
import { multiWordMatch } from "@/lib/utils";
import { useAuth } from "@/app/context/auth-context";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Search, AlertTriangle, Wrench } from "lucide-react";
import { toast } from "sonner";
import { useRealtime } from "@/hooks/use-realtime";

/* ========== Types ========== */
type InventoryItem = {
  product_id: number;
  product_name: string;
  manufacturer_name?: string | null;
  barcode?: string | null;
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
  const [discrepancyOpen, setDiscrepancyOpen] = useState(false);
  const [reconciling, setReconciling] = useState(false);
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
      const [invRes, prodRes] = await Promise.all([
        api.get("/reports/inventory-summary"),
        api.get("/products", {
          params: {
            branch_id: isShowroomUser ? 1 : 2,
            invoice_type: isShowroomUser ? "retail" : "wholesale",
            movement_type: "sale",
          },
        }),
      ]);
      const products: any[] = Array.isArray(prodRes.data)
        ? prodRes.data
        : (prodRes.data?.data ?? []);
      const barcodeMap: Record<number, string> = {};
      products.forEach((p: any) => {
        if (p.barcode) barcodeMap[p.id] = p.barcode;
      });
      const items: InventoryItem[] = (
        Array.isArray(invRes.data) ? invRes.data : []
      ).map((item: any) => ({
        ...item,
        barcode: item.barcode || barcodeMap[item.product_id] || null,
      }));
      setData(items);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [isShowroomUser]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  useRealtime(["data:products", "data:stock", "data:invoices"], fetchReport);

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
      result = result.filter((item) =>
        multiWordMatch(
          searchText,
          item.product_name,
          item.manufacturer_name || "",
          item.barcode || "",
        ),
      );
    }

    return result;
  }, [data, selectedWarehouse, searchText, isShowroomUser, isWarehouseUser]);

  /* ========== Problem count ========== */
  const discrepancyItems = useMemo(() => {
    return filteredData.filter((item) => {
      const diff =
        Number(item.current_stock || 0) -
        (Number(item.total_in || 0) - Number(item.total_out || 0));
      return diff !== 0;
    });
  }, [filteredData]);

  const problemCount = discrepancyItems.length;

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
            placeholder="بحث بالاسم أو المصنع أو الباركود..."
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
          <button
            className="mx-auto block text-center text-red-500 font-bold text-sm hover:underline cursor-pointer"
            onClick={() => setDiscrepancyOpen(true)}
          >
            ⚠️ يوجد {problemCount} صنف به فرق في الرصيد
          </button>
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
                              {item.manufacturer_name && (
                                <span className="text-muted-foreground font-normal">
                                  {" "}
                                  - {item.manufacturer_name}
                                </span>
                              )}
                            </div>
                            {item.barcode && (
                              <div className="text-xs text-muted-foreground font-mono">
                                {item.barcode}
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

        {/* Discrepancy Modal */}
        <Dialog open={discrepancyOpen} onOpenChange={setDiscrepancyOpen}>
          <DialogContent
            dir="rtl"
            className="sm:max-w-4xl max-h-[85vh] flex flex-col p-0"
          >
            <DialogHeader className="p-4 border-b shrink-0">
              <div className="flex items-center justify-between">
                <DialogTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  أصناف بها فرق في الرصيد ({discrepancyItems.length})
                </DialogTitle>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={reconciling}
                  onClick={async () => {
                    setReconciling(true);
                    try {
                      const { data } = await api.post("/stock/reconcile");
                      toast.success(data.message || "تم تصحيح الأرصدة");
                      setDiscrepancyOpen(false);
                      fetchReport();
                    } catch {
                      toast.error("فشل تصحيح الأرصدة");
                    } finally {
                      setReconciling(false);
                    }
                  }}
                >
                  {reconciling ? (
                    <Loader2 className="h-4 w-4 ml-1 animate-spin" />
                  ) : (
                    <Wrench className="h-4 w-4 ml-1" />
                  )}
                  تصحيح الأرصدة
                </Button>
              </div>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {discrepancyItems.length === 0 ? (
                <p className="text-center py-12 text-muted-foreground">
                  لا توجد أصناف بها فرق
                </p>
              ) : (
                <Table className="text-xs sm:text-sm">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الصنف</TableHead>
                      <TableHead className="text-center">المخزن</TableHead>
                      <TableHead className="text-center">وارد</TableHead>
                      <TableHead className="text-center">صادر</TableHead>
                      <TableHead className="text-center">الرصيد</TableHead>
                      <TableHead className="text-center">المتوقع</TableHead>
                      <TableHead className="text-center">الفرق</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {discrepancyItems.map((item, idx) => {
                      const totalIn = Number(item.total_in || 0);
                      const totalOut = Number(item.total_out || 0);
                      const currentStock = Number(item.current_stock || 0);
                      const expectedStock = totalIn - totalOut;
                      const difference = currentStock - expectedStock;
                      return (
                        <TableRow
                          key={`disc-${item.product_id}-${item.warehouse_name}-${idx}`}
                          className="bg-red-50 dark:bg-red-950/20"
                        >
                          <TableCell className="text-right">
                            <div className="font-medium">
                              {item.product_name}
                              {item.manufacturer_name && (
                                <span className="text-muted-foreground font-normal">
                                  {" "}
                                  - {item.manufacturer_name}
                                </span>
                              )}
                            </div>
                            {item.barcode && (
                              <div className="text-xs text-muted-foreground font-mono">
                                {item.barcode}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-center text-xs">
                            {item.warehouse_name}
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
                          <TableCell className="text-center">
                            {expectedStock}
                          </TableCell>
                          <TableCell className="text-center font-bold text-red-600">
                            {difference}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </PageContainer>
  );
}
