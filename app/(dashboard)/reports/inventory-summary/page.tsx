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
import { Loader2, Printer, Search } from "lucide-react";
import { ExportButtons, type ExportColumn } from "@/components/export-buttons";
import { useRealtime } from "@/hooks/use-realtime";
import { Skeleton } from "@/components/ui/skeleton";
import { normalizePackageName } from "@/lib/package-stock";

const INVENTORY_SUMMARY_PRINT_STORAGE_KEY = "inventorySummaryPrintData";

const getWholesalePackageOnly = (value?: string | null) => {
  if (!value) return "";
  const firstPart = String(value).split("/")[0]?.trim();
  const withoutCartonWord = (firstPart || "")
    .replace(/^\s*كرتون(?:ة|ه)?\s*/, "")
    .trim();
  return withoutCartonWord || firstPart || "";
};

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

type MovementItem = {
  variant_id?: number | null;
  warehouse_name?: string | null;
  movement_type?: string | null;
  invoice_movement_type?: string | null;
  quantity?: number | null;
  package_name?: string | null;
};

type ReportProduct = {
  id: number;
  wholesale_package?: string | null;
  retail_package?: string | null;
};

type ProductVariant = {
  id?: number | null;
  product_id: number;
  wholesale_package?: string | null;
  retail_package?: string | null;
  package_name?: string | null;
};

const IN_MOVEMENT_TYPES = new Set([
  "purchase",
  "transfer_in",
  "replace_in",
  "return_sale",
  "in",
]);

type WarehouseFilter = "الكل" | "المخزن الرئيسي" | "مخزن المعرض";

