"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, TrendingDown, RefreshCw, Eraser } from "lucide-react";
import { toast } from "sonner";

/* ========== Types ========== */
type NegativeStockItem = {
  product_id: number;
  product_name: string;
  barcode?: string;
  manufacturer_name?: string | null;
  warehouse_name: string;
  current_stock: number;
  package_name?: string | null;
};

type WarehouseFilter = "الكل" | "المخزن الرئيسي" | "مخزن المعرض";

/* ========== Component ========== */
export default function NegativeStockReportPage() {
  const { user } = useAuth();
  const isShowroomUser = user?.branch_id === 1;
  const isWarehouseUser = user?.branch_id === 2;

  const [data, setData] = useState<NegativeStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [zeroing, setZeroing] = useState(false);
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
      const res = await api.get("/reports/negative-stock");
      const items = Array.isArray(res.data) ? res.data : [];
      setData(
        items.map((item: NegativeStockItem) => ({
          ...item,
          current_stock: Number(item.current_stock) || 0,
        })),
      );
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

    if (isShowroomUser) {
      result = result.filter((i) => i.warehouse_name === "مخزن المعرض");
    } else if (isWarehouseUser) {
      result = result.filter((i) => i.warehouse_name === "المخزن الرئيسي");
    }

    if (selectedWarehouse !== "الكل") {
      result = result.filter(
        (item) => item.warehouse_name?.trim() === selectedWarehouse.trim(),
      );
    }

    return result;
  }, [data, selectedWarehouse, isShowroomUser, isWarehouseUser]);

  /* ========== Warehouse buttons ========== */
  const warehouseOptions: WarehouseFilter[] =
    !isShowroomUser && !isWarehouseUser
      ? ["الكل", "المخزن الرئيسي", "مخزن المعرض"]
      : [];

  /* ========== Total deficit ========== */
  const totalDeficit = useMemo(
    () => filteredData.reduce((sum, item) => sum + item.current_stock, 0),
    [filteredData],
  );

  /* ========== Zero Out ========== */
  const handleZeroOut = async () => {
    // Determine which warehouse(s) to zero out
    const warehouseIds: number[] = [];
    if (selectedWarehouse === "مخزن المعرض" || isShowroomUser) {
      warehouseIds.push(1);
    } else if (selectedWarehouse === "المخزن الرئيسي" || isWarehouseUser) {
      warehouseIds.push(2);
    } else {
      // "الكل" — zero both
      warehouseIds.push(1, 2);
    }

    setZeroing(true);
    let totalItems = 0;
    let failCount = 0;
    for (const wid of warehouseIds) {
      try {
        const { data } = await api.post("/invoices/zero-negative-stock", {
          warehouse_id: wid,
        });
        if (data.items_count) totalItems += data.items_count;
      } catch {
        failCount++;
      }
    }
    if (totalItems > 0) {
      toast.success(`تم تصفير ${totalItems} صنف سالب`);
    }
    if (failCount > 0 && totalItems === 0) {
      toast.error("فشل تصفير الأصناف السالبة");
    } else if (failCount > 0) {
      toast.warning("تم التصفير جزئياً — بعض المخازن فشلت");
    }
    fetchReport();
    setZeroing(false);
  };

  return (
    <PageContainer size="xl">
      <div dir="rtl" className="space-y-4 py-6">
        <h1 className="text-2xl font-bold text-center flex items-center justify-center gap-2">
          <TrendingDown className="h-6 w-6 text-red-500" />
          تقرير الأصناف السالبة
        </h1>

        {/* Warehouse filter */}
        <div className="flex justify-center gap-2 flex-wrap">
          {warehouseOptions.length > 0 &&
            warehouseOptions.map((w) => (
              <Button
                key={w}
                variant={selectedWarehouse === w ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedWarehouse(w)}
              >
                {w}
              </Button>
            ))}
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchReport}
            disabled={loading}
          >
            <RefreshCw
              className={`h-4 w-4 ml-1 ${loading ? "animate-spin" : ""}`}
            />
            تحديث
          </Button>

          {/* Zero out button */}
          {!loading && filteredData.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={zeroing}>
                  {zeroing ? (
                    <Loader2 className="h-4 w-4 ml-1 animate-spin" />
                  ) : (
                    <Eraser className="h-4 w-4 ml-1" />
                  )}
                  تصفير الأصناف السالبة
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                  <AlertDialogTitle>تصفير الأصناف السالبة؟</AlertDialogTitle>
                  <AlertDialogDescription className="text-right">
                    هيتم إنشاء فاتورة شراء تعديلية لتصفير{" "}
                    <strong>{filteredData.length}</strong> صنف سالب.
                    <br />
                    رصيد كل الأصناف دي هيبقى صفر بعد التصفير.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-row-reverse gap-2">
                  <AlertDialogAction
                    onClick={handleZeroOut}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    تأكيد التصفير
                  </AlertDialogAction>
                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>

        {/* Summary cards */}
        {!loading && filteredData.length > 0 && (
          <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
            <Card className="border-red-200 dark:border-red-800">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">عدد الأصناف</p>
                <p className="text-2xl font-bold text-red-600">
                  {filteredData.length}
                </p>
              </CardContent>
            </Card>
            <Card className="border-red-200 dark:border-red-800">
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">إجمالي العجز</p>
                <p className="text-2xl font-bold text-red-600">
                  {totalDeficit}
                </p>
              </CardContent>
            </Card>
          </div>
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
                      <TableHead className="text-center w-12">#</TableHead>
                      <TableHead className="text-right">الصنف</TableHead>
                      <TableHead className="text-center">الباركود</TableHead>
                      <TableHead className="text-center">المخزن</TableHead>
                      <TableHead className="text-center">العبوات</TableHead>
                      <TableHead className="text-center">
                        الرصيد الحالي
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.map((item, idx) => (
                      <TableRow
                        key={`${item.product_id}-${item.warehouse_name}`}
                        className="bg-red-50/50 dark:bg-red-950/10"
                      >
                        <TableCell className="text-center text-muted-foreground">
                          {idx + 1}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="font-medium">{item.product_name}</div>
                          {item.manufacturer_name && (
                            <div className="text-xs text-muted-foreground">
                              {item.manufacturer_name}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs">
                          {item.barcode || "—"}
                        </TableCell>
                        <TableCell className="text-center text-xs">
                          {item.warehouse_name}
                        </TableCell>
                        <TableCell className="text-center text-xs">
                          {item.package_name || "—"}
                        </TableCell>
                        <TableCell className="text-center font-bold text-red-600">
                          {item.current_stock}
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
        {!loading && filteredData.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <TrendingDown className="h-12 w-12 mx-auto mb-3 text-green-500" />
            <p className="text-lg font-medium">لا توجد أصناف سالبة 🎉</p>
            <p className="text-sm">كل الأصناف أرصدتها صفر أو أكثر</p>
          </div>
        )}

        {/* Count badge */}
        {!loading && filteredData.length > 0 && (
          <div className="text-center">
            <Badge variant="destructive">
              {filteredData.length} صنف بكمية سالبة
            </Badge>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
