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
import { multiWordMatch, multiWordScore } from "@/lib/utils";
import api from "@/services/api";

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

  const [otherBranchVariantQtyMap, setOtherBranchVariantQtyMap] = useState<
    Record<number, Record<number, number>>
  >({});
  const otherBranchQtyLoadingRef = useRef<Record<number, boolean>>({});

  const [refreshing, setRefreshing] = useState(false);

  // Force refresh every time the modal opens so data is always fresh
  useEffect(() => {
    if (!open) return;
    setSearch("");
    setFocusedIndex(-1);
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

        if (!quantityMap) {
          const qty = Number(row?.quantity || 0);
          rowsTotal += qty;
          grouped.set(normalizedLabel, (grouped.get(normalizedLabel) || 0) + qty);
        }
      });

      if (quantityMap && Object.keys(quantityMap).length > 0) {
        let mappedTotal = 0;

        Object.entries(quantityMap).forEach(([variantId, qtyValue]) => {
          const qty = Number(qtyValue) || 0;
          const normalizedLabel =
            variantLabels.get(Number(variantId)) || normalizedBase;

          grouped.set(normalizedLabel, (grouped.get(normalizedLabel) || 0) + qty);
          mappedTotal += qty;
        });

        const hasExplicitBase =
          Object.prototype.hasOwnProperty.call(quantityMap, "0") ||
          variantLabels.has(0);

        if (!hasExplicitBase) {
          const remainder = Number(totalQuantity || 0) - mappedTotal;
          if (Math.abs(remainder) > 0.0001) {
            grouped.set(normalizedBase, (grouped.get(normalizedBase) || 0) + remainder);
          }
        }
      } else if (rows.length > 0 && !variantLabels.has(0)) {
        const remainder = Number(totalQuantity || 0) - rowsTotal;
        if (Math.abs(remainder) > 0.0001) {
          grouped.set(normalizedBase, (grouped.get(normalizedBase) || 0) + remainder);
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
    [normalizePackageName],
  );

  useEffect(() => {
    if (!open) return;

    const candidates = filteredProducts.slice(0, 30);
    candidates.forEach((product) => {
      const hasOtherVariants =
        (otherBranchVariantsMap[product.id] || []).length > 0;
      const hasCurrentVariants = (product.variant_stock || []).length > 0;

      if (!hasOtherVariants && !hasCurrentVariants) return;
      if (otherBranchVariantQtyMap[product.id]) return;
      if (otherBranchQtyLoadingRef.current[product.id]) return;

      otherBranchQtyLoadingRef.current[product.id] = true;
      api
        .get("/stock/quantity-all", {
          params: { product_id: product.id, branch_id: otherBranchId },
        })
        .then((res) => {
          setOtherBranchVariantQtyMap((prev) => ({
            ...prev,
            [product.id]: res.data || {},
          }));
        })
        .catch(() => {
          setOtherBranchVariantQtyMap((prev) => ({
            ...prev,
            [product.id]: {},
          }));
        })
        .finally(() => {
          otherBranchQtyLoadingRef.current[product.id] = false;
        });
    });
  }, [
    open,
    filteredProducts,
    otherBranchId,
    otherBranchVariantsMap,
    otherBranchVariantQtyMap,
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
                    {(() => {
                      const currentWholesaleEntries = buildPackageBalances({
                        basePackage: product.wholesale_package,
                        totalQuantity: product.available_quantity,
                        variantRows: product.variant_stock,
                        labelField: "package_name",
                      });

                      if (branchId === 2 && currentWholesaleEntries.length > 1) {
                        return (
                          <div className="flex flex-wrap gap-x-3 gap-y-1">
                            <span className="text-muted-foreground">
                              رصيد الجملة:
                            </span>
                            {currentWholesaleEntries.map((entry) => (
                              <span
                                key={entry.package}
                                className={
                                  Number(entry.quantity) > 0
                                    ? "text-orange-600 dark:text-orange-400 font-semibold"
                                    : "text-red-500 font-semibold"
                                }
                              >
                                {entry.package}: {entry.quantity}
                              </span>
                            ))}
                          </div>
                        );
                      }

                      return (
                        <span
                          className={
                            Number(product.available_quantity) > 0
                              ? branchId === 1
                                ? "text-blue-600 dark:text-blue-400 font-semibold"
                                : "text-orange-600 dark:text-orange-400 font-semibold"
                              : "text-red-500 font-semibold"
                          }
                        >
                          رصيد {branchId === 1 ? "القطاعي" : "الجملة"}: {" "}
                          {product.available_quantity}
                        </span>
                      );
                    })()}

                    {/* Other branch balance - show detailed if variants exist */}
                    {(() => {
                      const otherVariants = otherBranchVariantsMap[product.id];
                      const otherBranchVariantQty =
                        otherBranchVariantQtyMap[product.id];

                      if (branchId === 1) {
                        const wholesaleEntries = buildPackageBalances({
                          basePackage: product.wholesale_package,
                          totalQuantity: otherBranchQtyMap[product.id],
                          variantRows:
                            otherVariants && otherVariants.length > 0
                              ? otherVariants
                              : product.variant_stock,
                          quantityMap: otherBranchVariantQty,
                          labelField: "package_name",
                        });

                        if (wholesaleEntries.length > 1) {
                          return (
                            <div className="flex flex-wrap gap-x-3 gap-y-1">
                              <span className="text-muted-foreground">
                                رصيد الجملة:
                              </span>
                              {wholesaleEntries.map((entry) => (
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
                          );
                        }

                        if (wholesaleEntries.length === 1) {
                          const onlyQty = wholesaleEntries[0]?.quantity ?? 0;
                          return (
                            <span
                              className={
                                onlyQty > 0
                                  ? "text-orange-600 dark:text-orange-400 font-semibold"
                                  : "text-red-500 font-semibold"
                              }
                            >
                              رصيد الجملة: {onlyQty}
                            </span>
                          );
                        }
                      }

                      const retailEntries = buildPackageBalances({
                        basePackage: product.retail_package,
                        totalQuantity: otherBranchQtyMap[product.id],
                        variantRows:
                          otherVariants && otherVariants.length > 0
                            ? otherVariants
                            : product.variant_stock,
                        quantityMap: otherBranchVariantQty,
                        labelField: "retail_package",
                      });

                      if (retailEntries.length > 1) {
                        return (
                          <div className="flex flex-wrap gap-x-3 gap-y-1">
                            <span className="text-muted-foreground">
                              رصيد القطاعي:
                            </span>
                            {retailEntries.map((entry) => (
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
                        );
                      }

                      if (retailEntries.length === 1) {
                        const onlyQty = retailEntries[0]?.quantity ?? 0;
                        return (
                          <span
                            className={
                              onlyQty > 0
                                ? "text-blue-600 dark:text-blue-400 font-semibold"
                                : "text-red-500 font-semibold"
                            }
                          >
                            رصيد القطاعي: {onlyQty}
                          </span>
                        );
                      }

                      return (
                        <span
                          className={
                            (otherBranchQtyMap[product.id] || 0) > 0
                              ? branchId === 1
                                ? "text-orange-600 dark:text-orange-400 font-semibold"
                                : "text-blue-600 dark:text-blue-400 font-semibold"
                              : "text-red-500 font-semibold"
                          }
                        >
                          رصيد {branchId === 1 ? "الجملة" : "القطاعي"}: {" "}
                          {otherBranchQtyMap[product.id] ?? "-"}
                        </span>
                      );
                    })()}

                        const retailEntries = Object.entries(retailGroups);
                        if (retailEntries.length === 1) {
                          const onlyQty = retailEntries[0]?.[1] ?? 0;
                          return (
                            <span
                              className={
                                onlyQty > 0
                                  ? "text-blue-600 dark:text-blue-400 font-semibold"
                                  : "text-red-500 font-semibold"
                              }
                            >
                              رصيد القطاعي: {onlyQty}
                            </span>
                          );
                        }

                        return (
                          <div className="flex flex-wrap gap-x-3 gap-y-1">
                            <span className="text-muted-foreground">
                              رصيد القطاعي:
                            </span>
                            {retailEntries.map(([pkg, qty]) => (
                              <span
                                key={pkg}
                                className={
                                  qty > 0
                                    ? "text-blue-600 dark:text-blue-400 font-semibold"
                                    : "text-red-500 font-semibold"
                                }
                              >
                                {pkg}: {qty}
                              </span>
                            ))}
                          </div>
                        );
                      }

                      if (
                        otherBranchVariantQty &&
                        Object.keys(otherBranchVariantQty).length > 0
                      ) {
                        if (branchId === 1) {
                          // Fallback: build wholesale packages from current variants
                          const variantPkgMap = new Map<number, string>();
                          product.variant_stock?.forEach(
                            (vs: {
                              variant_id: number;
                              package_name: string;
                            }) => {
                              variantPkgMap.set(
                                Number(vs.variant_id ?? 0),
                                String(vs.package_name || "-"),
                              );
                            },
                          );

                          const wholesaleGroups: Record<string, number> = {};
                          Object.entries(otherBranchVariantQty).forEach(
                            ([variantId, qty]) => {
                              const pkg =
                                variantPkgMap.get(Number(variantId)) ||
                                product.wholesale_package ||
                                "-";
                              wholesaleGroups[pkg] =
                                (wholesaleGroups[pkg] || 0) +
                                (Number(qty) || 0);
                            },
                          );

                          const wholesaleEntries =
                            Object.entries(wholesaleGroups);
                          if (wholesaleEntries.length === 1) {
                            const onlyQty = wholesaleEntries[0]?.[1] ?? 0;
                            return (
                              <span
                                className={
                                  onlyQty > 0
                                    ? "text-orange-600 dark:text-orange-400 font-semibold"
                                    : "text-red-500 font-semibold"
                                }
                              >
                                رصيد الجملة: {onlyQty}
                              </span>
                            );
                          }

                          return (
                            <div className="flex flex-wrap gap-x-3 gap-y-1">
                              <span className="text-muted-foreground">
                                رصيد الجملة:
                              </span>
                              {wholesaleEntries.map(([pkg, qty]) => (
                                <span
                                  key={pkg}
                                  className={
                                    qty > 0
                                      ? "text-orange-600 dark:text-orange-400 font-semibold"
                                      : "text-red-500 font-semibold"
                                  }
                                >
                                  {pkg}: {qty}
                                </span>
                              ))}
                            </div>
                          );
                        }

                        // Fallback: build retail packages from current variants
                        const retailGroups: Record<string, number> = {};
                        const variantRetailMap = new Map<number, string>();
                        product.variant_stock?.forEach(
                          (vs: {
                            variant_id: number;
                            retail_package?: string;
                          }) => {
                            variantRetailMap.set(
                              Number(vs.variant_id ?? 0),
                              String(
                                vs.retail_package ||
                                  product.retail_package ||
                                  "-",
                              ),
                            );
                          },
                        );

                        Object.entries(otherBranchVariantQty).forEach(
                          ([variantId, qty]) => {
                            const retailPkg =
                              variantRetailMap.get(Number(variantId)) ||
                              product.retail_package ||
                              "-";
                            retailGroups[retailPkg] =
                              (retailGroups[retailPkg] || 0) +
                              (Number(qty) || 0);
                          },
                        );

                        const retailEntries = Object.entries(retailGroups);
                        if (retailEntries.length === 1) {
                          const onlyQty = retailEntries[0]?.[1] ?? 0;
                          return (
                            <span
                              className={
                                onlyQty > 0
                                  ? "text-blue-600 dark:text-blue-400 font-semibold"
                                  : "text-red-500 font-semibold"
                              }
                            >
                              رصيد القطاعي: {onlyQty}
                            </span>
                          );
                        }

                        return (
                          <div className="flex flex-wrap gap-x-3 gap-y-1">
                            <span className="text-muted-foreground">
                              رصيد القطاعي:
                            </span>
                            {retailEntries.map(([pkg, qty]) => (
                              <span
                                key={pkg}
                                className={
                                  qty > 0
                                    ? "text-blue-600 dark:text-blue-400 font-semibold"
                                    : "text-red-500 font-semibold"
                                }
                              >
                                {pkg}: {qty}
                              </span>
                            ))}
                          </div>
                        );
                      }

                      // No variants or single variant in other branch -> show total
                      return (
                        <span
                          className={
                            (otherBranchQtyMap[product.id] || 0) > 0
                              ? branchId === 1
                                ? "text-orange-600 dark:text-orange-400 font-semibold"
                                : "text-blue-600 dark:text-blue-400 font-semibold"
                              : "text-red-500 font-semibold"
                          }
                        >
                          رصيد {branchId === 1 ? "الجملة" : "القطاعي"}:{" "}
                          {otherBranchQtyMap[product.id] ?? "-"}
                        </span>
                      );
                    })()}
                  </div>

                  {/* Row 3: Description if exists */}
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
