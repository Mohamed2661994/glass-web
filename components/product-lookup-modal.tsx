"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCachedProducts } from "@/hooks/use-cached-products";
import { highlightText } from "@/lib/highlight-text";
import {
  fetchPackageStockMapFromMovements,
  normalizePackageName,
  type PackageStockMap,
} from "@/lib/package-stock";
import { multiWordMatch, multiWordScore } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: number;
}

export function ProductLookupModal({ open, onOpenChange, branchId }: Props) {
  const [search, setSearch] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const invoiceType = branchId === 1 ? "retail" : "wholesale";
  const otherBranchId = branchId === 1 ? 2 : 1;
  const otherInvoiceType = branchId === 1 ? "wholesale" : "retail";

  /* =========================================================
     Fetch products (Cached — localStorage + auto-refresh)
     ========================================================= */
  const { products, loading, refresh } = useCachedProducts({
    endpoint: "/products",
    params: {
      branch_id: branchId,
      invoice_type: invoiceType,
      movement_type: "sale",
    },
    cacheKey: `lookup_${invoiceType}`,
  });

  const {
    products: otherBranchProducts,
    loading: otherLoading,
    refresh: refreshOther,
  } = useCachedProducts({
    endpoint: "/products",
    params: {
      branch_id: otherBranchId,
      invoice_type: otherInvoiceType,
      movement_type: "sale",
    },
    cacheKey: `lookup_${otherInvoiceType}`,
  });

  // Map of product id -> available_quantity for the other branch
  const otherBranchQtyMap = useMemo(() => {
    const map: Record<number, number> = {};
    otherBranchProducts.forEach((p) => {
      map[p.id] = Number(p.available_quantity) || 0;
    });
    return map;
  }, [otherBranchProducts]);

  // Map of product id -> variant_stock for the other branch
  const otherBranchVariantsMap = useMemo(() => {
    const map: Record<number, any[]> = {};
    otherBranchProducts.forEach((p) => {
      if (p.variant_stock && p.variant_stock.length > 0) {
        map[p.id] = p.variant_stock;
      }
    });
    return map;
  }, [otherBranchProducts]);

  const [packageStockMapByKey, setPackageStockMapByKey] = useState<
    Record<string, PackageStockMap>
  >({});
  const packageStockLoadingRef = useRef<Record<string, boolean>>({});

  const [refreshing, setRefreshing] = useState(false);

  // Force refresh every time the modal opens so data is always fresh
  useEffect(() => {
    if (!open) return;
    setSearch("");
    setFocusedIndex(-1);
    setPackageStockMapByKey({});
    packageStockLoadingRef.current = {};
    // Silent refresh — checks cache validity (invalidation key) and refetches if needed
    refresh();
    refreshOther();
  }, [open]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refresh(), refreshOther()]);
    } finally {
      setRefreshing(false);
    }
  };

  /* =========================================================
     Filtered products
     ========================================================= */
  const filteredProducts = useMemo(() => {
    const filtered = products.filter((p) => {
      // For wholesale branch, only show products with wholesale package
      if (invoiceType === "wholesale") {
        const wp = (p.wholesale_package || "").trim();
        const hasWholesale =
          p.has_wholesale !== false && wp !== "" && wp !== "كرتونة 0";
        if (!hasWholesale) return false;
      }
      return multiWordMatch(
        search,
        String(p.id),
        p.name,
        p.description,
        p.barcode,
        p.manufacturer,
      );
    });

    return filtered.sort((a, b) => {
      // Relevance sort when searching
      if (search.trim()) {
        const scoreA = multiWordScore(
          search,
          a.name,
          String(a.id),
          a.description,
          a.barcode,
          a.manufacturer,
        );
        const scoreB = multiWordScore(
          search,
          b.name,
          String(b.id),
          b.description,
          b.barcode,
          b.manufacturer,
        );
        if (scoreA !== scoreB) return scoreB - scoreA;
      }
      const aInStock = Number(a.available_quantity) > 0 ? 1 : 0;
      const bInStock = Number(b.available_quantity) > 0 ? 1 : 0;
      if (aInStock !== bInStock) return bInStock - aInStock;
      return String(a.name || "").localeCompare(String(b.name || ""), "ar");
    });
  }, [products, search]);

  const buildPackageBalances = useCallback(
    ({
      basePackage,
      totalQuantity,
      variantRows,
      quantityMap,
      labelField = "package_name",
    }: {
      basePackage?: string | null;
      totalQuantity?: number | null;
      variantRows?: any[];
      quantityMap?: Record<number, number>;
      labelField?: "package_name" | "retail_package";
    }) => {
      const grouped = new Map<string, number>();
      const variantLabels = new Map<number, string>();
      const rows = Array.isArray(variantRows) ? variantRows : [];
      const normalizedBase = normalizePackageName(basePackage);
      const hasQuantityMap = quantityMap !== undefined;

      let rowsTotal = 0;
      rows.forEach((row: any) => {
        const variantId = Number(row?.variant_id ?? 0);
        const rawLabel =
          labelField === "retail_package"
            ? row?.retail_package
            : row?.package_name;
        const normalizedLabel = normalizePackageName(
          rawLabel || basePackage || "-",
        );

        variantLabels.set(variantId, normalizedLabel);

        if (!hasQuantityMap) {
          const qty = Number(row?.quantity || 0);
          rowsTotal += qty;
          grouped.set(
            normalizedLabel,
            (grouped.get(normalizedLabel) || 0) + qty,
          );
        }
      });

      if (hasQuantityMap) {
        let mappedTotal = 0;

        Object.entries(quantityMap || {}).forEach(([variantId, qtyValue]) => {
          const qty = Number(qtyValue) || 0;
          const normalizedLabel =
            variantLabels.get(Number(variantId)) || normalizedBase;

          grouped.set(
            normalizedLabel,
            (grouped.get(normalizedLabel) || 0) + qty,
          );
          mappedTotal += qty;
        });

        const hasExplicitBase =
          Object.prototype.hasOwnProperty.call(quantityMap || {}, "0") ||
          variantLabels.has(0);

        if (!hasExplicitBase) {
          const remainder = Number(totalQuantity || 0) - mappedTotal;
          if (Math.abs(remainder) > 0.0001) {
            grouped.set(
              normalizedBase,
              (grouped.get(normalizedBase) || 0) + remainder,
            );
          }
        }
      } else if (rows.length > 0 && !variantLabels.has(0)) {
        const remainder = Number(totalQuantity || 0) - rowsTotal;
        if (Math.abs(remainder) > 0.0001) {
          grouped.set(
            normalizedBase,
            (grouped.get(normalizedBase) || 0) + remainder,
          );
        }
      }

      const entries = Array.from(grouped.entries())
        .map(([pkg, qty]) => ({ package: pkg, quantity: Number(qty) || 0 }))
        .filter(
          (entry) =>
            entry.package &&
            entry.package !== "-" &&
            entry.package !== "بدون عبوة" &&
            !Number.isNaN(entry.quantity),
        )
        .sort((a, b) => a.package.localeCompare(b.package, "ar"));

      if (entries.length === 0 && normalizedBase && normalizedBase !== "-") {
        return [
          {
            package: normalizedBase,
            quantity: Number(totalQuantity || 0) || 0,
          },
        ];
      }

      return entries;
    },
    [],
  );

  const getPackageStockKey = useCallback(
    (
      productId: number,
      targetBranchId: number,
      packageField: "wholesale_package" | "retail_package",
    ) => `${productId}:${targetBranchId}:${packageField}`,
    [],
  );

  useEffect(() => {
    if (!open) return;

    const candidates = filteredProducts.slice(0, 30);
    candidates.forEach((product) => {
      const currentVariants = Array.isArray(product.variant_stock)
        ? product.variant_stock
        : [];
      const otherVariants = otherBranchVariantsMap[product.id] || currentVariants;

      const requests: Array<{
        targetBranchId: number;
        basePackage?: string | null;
        variants?: any[];
        packageField: "wholesale_package" | "retail_package";
      }> = [];

      if (branchId === 2 && product.wholesale_package) {
        requests.push({
          targetBranchId: branchId,
          basePackage: product.wholesale_package,
          variants: currentVariants,
          packageField: "wholesale_package",
        });
      }

      if (branchId === 1 && product.wholesale_package) {
        requests.push({
          targetBranchId: otherBranchId,
          basePackage: product.wholesale_package,
          variants: otherVariants,
          packageField: "wholesale_package",
        });
      }

      if (branchId === 2 && product.retail_package) {
        requests.push({
          targetBranchId: otherBranchId,
          basePackage: product.retail_package,
          variants: otherVariants,
          packageField: "retail_package",
        });
      }

      requests.forEach(
        ({ targetBranchId, basePackage, variants, packageField }) => {
          const key = getPackageStockKey(
            product.id,
            targetBranchId,
            packageField,
          );

          if (Object.prototype.hasOwnProperty.call(packageStockMapByKey, key)) {
            return;
          }

          if (packageStockLoadingRef.current[key]) {
            return;
          }

          packageStockLoadingRef.current[key] = true;
          fetchPackageStockMapFromMovements({
            productName: product.name,
            branchId: targetBranchId,
            basePackage,
            variants,
            packageField,
          })
            .then((stockMap) => {
              setPackageStockMapByKey((prev) => ({
                ...prev,
                [key]: stockMap,
              }));
            })
            .catch(() => {
              setPackageStockMapByKey((prev) => ({
                ...prev,
                [key]: {},
              }));
            })
            .finally(() => {
              packageStockLoadingRef.current[key] = false;
            });
        },
      );
    });
  }, [
    branchId,
    open,
    filteredProducts,
    getPackageStockKey,
    otherBranchId,
    otherBranchVariantsMap,
    packageStockMapByKey,
  ]);

  /* =========================================================
     Keyboard navigation
     ========================================================= */
  // Find next available (in-stock) product index
  const findNextAvailable = useCallback(
    (startIndex: number, direction: 1 | -1): number => {
      let idx = startIndex + direction;
      while (idx >= 0 && idx < filteredProducts.length) {
        if (Number(filteredProducts[idx].available_quantity) > 0) {
          return idx;
        }
        idx += direction;
      }
      return -1;
    },
    [filteredProducts],
  );

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        // Find first in-stock product
        const firstAvailable = filteredProducts.findIndex(
          (p) => Number(p.available_quantity) > 0,
        );
        if (firstAvailable !== -1) {
          setFocusedIndex(firstAvailable);
          setTimeout(() => {
            const firstItem = listRef.current?.querySelector(
              `[data-product-index='${firstAvailable}']`,
            ) as HTMLElement;
            firstItem?.focus();
          }, 0);
        }
      }
    },
    [filteredProducts],
  );

  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>, index: number) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = findNextAvailable(index, 1);
        if (next !== -1) {
          setFocusedIndex(next);
          const el = listRef.current?.querySelector(
            `[data-product-index='${next}']`,
          ) as HTMLElement;
          el?.focus();
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = findNextAvailable(index, -1);
        if (prev !== -1) {
          setFocusedIndex(prev);
          const el = listRef.current?.querySelector(
            `[data-product-index='${prev}']`,
          ) as HTMLElement;
          el?.focus();
        } else {
          setFocusedIndex(-1);
          searchInputRef.current?.focus();
        }
      } else if (e.key === "Escape") {
        onOpenChange(false);
      }
    },
    [findNextAvailable, onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="max-w-2xl p-0 flex flex-col"
        style={{ height: 700, maxHeight: "90vh" }}
      >
        <DialogHeader className="p-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Search className="size-5" />
            استعلام عن الأصناف
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Input
              ref={searchInputRef}
              autoFocus
              placeholder="ابحث بالاسم أو الوصف أو الباركود... (Enter للنزول)"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setFocusedIndex(-1);
              }}
              onKeyDown={handleSearchKeyDown}
              onFocus={(e) => e.target.select()}
              className="flex-1"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={refreshing}
              title="تحديث الأصناف"
              className="shrink-0"
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
          {!loading && (
            <div className="text-xs text-muted-foreground mt-2">
              عدد النتائج: {filteredProducts.length} صنف
            </div>
          )}
        </div>

        <div
          ref={listRef}
          className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-2"
        >
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-3 rounded-lg border space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              لا توجد نتائج
            </div>
          ) : (
            filteredProducts.map((product, index) => {
              const outOfStock = Number(product.available_quantity) <= 0;
              const currentVariants = Array.isArray(product.variant_stock)
                ? product.variant_stock
                : [];
              const otherVariants = otherBranchVariantsMap[product.id];
              const currentWholesaleQuantityMap =
                branchId === 2
                  ? packageStockMapByKey[
                      getPackageStockKey(
                        product.id,
                        branchId,
                        "wholesale_package",
                      )
                    ]
                  : undefined;
              const otherWholesaleQuantityMap =
                branchId === 1
                  ? packageStockMapByKey[
                      getPackageStockKey(
                        product.id,
                        otherBranchId,
                        "wholesale_package",
                      )
                    ]
                  : undefined;
              const otherRetailQuantityMap =
                branchId === 2
                  ? packageStockMapByKey[
                      getPackageStockKey(
                        product.id,
                        otherBranchId,
                        "retail_package",
                      )
                    ]
                  : undefined;

              const currentWholesaleEntries =
                currentWholesaleQuantityMap !== undefined
                  ? buildPackageBalances({
                      basePackage: product.wholesale_package,
                      totalQuantity: product.available_quantity,
                      variantRows: currentVariants,
                      quantityMap: currentWholesaleQuantityMap,
                      labelField: "package_name",
                    })
                  : [];

              const otherWholesaleEntries =
                otherWholesaleQuantityMap !== undefined
                  ? buildPackageBalances({
                      basePackage: product.wholesale_package,
                      totalQuantity: otherBranchQtyMap[product.id],
                      variantRows:
                        otherVariants && otherVariants.length > 0
                          ? otherVariants
                          : currentVariants,
                      quantityMap: otherWholesaleQuantityMap,
                      labelField: "package_name",
                    })
                  : [];

              const otherRetailEntries =
                otherRetailQuantityMap !== undefined
                  ? buildPackageBalances({
                      basePackage: product.retail_package,
                      totalQuantity: otherBranchQtyMap[product.id],
                      variantRows:
                        otherVariants && otherVariants.length > 0
                          ? otherVariants
                          : currentVariants,
                      quantityMap: otherRetailQuantityMap,
                      labelField: "retail_package",
                    })
                  : [];

              return (
                <div
                  key={product.id}
                  data-product-index={index}
                  tabIndex={outOfStock ? -1 : 0}
                  onKeyDown={(e) => !outOfStock && handleListKeyDown(e, index)}
                  className={`p-3 rounded-lg border transition outline-none ${
                    outOfStock
                      ? "opacity-50 cursor-not-allowed bg-muted/30"
                      : `hover:bg-muted ${focusedIndex === index ? "ring-2 ring-primary bg-muted" : ""}`
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">
                      {highlightText(product.name, search)}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {outOfStock && (
                        <span className="text-[10px] bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full font-medium">
                          نفذ
                        </span>
                      )}
                      {product.barcode && (
                        <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                          {highlightText(product.barcode, search)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-xs mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    <span className="text-muted-foreground">
                      المصنع: {highlightText(product.manufacturer || "-", search)}
                    </span>
                    <span className="text-blue-600 dark:text-blue-400">
                      العبوة: {product.retail_package || "-"}
                    </span>
                    <span className="font-semibold text-blue-700 dark:text-blue-300">
                      السعر: {invoiceType === "retail" ? product.price : product.retail_price}
                    </span>
                    {product.discount_amount > 0 && (
                      <span className="text-destructive">
                        خصم: {product.discount_amount}
                      </span>
                    )}
                  </div>

                  {product.wholesale_package && (
                    <div className="text-xs mt-1 flex flex-wrap gap-x-4 gap-y-1 text-orange-600 dark:text-orange-400">
                      {product.variant_stock && product.variant_stock.length > 1 ? (
                        <>
                          {product.variant_stock.map(
                            (
                              vs: {
                                variant_id: number;
                                package_name: string;
                                quantity: number;
                                price: number | null;
                              },
                              idx: number,
                            ) => {
                              const variantPrice =
                                vs.price ??
                                (vs.variant_id === 0 ? product.wholesale_price : null);
                              return (
                                <span key={vs.variant_id ?? idx}>
                                  {vs.package_name}:{" "}
                                  <span className="font-semibold">
                                    {variantPrice ?? product.wholesale_price}
                                  </span>
                                </span>
                              );
                            },
                          )}
                        </>
                      ) : (
                        <>
                          <span>عبوة جملة: {product.wholesale_package}</span>
                          {product.wholesale_price != null &&
                            Number(product.wholesale_price) > 0 && (
                              <span className="font-semibold">
                                سعر الجملة: {product.wholesale_price}
                              </span>
                            )}
                        </>
                      )}
                    </div>
                  )}

                  <div className="text-xs mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                    {branchId === 2 && currentWholesaleEntries.length > 1 ? (
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        <span className="text-muted-foreground">رصيد الجملة:</span>
                        {currentWholesaleEntries.map((entry) => (
                          <span
                            key={entry.package}
                            className={
                              entry.quantity > 0
                                ? "text-orange-600 dark:text-orange-400 font-semibold"
                                : "text-red-500 font-semibold"
                            }
                          >
                            {entry.package}: {entry.quantity}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span
                        className={
                          Number(product.available_quantity) > 0
                            ? branchId === 1
                              ? "text-blue-600 dark:text-blue-400 font-semibold"
                              : "text-orange-600 dark:text-orange-400 font-semibold"
                            : "text-red-500 font-semibold"
                        }
                      >
                        رصيد {branchId === 1 ? "القطاعي" : "الجملة"}: {product.available_quantity}
                      </span>
                    )}

                    {branchId === 1 ? (
                      otherWholesaleEntries.length > 1 ? (
                        <div className="flex flex-wrap gap-x-3 gap-y-1">
                          <span className="text-muted-foreground">رصيد الجملة:</span>
                          {otherWholesaleEntries.map((entry) => (
                            <span
                              key={entry.package}
                              className={
                                entry.quantity > 0
                                  ? "text-orange-600 dark:text-orange-400 font-semibold"
                                  : "text-red-500 font-semibold"
                              }
                            >
                              {entry.package}: {entry.quantity}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span
                          className={
                            (otherWholesaleEntries[0]?.quantity ?? 0) > 0
                              ? "text-orange-600 dark:text-orange-400 font-semibold"
                              : "text-red-500 font-semibold"
                          }
                        >
                          رصيد الجملة: {otherWholesaleEntries[0]?.quantity ?? (otherBranchQtyMap[product.id] ?? "-")}
                        </span>
                      )
                    ) : otherRetailEntries.length > 1 ? (
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        <span className="text-muted-foreground">رصيد القطاعي:</span>
                        {otherRetailEntries.map((entry) => (
                          <span
                            key={entry.package}
                            className={
                              entry.quantity > 0
                                ? "text-blue-600 dark:text-blue-400 font-semibold"
                                : "text-red-500 font-semibold"
                            }
                          >
                            {entry.package}: {entry.quantity}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span
                        className={
                          (otherRetailEntries[0]?.quantity ?? 0) > 0
                            ? "text-blue-600 dark:text-blue-400 font-semibold"
                            : "text-red-500 font-semibold"
                        }
                      >
                        رصيد القطاعي: {otherRetailEntries[0]?.quantity ?? (otherBranchQtyMap[product.id] ?? "-")}
                      </span>
                    )}
                  </div>

                  {product.description && (
                    <div className="text-xs text-muted-foreground mt-1 opacity-70">
                      {highlightText(product.description, search)}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