/* ========== Component ========== */
export default function InventorySummaryPage() {
  const { user } = useAuth();
  const isShowroomUser = user?.branch_id === 1;
  const isWarehouseUser = user?.branch_id === 2;

  const [data, setData] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [packageLabelMap, setPackageLabelMap] = useState<Record<string, string>>(
    {},
  );
  const [accurateRowsByProductId, setAccurateRowsByProductId] = useState<
    Record<number, InventoryItem[]>
  >({});
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

  const filterMovementRowsByWarehouse = useCallback(
    (rows: MovementItem[]) => {
      let result = rows;

      if (isShowroomUser) {
        result = result.filter((item) =>
          (item.warehouse_name || "").trim().includes("المعرض"),
        );
      } else if (isWarehouseUser) {
        result = result.filter((item) => {
          const warehouseName = (item.warehouse_name || "").trim();
          return (
            warehouseName.includes("الرئيسي") ||
            warehouseName.includes("المخزن الرئيسي")
          );
        });
      }

      if (!isShowroomUser && !isWarehouseUser && selectedWarehouse !== "الكل") {
        result = result.filter(
          (item) =>
            (item.warehouse_name || "").trim() === selectedWarehouse.trim(),
        );
      }

      return result;
    },
    [isShowroomUser, isWarehouseUser, selectedWarehouse],
  );

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

  useEffect(() => {
    const productIds = Array.from(
      new Set(filteredData.map((item) => Number(item.product_id)).filter(Boolean)),
    );

    if (productIds.length === 0) {
      setPackageLabelMap({});
      return;
    }

    let cancelled = false;

    Promise.all([
      api.get("/reports/products"),
      api.get("/products/variants", {
        params: { product_ids: productIds.join(",") },
      }),
    ])
      .then(([productsRes, variantsRes]) => {
        if (cancelled) return;

        const reportProducts: ReportProduct[] = Array.isArray(productsRes.data)
          ? productsRes.data
          : [];
        const variants: ProductVariant[] = Array.isArray(variantsRes.data)
          ? variantsRes.data
          : [];

        const nextMap: Record<string, string> = {};
        const productIdSet = new Set(productIds);

        for (const product of reportProducts) {
          const productId = Number(product.id);
          if (!productIdSet.has(productId)) continue;

          nextMap[`${productId}:0`] = normalizePackageName(
            product.wholesale_package || product.retail_package || "—",
          );
        }

        for (const variant of variants) {
          const productId = Number(variant.product_id);
          const variantId = Number(variant.id || 0);
          if (!productIdSet.has(productId) || !variantId) continue;

          nextMap[`${productId}:${variantId}`] = normalizePackageName(
            variant.wholesale_package ||
              variant.package_name ||
              variant.retail_package ||
              "—",
          );
        }

        setPackageLabelMap(nextMap);
      })
      .catch(() => {
        if (cancelled) return;
        setPackageLabelMap({});
      });

    return () => {
      cancelled = true;
    };
  }, [filteredData]);

  useEffect(() => {
    const shouldRecalculate =
      filteredData.length > 0 &&
      (searchText.trim().length > 0 || filteredData.length <= 30);

    if (!shouldRecalculate) {
      setAccurateRowsByProductId({});
      return;
    }

    const uniqueProducts = Array.from(
      new Map(filteredData.map((item) => [item.product_id, item])).values(),
    );

    let cancelled = false;

    Promise.all(
      uniqueProducts.map(async (item) => {
        try {
          const res = await api.get("/reports/product-movement", {
            params: { product_name: item.product_name },
          });

          const movementRows = filterMovementRowsByWarehouse(
            Array.isArray(res.data) ? res.data : [],
          );

          const grouped = new Map<
            string,
            {
              warehouse_name: string;
              package_name: string;
              total_in: number;
              total_out: number;
            }
          >();

          for (const row of movementRows) {
            const qty = Number(row.quantity || 0);
            if (!Number.isFinite(qty) || qty === 0) continue;

            const warehouseName = (row.warehouse_name || "—").trim() || "—";
            const variantId = Number(row.variant_id || 0);
            const packageName =
              packageLabelMap[`${item.product_id}:${variantId}`] ||
              normalizePackageName(row.package_name || "—");
            const key = `${warehouseName}__${packageName}`;
            const existing = grouped.get(key) || {
              warehouse_name: warehouseName,
              package_name: packageName,
              total_in: 0,
              total_out: 0,
            };

            const movementType =
              row.movement_type || row.invoice_movement_type || "";

            if (IN_MOVEMENT_TYPES.has(movementType)) {
              existing.total_in += qty;
            } else {
              existing.total_out += qty;
            }

            grouped.set(key, existing);
          }

          const accurateRows = Array.from(grouped.values())
            .map((groupedRow) => ({
              product_id: item.product_id,
              product_name: item.product_name,
              manufacturer_name: item.manufacturer_name,
              barcode: item.barcode,
              warehouse_name: groupedRow.warehouse_name,
              total_in: groupedRow.total_in,
              total_out: groupedRow.total_out,
              current_stock: groupedRow.total_in - groupedRow.total_out,
              package_name: groupedRow.package_name,
            }))
            .sort((a, b) => {
              if (a.warehouse_name !== b.warehouse_name) {
                return a.warehouse_name.localeCompare(b.warehouse_name, "ar");
              }
              return (a.package_name || "").localeCompare(
                b.package_name || "",
                "ar",
              );
            });

          return [item.product_id, accurateRows] as const;
        } catch {
          return [item.product_id, []] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      setAccurateRowsByProductId(Object.fromEntries(entries));
    });

    return () => {
      cancelled = true;
    };
  }, [
    filteredData,
    filterMovementRowsByWarehouse,
    packageLabelMap,
    searchText,
  ]);

  const displayedData = useMemo(() => {
    const shouldUseAccurate =
      filteredData.length > 0 &&
      (searchText.trim().length > 0 || filteredData.length <= 30);

    if (!shouldUseAccurate) {
      return filteredData;
    }

    const result: InventoryItem[] = [];
    const handledProductIds = new Set<number>();

    for (const item of filteredData) {
      if (handledProductIds.has(item.product_id)) continue;
      handledProductIds.add(item.product_id);

      const accurateRows = accurateRowsByProductId[item.product_id];
      if (accurateRows && accurateRows.length > 0) {
        result.push(...accurateRows);
        continue;
      }

      result.push(
        ...filteredData.filter(
          (row) => row.product_id === item.product_id,
        ),
      );
    }

    return result;
  }, [accurateRowsByProductId, filteredData, searchText]);

  /* ========== Export columns ========== */
  const exportColumns: ExportColumn[] = [
    { header: "الصنف", key: "product_name_full", width: 30 },
    { header: "المخزن", key: "warehouse_name", width: 16 },
    { header: "العبوات", key: "package_name", width: 14 },
    { header: "وارد", key: "total_in", width: 10 },
    { header: "صادر", key: "total_out", width: 10 },
    { header: "الرصيد", key: "balance", width: 10 },
  ];

  const exportData = displayedData.map((item) => ({
    ...item,
    product_name_full:
      item.product_name +
      (item.manufacturer_name ? ` - ${item.manufacturer_name}` : ""),
    package_name: item.package_name || "—",
    total_in: Number(item.total_in || 0),
    total_out: Number(item.total_out || 0),
    balance: Number(item.total_in || 0) - Number(item.total_out || 0),
  }));

  const handlePrint = useCallback(() => {
    const printRows = displayedData.map((item) => {
      const totalIn = Number(item.total_in || 0);
      const totalOut = Number(item.total_out || 0);

      return {
        product_id: item.product_id,
        product_name: item.product_name,
        package_name: getWholesalePackageOnly(item.package_name),
        manufacturer_name: item.manufacturer_name || "",
        warehouse_name: item.warehouse_name || "",
        balance: totalIn - totalOut,
      };
    });

    localStorage.setItem(
      INVENTORY_SUMMARY_PRINT_STORAGE_KEY,
      JSON.stringify({
        rows: printRows,
        selectedWarehouse,
        searchText: searchText.trim(),
        printedAt: new Date().toISOString(),
      }),
    );

    window.open("/reports/inventory-summary/print", "_blank");
  }, [displayedData, searchText, selectedWarehouse]);

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
        {!loading && displayedData.length > 0 && (
          <div className="flex justify-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4" />
              طباعة الاسم والرصيد
            </Button>
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
        {!loading && displayedData.length > 0 && (
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
                    {displayedData.map((item, idx) => {
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
                {displayedData.map((item, idx) => {
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
        {!loading && displayedData.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            لا توجد بيانات
          </div>
        )}

        {/* Count badge */}
        {!loading && displayedData.length > 0 && (
          <div className="text-center">
            <Badge variant="secondary">{displayedData.length} صنف</Badge>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
