"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import api from "@/services/api";
import { multiWordMatch } from "@/lib/utils";
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
import { ExportButtons, type ExportColumn } from "@/components/export-buttons";
import { useRealtime } from "@/hooks/use-realtime";
import { Skeleton } from "@/components/ui/skeleton";

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

  /* ========== Export columns ========== */
  const exportColumns: ExportColumn[] = [
    { header: "الصنف", key: "product_name_full", width: 30 },
    { header: "المخزن", key: "warehouse_name", width: 16 },
    { header: "العبوات", key: "package_name", width: 14 },
    { header: "وارد", key: "total_in", width: 10 },
    { header: "صادر", key: "total_out", width: 10 },
    { header: "الرصيد", key: "balance", width: 10 },
  ];

  const exportData = filteredData.map((item) => ({
    ...item,
    product_name_full:
      item.product_name +
      (item.manufacturer_name ? ` - ${item.manufacturer_name}` : ""),
    package_name: item.package_name || "—",
    total_in: Number(item.total_in || 0),
    total_out: Number(item.total_out || 0),
    balance: Number(item.total_in || 0) - Number(item.total_out || 0),
  }));

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

        {/* Export buttons */}
        {!loading && filteredData.length > 0 && (
          <div className="flex justify-center">
            <ExportButtons
              tableRef={tableRef}
              columns={exportColumns}
              data={exportData}
              filename={`حركة-المخزون-${new Date().toISOString().slice(0, 10)}`}
              title="تقرير حركة المخزون"
              pdfOrientation="landscape"
            />
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">
                      <Skeleton className="h-4 w-20" />
                    </TableHead>
                    <TableHead className="text-center">
                      <Skeleton className="h-4 w-20 mx-auto" />
                    </TableHead>
                    <TableHead className="text-center">
                      <Skeleton className="h-4 w-20 mx-auto" />
                    </TableHead>
                    <TableHead className="text-center">
                      <Skeleton className="h-4 w-16 mx-auto" />
                    </TableHead>
                    <TableHead className="text-center">
                      <Skeleton className="h-4 w-16 mx-auto" />
                    </TableHead>
                    <TableHead className="text-center">
                      <Skeleton className="h-4 w-16 mx-auto" />
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...Array(10)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Skeleton className="h-4 w-40" />
                      </TableCell>
                      <TableCell className="text-center">
                        <Skeleton className="h-4 w-24 mx-auto" />
                      </TableCell>
                      <TableCell className="text-center">
                        <Skeleton className="h-4 w-16 mx-auto" />
                      </TableCell>
                      <TableCell className="text-center">
                        <Skeleton className="h-4 w-12 mx-auto" />
                      </TableCell>
                      <TableCell className="text-center">
                        <Skeleton className="h-4 w-12 mx-auto" />
                      </TableCell>
                      <TableCell className="text-center">
                        <Skeleton className="h-4 w-12 mx-auto" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
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
                      <TableHead className="text-center">وارد</TableHead>
                      <TableHead className="text-center">صادر</TableHead>
                      <TableHead className="text-center">الرصيد</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.map((item, idx) => {
                      const totalIn = Number(item.total_in || 0);
                      const totalOut = Number(item.total_out || 0);
                      const balance = totalIn - totalOut;

                      return (
                        <TableRow
                          key={`${item.product_id}-${item.warehouse_name}-${idx}`}
                        >
                          <TableCell className="text-right">
                            <Link
                              href={`/reports/product-movement?product=${encodeURIComponent(item.product_name)}`}
                              className="hover:text-primary hover:underline"
                            >
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
                            </Link>
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
                            {balance}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="md:hidden p-3 space-y-2" dir="rtl">
                {filteredData.map((item, idx) => {
                  const totalIn = Number(item.total_in || 0);
                  const totalOut = Number(item.total_out || 0);
                  const balance = totalIn - totalOut;

                  return (
                    <div
                      key={`m-${item.product_id}-${item.warehouse_name}-${idx}`}
                      className="rounded-lg border p-3 space-y-2 bg-card"
                    >
                      <div className="text-sm font-semibold leading-6">
                        <Link
                          href={`/reports/product-movement?product=${encodeURIComponent(item.product_name)}`}
                          className="hover:text-primary hover:underline"
                        >
                          {item.product_name}
                          {item.manufacturer_name && (
                            <span className="text-muted-foreground font-normal">
                              {" "}
                              - {item.manufacturer_name}
                            </span>
                          )}
                        </Link>
                      </div>

                      {item.barcode && (
                        <div className="text-xs text-muted-foreground font-mono">
                          {item.barcode}
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
                        <div className="rounded-md bg-muted/40 p-2">
                          <div className="text-muted-foreground">وارد</div>
                          <div className="font-bold text-green-600 mt-0.5">
                            {totalIn}
                          </div>
                        </div>
                        <div className="rounded-md bg-muted/40 p-2">
                          <div className="text-muted-foreground">صادر</div>
                          <div className="font-bold text-red-600 mt-0.5">
                            {totalOut}
                          </div>
                        </div>
                        <div className="rounded-md bg-muted/40 p-2 col-span-2">
                          <div className="text-muted-foreground">الرصيد</div>
                          <div className="font-bold mt-0.5">{balance}</div>
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
