"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "@/services/api";
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
  buildPackagePickerOptions,
  getPackageVariantId,
  mergePackageVariants,
  normalizePackageName,
  prefetchMovementBalances,
  type PackageVariant,
} from "@/lib/package-stock";
import { multiWordMatch, multiWordScore } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: number;
}

type LookupProduct = {
  id: number;
  name?: string;
  description?: string;
  barcode?: string;
  manufacturer?: string;
  retail_package?: string;
  wholesale_package?: string;
  has_wholesale?: boolean;
  price?: number | string | null;
  retail_price?: number | string | null;
  wholesale_price?: number | string | null;
  discount_amount?: number | string | null;
  variant_stock?: PackageVariant[];
};

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
  const {
    products,
    variantsMap,
    loading,
    refresh,
    refreshSilently,
    refreshing,
    getResolvedAvailableQuantity,
    ensureResolvedAvailableQuantities,
  } = useCachedProducts({
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
    refresh: refreshOther,
    refreshSilently: refreshOtherSilently,
    getResolvedAvailableQuantity: getOtherBranchResolvedAvailableQuantity,
    ensureResolvedAvailableQuantities:
      ensureOtherBranchResolvedAvailableQuantities,
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
      map[p.id] = getOtherBranchResolvedAvailableQuantity(p);
    });
    return map;
  }, [getOtherBranchResolvedAvailableQuantity, otherBranchProducts]);

  const [packageStockByKey, setPackageStockByKey] = useState<
    Record<string, Record<number, number>>
  >({});
  const [wholesaleMovementEntriesByKey, setWholesaleMovementEntriesByKey] =
    useState<Record<string, Array<{ package: string; quantity: number }>>>({});
  const packageStockLoadingRef = useRef<Record<string, boolean>>({});

  const getWholesalePackageRows = useCallback(
    (product: LookupProduct) => {
      const rows = new Map<
        string,
        { key: string; label: string; price: number | string | null }
      >();

      const getVariantWholesaleLabel = (variant: PackageVariant) =>
        String(
          variant.wholesale_package ||
            variant.package_name ||
            variant.retail_package ||
            "",
        ).trim();

      const addRow = (
        rawLabel: string | null | undefined,
        price: number | string | null | undefined,
        keyHint: string,
      ) => {
        const label = String(rawLabel || "").trim();
        if (!label || label === "-" || label === "كرتونة 0") {
          return;
        }

        const normalized = normalizePackageName(label);
        const existing = rows.get(normalized);

        if (!existing) {
          rows.set(normalized, {
            key: `${normalized}:${keyHint}`,
            label,
            price: price ?? null,
          });
          return;
        }

        if ((Number(existing.price) || 0) <= 0 && (Number(price) || 0) > 0) {
          rows.set(normalized, {
            ...existing,
            price: price ?? existing.price ?? null,
          });
        }
      };

      addRow(product.wholesale_package, product.wholesale_price, "base");

      const mergedVariants = mergePackageVariants(
        Array.isArray(product.variant_stock) ? product.variant_stock : [],
        variantsMap[product.id] || [],
      );

      mergedVariants.forEach((variant, index) => {
        addRow(
          getVariantWholesaleLabel(variant),
          variant.wholesale_price ?? variant.price,
          String(getPackageVariantId(variant) || index + 1),
        );
      });

      return Array.from(rows.values()).sort((left, right) =>
        left.label.localeCompare(right.label, "ar"),
      );
    },
    [variantsMap],
  );

  // Refresh silently every time the modal opens so the UI stays instant.
  useEffect(() => {
    if (!open) return;
    const resetTimer = window.setTimeout(() => {
      setSearch("");
      setFocusedIndex(-1);
      setPackageStockByKey({});
      setWholesaleMovementEntriesByKey({});
    }, 0);
    packageStockLoadingRef.current = {};
    refreshSilently();
    refreshOtherSilently();
    return () => {
      window.clearTimeout(resetTimer);
    };
  }, [open, refreshOtherSilently, refreshSilently]);

  const handleRefresh = async () => {
    await Promise.all([refresh(), refreshOther()]);
  };

  const getBalanceKey = useCallback(
    (productId: number, targetBranchId: number) =>
      `${productId}:${targetBranchId}`,
    [],
  );

  const getProductPackageVariants = useCallback(
    (product: LookupProduct) =>
      mergePackageVariants(
        Array.isArray(product.variant_stock) ? product.variant_stock : [],
        variantsMap[product.id] || [],
      ),
    [variantsMap],
  );

  const getDisplayQuantity = useCallback(
    (product: LookupProduct, targetBranchId: number) => {
      if (targetBranchId === branchId) {
        return getResolvedAvailableQuantity(product);
      }

      return Number(otherBranchQtyMap[product.id]) || 0;
    },
    [branchId, getResolvedAvailableQuantity, otherBranchQtyMap],
  );

  const getWholesaleBalanceRows = useCallback(
    (product: LookupProduct, targetBranchId: number) => {
      if (targetBranchId !== 2) {
        return [] as Array<{ key: string; label: string; quantity: number }>;
      }

      const packageRows = getWholesalePackageRows(product);
      if (packageRows.length === 0) {
        return [] as Array<{ key: string; label: string; quantity: number }>;
      }

      const stockKey = getBalanceKey(product.id, targetBranchId);
      const movementEntries = wholesaleMovementEntriesByKey[stockKey];
      if (Array.isArray(movementEntries) && movementEntries.length > 0) {
        const quantityByPackage = new Map<string, number>();

        movementEntries.forEach((entry) => {
          const normalized = normalizePackageName(entry.package);
          quantityByPackage.set(normalized, Number(entry.quantity) || 0);
        });

        return packageRows.map((pkg) => {
          const normalized = normalizePackageName(pkg.label);
          return {
            key: `${targetBranchId}:${normalized}`,
            label: pkg.label,
            quantity: quantityByPackage.get(normalized) ?? 0,
          };
        });
      }

      const quantityMap = packageStockByKey[stockKey];
      if (!quantityMap) {
        return [] as Array<{ key: string; label: string; quantity: number }>;
      }

      const packageOptions = buildPackagePickerOptions({
        basePackage: product.wholesale_package,
        totalQuantity: getDisplayQuantity(product, targetBranchId),
        variants: getProductPackageVariants(product),
        quantityMap,
        packageField: "wholesale_package",
        fallbackPrice: Number(product.wholesale_price) || 0,
      });

      const quantityByPackage = new Map<string, number>();

      packageOptions.forEach((option) => {
        const normalized = normalizePackageName(option.packageName);
        quantityByPackage.set(normalized, Number(option.quantity) || 0);
      });

      const rows = packageRows.map((pkg) => {
        const normalized = normalizePackageName(pkg.label);
        return {
          key: `${targetBranchId}:${normalized}`,
          label: pkg.label,
          quantity: quantityByPackage.get(normalized) ?? 0,
        };
      });

      return rows;
    },
    [
      buildPackagePickerOptions,
      getBalanceKey,
      getDisplayQuantity,
      getProductPackageVariants,
      getWholesalePackageRows,
      packageStockByKey,
      wholesaleMovementEntriesByKey,
    ],
  );

  /* =========================================================
     Filtered products
     ========================================================= */
  const filteredProducts = useMemo(() => {
    const filtered = products.filter((p) => {
      // For wholesale branch, only show products with wholesale package
      if (invoiceType === "wholesale") {
        const hasWholesale =
          p.has_wholesale !== false && getWholesalePackageRows(p).length > 0;
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

        const nameCompare = String(a.name || "").localeCompare(
          String(b.name || ""),
          "ar",
        );
        if (nameCompare !== 0) return nameCompare;

        return Number(a.id || 0) - Number(b.id || 0);
      }

      // Without search, keep in-stock items first.
      const aInStock = getDisplayQuantity(a, branchId) > 0 ? 1 : 0;
      const bInStock = getDisplayQuantity(b, branchId) > 0 ? 1 : 0;
      if (aInStock !== bInStock) return bInStock - aInStock;

      return String(a.name || "").localeCompare(String(b.name || ""), "ar");
    });
  }, [
    branchId,
    getDisplayQuantity,
    getWholesalePackageRows,
    invoiceType,
    products,
    search,
  ]);

  useEffect(() => {
    if (!open) return;

    const candidates = filteredProducts.slice(0, 30);
    ensureResolvedAvailableQuantities(candidates);
    ensureOtherBranchResolvedAvailableQuantities(
      candidates.map((product) => product.id),
    );
  }, [
    ensureOtherBranchResolvedAvailableQuantities,
    ensureResolvedAvailableQuantities,
    filteredProducts,
    open,
  ]);

  useEffect(() => {
    if (!open) return;

    const candidates = filteredProducts.slice(0, 30);
    const multiWholesaleCandidates = candidates.filter(
      (product) => getWholesalePackageRows(product).length > 1,
    );
    const targetBranchId = branchId === 2 ? 2 : otherBranchId === 2 ? 2 : 0;
    if (targetBranchId !== 2 || multiWholesaleCandidates.length === 0) {
      return;
    }

    const pendingKeys: Array<{ productId: number; key: string }> = [];

    multiWholesaleCandidates.forEach((product) => {
      const key = getBalanceKey(product.id, targetBranchId);
      if (
        Object.prototype.hasOwnProperty.call(packageStockByKey, key) ||
        packageStockLoadingRef.current[key]
      ) {
        return;
      }

      packageStockLoadingRef.current[key] = true;
      pendingKeys.push({ productId: product.id, key });
    });

    if (pendingKeys.length === 0) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const pendingKeySet = new Set(pendingKeys.map(({ key }) => key));

      const movementResults = await prefetchMovementBalances({
        products: multiWholesaleCandidates,
        branchIds: [targetBranchId],
        maxConcurrency: 6,
        shouldSkip: (productId, branchIdValue) =>
          branchIdValue !== targetBranchId ||
          !pendingKeySet.has(getBalanceKey(productId, branchIdValue)),
      }).catch(() => []);

      const movementEntriesByKey = new Map<
        string,
        Array<{ package: string; quantity: number }>
      >();

      movementResults.forEach(
        ({ productId, branchId: branchIdValue, result }) => {
          const key = getBalanceKey(productId, branchIdValue);
          if (Array.isArray(result?.entries) && result.entries.length > 0) {
            movementEntriesByKey.set(key, result.entries);
          }
        },
      );

      const fallbackResults = await Promise.all(
        pendingKeys
          .filter(({ key }) => !movementEntriesByKey.has(key))
          .map(async ({ productId, key }) => {
            try {
              const response = await api.get("/stock/quantity-all", {
                params: {
                  product_id: productId,
                  branch_id: targetBranchId,
                },
              });

              return {
                key,
                stockMap: Object.fromEntries(
                  Object.entries(response.data || {}).map(
                    ([variantId, quantity]) => [
                      Number(variantId),
                      Number(quantity) || 0,
                    ],
                  ),
                ) as Record<number, number>,
              };
            } catch {
              return {
                key,
                stockMap: null,
              };
            }
          }),
      );

      return {
        fallbackResults,
        movementEntriesByKey,
      };
    })()
      .then((results) => {
        if (cancelled || !results) {
          return;
        }

        setPackageStockByKey((prev) => {
          const next = { ...prev };
          results.fallbackResults.forEach(({ key, stockMap }) => {
            if (stockMap) {
              next[key] = stockMap;
            }
          });
          return next;
        });

        setWholesaleMovementEntriesByKey((prev) => {
          const next = { ...prev };
          results.movementEntriesByKey.forEach((movementEntries, key) => {
            next[key] = movementEntries;
          });
          return next;
        });
      })
      .finally(() => {
        pendingKeys.forEach(({ key }) => {
          packageStockLoadingRef.current[key] = false;
        });
      });

    return () => {
      cancelled = true;
      pendingKeys.forEach(({ key }) => {
        packageStockLoadingRef.current[key] = false;
      });
    };
  }, [
    branchId,
    filteredProducts,
    getBalanceKey,
    getWholesalePackageRows,
    otherBranchId,
    open,
    packageStockByKey,
  ]);

  /* =========================================================
     Keyboard navigation
     ========================================================= */
  // Find next available (in-stock) product index
  const findNextAvailable = useCallback(
    (startIndex: number, direction: 1 | -1): number => {
      let idx = startIndex + direction;
      while (idx >= 0 && idx < filteredProducts.length) {
        if (getDisplayQuantity(filteredProducts[idx], branchId) > 0) {
          return idx;
        }
        idx += direction;
      }
      return -1;
    },
    [branchId, filteredProducts, getDisplayQuantity],
  );

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        // Find first in-stock product
        const firstAvailable = filteredProducts.findIndex(
          (p) => getDisplayQuantity(p, branchId) > 0,
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
    [branchId, filteredProducts, getDisplayQuantity],
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
          {!loading && refreshing && filteredProducts.length > 0 && (
            <div className="text-xs text-muted-foreground mb-2 text-center">
              جاري تحديث الأصناف...
            </div>
          )}
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
              const wholesalePackageRows = getWholesalePackageRows(product);
              const currentBranchDisplayQuantity = getDisplayQuantity(
                product,
                branchId,
              );
              const currentBranchWholesaleBalances =
                branchId === 2
                  ? getWholesaleBalanceRows(product, branchId)
                  : [];

              const otherDisplayQuantity = getDisplayQuantity(
                product,
                otherBranchId,
              );
              const otherBranchWholesaleBalances =
                otherBranchId === 2
                  ? getWholesaleBalanceRows(product, otherBranchId)
                  : [];

              const outOfStock = currentBranchDisplayQuantity <= 0;

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
                      المصنع:{" "}
                      {highlightText(product.manufacturer || "-", search)}
                    </span>
                    <span className="text-blue-600 dark:text-blue-400">
                      العبوة: {product.retail_package || "-"}
                    </span>
                    <span className="font-semibold text-blue-700 dark:text-blue-300">
                      السعر:{" "}
                      {invoiceType === "retail"
                        ? product.price
                        : product.retail_price}
                    </span>
                    {product.discount_amount > 0 && (
                      <span className="text-destructive">
                        خصم: {product.discount_amount}
                      </span>
                    )}
                  </div>

                  {wholesalePackageRows.length > 0 && (
                    <div className="text-xs mt-1 flex flex-wrap gap-x-4 gap-y-1 text-orange-600 dark:text-orange-400">
                      {wholesalePackageRows.length > 1 ? (
                        <>
                          {wholesalePackageRows.map((pkg) => {
                            const variantPrice =
                              pkg.price ?? product.wholesale_price;
                            return (
                              <span key={pkg.key}>
                                {pkg.label}:{" "}
                                <span className="font-semibold">
                                  {variantPrice ?? product.wholesale_price}
                                </span>
                              </span>
                            );
                          })}
                        </>
                      ) : (
                        <>
                          <span>
                            عبوة جملة: {wholesalePackageRows[0].label}
                          </span>
                          {wholesalePackageRows[0].price != null &&
                            Number(wholesalePackageRows[0].price) > 0 && (
                              <span className="font-semibold">
                                سعر الجملة: {wholesalePackageRows[0].price}
                              </span>
                            )}
                        </>
                      )}
                    </div>
                  )}

                  <div className="text-xs mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                    {(branchId !== 2 ||
                      currentBranchWholesaleBalances.length <= 1) && (
                      <span
                        className={
                          currentBranchDisplayQuantity > 0
                            ? branchId === 1
                              ? "text-blue-600 dark:text-blue-400 font-semibold"
                              : "text-orange-600 dark:text-orange-400 font-semibold"
                            : "text-red-500 font-semibold"
                        }
                      >
                        {`رصيد ${branchId === 1 ? "القطاعي" : "الجملة"}`}:{" "}
                        {currentBranchDisplayQuantity}
                      </span>
                    )}

                    {branchId === 2 &&
                      currentBranchWholesaleBalances.length > 1 &&
                      currentBranchWholesaleBalances.map((row) => (
                        <span
                          key={row.key}
                          className={
                            row.quantity > 0
                              ? "text-orange-600 dark:text-orange-400 font-semibold"
                              : "text-red-500 font-semibold"
                          }
                        >
                          رصيد {row.label}: {row.quantity}
                        </span>
                      ))}

                    {branchId === 1 ? (
                      <>
                        {otherBranchWholesaleBalances.length <= 1 && (
                          <span
                            className={
                              otherDisplayQuantity > 0
                                ? "text-orange-600 dark:text-orange-400 font-semibold"
                                : "text-red-500 font-semibold"
                            }
                          >
                            رصيد الجملة: {otherDisplayQuantity || 0}
                          </span>
                        )}

                        {otherBranchWholesaleBalances.length > 1 &&
                          otherBranchWholesaleBalances.map((row) => (
                            <span
                              key={row.key}
                              className={
                                row.quantity > 0
                                  ? "text-orange-600 dark:text-orange-400 font-semibold"
                                  : "text-red-500 font-semibold"
                              }
                            >
                              رصيد {row.label}: {row.quantity}
                            </span>
                          ))}
                      </>
                    ) : (
                      <span
                        className={
                          otherDisplayQuantity > 0
                            ? "text-blue-600 dark:text-blue-400 font-semibold"
                            : "text-red-500 font-semibold"
                        }
                      >
                        رصيد القطاعي: {otherDisplayQuantity || 0}
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
