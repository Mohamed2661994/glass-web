"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import api from "@/services/api";
import {
  isStockAffectingEvent,
  onUpdate,
  STOCK_AFFECTING_EVENTS,
} from "@/lib/broadcast";
import {
  fetchResolvedProductQuantity,
  mergePackageVariants,
  prefetchResolvedProductQuantities,
} from "@/lib/package-stock";

// =====================================================
//  🏪  Product Cache — localStorage + auto-refresh
//  يتم تخزين بيانات الأصناف في localStorage
//  وتتحدث تلقائياً كل ساعة أو عند الطلب
// =====================================================

const CACHE_KEY_PREFIX = "products_cache_";
const VARIANTS_CACHE_KEY_PREFIX = "variants_cache_";
const RESOLVED_QTY_CACHE_KEY_PREFIX = "resolved_qty_cache_";
const CACHE_DURATION = 60 * 60 * 1000; // ساعة واحدة
const CACHE_VERSION = 3; // زيادة الرقم تمسح الكاش القديم تلقائي
const INVALIDATION_KEY = "products_cache_invalidated_at";

// =====================================================
//  🔔  Global listener — invalidate ALL product caches
//  when any invoice/transfer event fires, even if no
//  hook instance is mounted for that specific cache key
// =====================================================
if (typeof window !== "undefined") {
  const markInvalidated = () => {
    try {
      localStorage.setItem(INVALIDATION_KEY, Date.now().toString());
    } catch {}
  };

  const handleLocalInvalidation = (event: Event) => {
    const detail = (event as CustomEvent<{ type?: string }>).detail;
    if (isStockAffectingEvent(detail?.type)) {
      markInvalidated();
    }
  };

  // Same-tab events (CustomEvent dispatched by broadcastUpdate)
  window.addEventListener("glass_update", handleLocalInvalidation);

  // Cross-tab events (BroadcastChannel)
  try {
    if ("BroadcastChannel" in window) {
      const invalidationChannel = new BroadcastChannel("glass_system_updates");
      invalidationChannel.addEventListener("message", (e) => {
        const type = e.data?.type;
        if (isStockAffectingEvent(type)) {
          markInvalidated();
        }
      });
    }
  } catch {}
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  params: string; // JSON string of fetch params for comparison
  version?: number;
}

interface UseCachedProductsOptions {
  /** endpoint path — default: "/products" */
  endpoint?: string;
  /** query params for the products fetch */
  params?: Record<string, any>;
  /** whether to also fetch variants — default: false */
  fetchVariants?: boolean;
  /** cache duration in ms — default: 1 hour */
  cacheDuration?: number;
  /** whether to auto-fetch on mount — default: true */
  autoFetch?: boolean;
  /** unique cache key suffix — auto-generated from params if not provided */
  cacheKey?: string;
}

type ResolvedStockProduct = {
  id?: number | string | null;
  name?: string | null;
  available_quantity?: number | string | null;
  retail_package?: string | null;
  wholesale_package?: string | null;
  variant_stock?: any[] | null;
};

function getCacheKey(prefix: string, key: string) {
  return `${prefix}${key}`;
}

function getFromCache<T>(
  prefix: string,
  key: string,
  duration: number,
  params: string,
): T | null {
  try {
    const raw = localStorage.getItem(getCacheKey(prefix, key));
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);

    // Check global invalidation timestamp — if caches were invalidated
    // after this entry was saved, treat as expired
    const invalidatedAt = parseInt(
      localStorage.getItem(INVALIDATION_KEY) || "0",
      10,
    );
    if (invalidatedAt > entry.timestamp) return null;

    const isExpired = Date.now() - entry.timestamp > duration;
    const paramsMatch = entry.params === params;
    const versionMatch = entry.version === CACHE_VERSION;
    if (!isExpired && paramsMatch && versionMatch) return entry.data;
    return null;
  } catch {
    return null;
  }
}

function setCache<T>(prefix: string, key: string, data: T, params: string) {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      params,
      version: CACHE_VERSION,
    };
    localStorage.setItem(getCacheKey(prefix, key), JSON.stringify(entry));
  } catch {
    // localStorage might be full — silently fail
  }
}

export function useCachedProducts({
  endpoint = "/products",
  params = {},
  fetchVariants = false,
  cacheDuration = CACHE_DURATION,
  autoFetch = true,
  cacheKey,
}: UseCachedProductsOptions = {}) {
  const [products, setProducts] = useState<any[]>([]);
  const [variantsMap, setVariantsMap] = useState<Record<number, any[]>>({});
  const [resolvedAvailableQtyById, setResolvedAvailableQtyById] = useState<
    Record<number, number>
  >({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resolvingAvailableQtyRef = useRef<Record<number, boolean>>({});
  const fetchProductsRef = useRef<
    (forceRefresh?: boolean, silent?: boolean) => Promise<any[]>
  >(async () => []);
  const variantsRequestRef = useRef<
    Record<string, Promise<Record<number, any[]>>>
  >({});

  // Generate cache key from params if not provided
  const resolvedCacheKey = cacheKey || JSON.stringify({ endpoint, ...params });
  const paramsString = JSON.stringify(params);
  const requestParams = useMemo(() => params, [paramsString]);
  const quantityBranchId = Number(params.branch_id || 0);
  const shouldResolveAvailableQty =
    endpoint === "/products" && quantityBranchId > 0;
  const shouldUseVariants = fetchVariants || shouldResolveAvailableQty;
  const shouldPrefetchAllVariants = fetchVariants;
  const quantityPackageField =
    quantityBranchId === 1 || params.invoice_type === "retail"
      ? "retail_package"
      : "wholesale_package";

  const productById = useMemo(() => {
    const map: Record<number, ResolvedStockProduct> = {};
    products.forEach((product) => {
      map[Number(product.id)] = product as ResolvedStockProduct;
    });
    return map;
  }, [products]);

  const resetResolvedAvailableQty = useCallback(() => {
    resolvingAvailableQtyRef.current = {};
    setResolvedAvailableQtyById({});
    try {
      localStorage.removeItem(
        getCacheKey(RESOLVED_QTY_CACHE_KEY_PREFIX, resolvedCacheKey),
      );
    } catch {}
  }, [resolvedCacheKey]);

  const mergeResolvedAvailableQty = useCallback(
    (updates: Record<number, number>) => {
      if (Object.keys(updates).length === 0) {
        return;
      }

      setResolvedAvailableQtyById((prev) => {
        const next = { ...prev, ...updates };
        setCache(
          RESOLVED_QTY_CACHE_KEY_PREFIX,
          resolvedCacheKey,
          next,
          paramsString,
        );
        return next;
      });
    },
    [paramsString, resolvedCacheKey],
  );

  const mergeVariantsMap = useCallback(
    (updates: Record<number, any[]>) => {
      if (Object.keys(updates).length === 0) {
        return;
      }

      setVariantsMap((prev) => {
        const next = { ...prev, ...updates };
        setCache(
          VARIANTS_CACHE_KEY_PREFIX,
          resolvedCacheKey,
          next,
          paramsString,
        );
        return next;
      });
    },
    [paramsString, resolvedCacheKey],
  );

  const getResolvedAvailableQuantity = useCallback(
    (productOrId: number | ResolvedStockProduct | null | undefined) => {
      const productId =
        typeof productOrId === "number"
          ? productOrId
          : Number(productOrId?.id || 0);
      const fallbackQuantity =
        typeof productOrId === "object" && productOrId
          ? Number(productOrId.available_quantity) || 0
          : Number(productById[productId]?.available_quantity) || 0;

      return Number(resolvedAvailableQtyById[productId] ?? fallbackQuantity);
    },
    [productById, resolvedAvailableQtyById],
  );

  const ensureVariantsMap = useCallback(
    async (
      productsList: ResolvedStockProduct[],
      forceRefresh = false,
    ): Promise<Record<number, any[]>> => {
      if (!shouldUseVariants || productsList.length === 0) {
        return variantsMap;
      }

      let currentMap = variantsMap;

      if (!forceRefresh) {
        const cachedVariants = getFromCache<Record<number, any[]>>(
          VARIANTS_CACHE_KEY_PREFIX,
          resolvedCacheKey,
          cacheDuration,
          paramsString,
        );
        if (cachedVariants) {
          currentMap = { ...cachedVariants, ...currentMap };
          setVariantsMap(currentMap);
        }
      }

      const requestedIds = Array.from(
        new Set(
          productsList
            .map((product) => Number(product.id || 0))
            .filter((productId) => productId > 0),
        ),
      );

      if (requestedIds.length === 0) {
        return currentMap;
      }

      const missingIds = forceRefresh
        ? requestedIds
        : requestedIds.filter(
            (productId) =>
              !Object.prototype.hasOwnProperty.call(currentMap, productId),
          );

      if (missingIds.length === 0) {
        return currentMap;
      }

      try {
        const ids = missingIds.join(",");
        let request = variantsRequestRef.current[ids];

        if (!request) {
          request = api
            .get("/products/variants", {
              params: { product_ids: ids },
            })
            .then((vRes) => {
              const map: Record<number, any[]> = {};
              missingIds.forEach((productId) => {
                map[productId] = [];
              });
              for (const variant of vRes.data || []) {
                if (!map[variant.product_id]) map[variant.product_id] = [];
                map[variant.product_id].push(variant);
              }
              return map;
            })
            .finally(() => {
              delete variantsRequestRef.current[ids];
            });

          variantsRequestRef.current[ids] = request;
        }

        const map = await request;
        const nextMap = { ...currentMap, ...map };
        mergeVariantsMap(map);
        return nextMap;
      } catch {
        return currentMap;
      }
    },
    [
      cacheDuration,
      mergeVariantsMap,
      paramsString,
      resolvedCacheKey,
      shouldUseVariants,
      variantsMap,
    ],
  );

  const resolveAvailableQuantity = useCallback(
    async (productOrId: number | ResolvedStockProduct | null | undefined) => {
      const product =
        typeof productOrId === "object" && productOrId
          ? productOrId
          : productById[Number(productOrId || 0)];

      if (!product) return 0;

      const productId = Number(product.id || 0);
      const fallbackQuantity = Number(product.available_quantity) || 0;

      if (!shouldResolveAvailableQty || !productId) {
        return fallbackQuantity;
      }

      if (
        Object.prototype.hasOwnProperty.call(
          resolvedAvailableQtyById,
          productId,
        )
      ) {
        return Number(resolvedAvailableQtyById[productId] ?? fallbackQuantity);
      }

      if (resolvingAvailableQtyRef.current[productId]) {
        return fallbackQuantity;
      }

      resolvingAvailableQtyRef.current[productId] = true;

      try {
        const currentVariantsMap = await ensureVariantsMap([product]);
        const quantity = await fetchResolvedProductQuantity({
          productId,
          productName: String(product.name || ""),
          branchId: quantityBranchId,
          fallbackQuantity,
          basePackage:
            quantityPackageField === "retail_package"
              ? product.retail_package
              : product.wholesale_package,
          variants: mergePackageVariants(
            Array.isArray(product.variant_stock) ? product.variant_stock : [],
            currentVariantsMap[productId] || [],
          ),
          packageField: quantityPackageField,
        });

        mergeResolvedAvailableQty({ [productId]: quantity });

        return quantity;
      } catch {
        mergeResolvedAvailableQty({ [productId]: fallbackQuantity });
        return fallbackQuantity;
      } finally {
        resolvingAvailableQtyRef.current[productId] = false;
      }
    },
    [
      ensureVariantsMap,
      mergeResolvedAvailableQty,
      productById,
      quantityBranchId,
      quantityPackageField,
      resolvedAvailableQtyById,
      shouldResolveAvailableQty,
    ],
  );

  const ensureResolvedAvailableQuantities = useCallback(
    async (
      productsList: Array<number | ResolvedStockProduct | null | undefined>,
    ) => {
      if (!shouldResolveAvailableQty) return;

      const normalizedProducts = productsList
        .map((product) => {
          if (!product) return null;
          return typeof product === "object"
            ? product
            : productById[Number(product || 0)] || null;
        })
        .filter((product): product is ResolvedStockProduct => Boolean(product));

      const pendingProducts = normalizedProducts.filter((product) => {
        const productId = Number(product.id || 0);
        if (!productId) {
          return false;
        }

        if (
          Object.prototype.hasOwnProperty.call(
            resolvedAvailableQtyById,
            productId,
          ) ||
          resolvingAvailableQtyRef.current[productId]
        ) {
          return false;
        }

        resolvingAvailableQtyRef.current[productId] = true;
        return true;
      });

      if (pendingProducts.length === 0) {
        return;
      }

      try {
        const currentVariantsMap = await ensureVariantsMap(pendingProducts);
        const results = await prefetchResolvedProductQuantities({
          products: pendingProducts,
          branchId: quantityBranchId,
          variantsMap: currentVariantsMap,
          packageField: quantityPackageField,
          maxConcurrency: 4,
        });

        mergeResolvedAvailableQty(
          Object.fromEntries(
            results.map(({ productId, quantity }) => [productId, quantity]),
          ),
        );
      } catch {
        mergeResolvedAvailableQty(
          Object.fromEntries(
            pendingProducts.map((product) => [
              Number(product.id || 0),
              Number(product.available_quantity) || 0,
            ]),
          ),
        );
      } finally {
        pendingProducts.forEach((product) => {
          resolvingAvailableQtyRef.current[Number(product.id || 0)] = false;
        });
      }
    },
    [
      ensureVariantsMap,
      mergeResolvedAvailableQty,
      productById,
      quantityBranchId,
      quantityPackageField,
      resolvedAvailableQtyById,
      shouldResolveAvailableQty,
    ],
  );

  useEffect(() => {
    resolvingAvailableQtyRef.current = {};

    if (!shouldResolveAvailableQty) {
      setResolvedAvailableQtyById({});
      return;
    }

    const cachedResolved = getFromCache<Record<number, number>>(
      RESOLVED_QTY_CACHE_KEY_PREFIX,
      resolvedCacheKey,
      cacheDuration,
      paramsString,
    );
    setResolvedAvailableQtyById(cachedResolved || {});
  }, [
    cacheDuration,
    paramsString,
    resolvedCacheKey,
    shouldResolveAvailableQty,
  ]);

  const fetchProducts = useCallback(
    async (forceRefresh = false, silent = false) => {
      const hasVisibleProducts = products.length > 0;
      const shouldShowBlockingLoader = !silent && !hasVisibleProducts;
      const shouldTrackRefresh = silent || hasVisibleProducts;

      // When force-refreshing, mark ALL product caches as stale
      // so other components with different cache keys will also refetch
      if (forceRefresh) {
        try {
          localStorage.setItem(INVALIDATION_KEY, Date.now().toString());
        } catch {}

        resetResolvedAvailableQty();
      }

      // 1. Try cache first (unless force refresh)
      if (!forceRefresh) {
        const cached = getFromCache<any[]>(
          CACHE_KEY_PREFIX,
          resolvedCacheKey,
          cacheDuration,
          paramsString,
        );
        if (cached) {
          setProducts(cached);
          if (shouldResolveAvailableQty) {
            const cachedResolved = getFromCache<Record<number, number>>(
              RESOLVED_QTY_CACHE_KEY_PREFIX,
              resolvedCacheKey,
              cacheDuration,
              paramsString,
            );
            setResolvedAvailableQtyById(cachedResolved || {});
          }
          // Also try variants cache
          if (shouldUseVariants) {
            const cachedVariants = getFromCache<Record<number, any[]>>(
              VARIANTS_CACHE_KEY_PREFIX,
              resolvedCacheKey,
              cacheDuration,
              paramsString,
            );
            if (cachedVariants) {
              setVariantsMap(cachedVariants);
            }
          }
          // Get timestamp from cache
          try {
            const raw = localStorage.getItem(
              getCacheKey(CACHE_KEY_PREFIX, resolvedCacheKey),
            );
            if (raw) {
              const entry = JSON.parse(raw);
              setLastUpdated(new Date(entry.timestamp));
            }
          } catch {}
          return cached;
        }
      }

      // 2. Fetch from API
      try {
        if (shouldShowBlockingLoader) {
          setLoading(true);
        }
        if (shouldTrackRefresh) {
          setRefreshing(true);
        }

        const res = await api.get(endpoint, {
          params:
            Object.keys(requestParams).length > 0 ? requestParams : undefined,
        });
        const prods = res.data || [];
        setProducts(prods);
        setLastUpdated(new Date());

        if (shouldResolveAvailableQty) {
          const cachedResolved = getFromCache<Record<number, number>>(
            RESOLVED_QTY_CACHE_KEY_PREFIX,
            resolvedCacheKey,
            cacheDuration,
            paramsString,
          );
          setResolvedAvailableQtyById(cachedResolved || {});
        }

        // Save to cache
        setCache(CACHE_KEY_PREFIX, resolvedCacheKey, prods, paramsString);

        // 3. Fetch variants if needed
        if (shouldPrefetchAllVariants && prods.length > 0) {
          void ensureVariantsMap(prods, forceRefresh);
        }

        return prods;
      } catch {
        // If fetch fails, try stale cache as fallback
        try {
          const raw = localStorage.getItem(
            getCacheKey(CACHE_KEY_PREFIX, resolvedCacheKey),
          );
          if (raw) {
            const entry: CacheEntry<any[]> = JSON.parse(raw);
            setProducts(entry.data);
            setLastUpdated(new Date(entry.timestamp));
            return entry.data;
          }
        } catch {}
        return [];
      } finally {
        if (shouldShowBlockingLoader) {
          setLoading(false);
        }
        if (shouldTrackRefresh) {
          setRefreshing(false);
        }
      }
    },
    [
      cacheDuration,
      endpoint,
      ensureVariantsMap,
      paramsString,
      products.length,
      requestParams,
      resetResolvedAvailableQty,
      resolvedCacheKey,
      shouldPrefetchAllVariants,
      shouldResolveAvailableQty,
      shouldUseVariants,
    ],
  );

  useEffect(() => {
    fetchProductsRef.current = fetchProducts;
  }, [fetchProducts]);

  // Force refresh (bypasses cache)
  const refresh = useCallback(() => fetchProductsRef.current(true), []);
  const refreshSilently = useCallback(
    () => fetchProductsRef.current(true, true),
    [],
  );

  const scheduleSilentRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    refreshTimeoutRef.current = setTimeout(() => {
      refreshTimeoutRef.current = null;
      void fetchProductsRef.current(true, true);
    }, 150);
  }, []);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      void fetchProductsRef.current();
    }
  }, [autoFetch, paramsString, resolvedCacheKey]);

  // Auto-refresh every cacheDuration
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      void fetchProductsRef.current(true);
    }, cacheDuration);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    };
  }, [cacheDuration, paramsString, resolvedCacheKey]);

  // Auto-refresh when invoices/transfers are created or updated
  useEffect(() => {
    const cleanup = onUpdate(STOCK_AFFECTING_EVENTS, () => {
      scheduleSilentRefresh();
    });
    return cleanup;
  }, [scheduleSilentRefresh]);

  // Invalidate cache manually
  const invalidateCache = useCallback(() => {
    try {
      localStorage.removeItem(getCacheKey(CACHE_KEY_PREFIX, resolvedCacheKey));
      localStorage.removeItem(
        getCacheKey(VARIANTS_CACHE_KEY_PREFIX, resolvedCacheKey),
      );
      localStorage.removeItem(
        getCacheKey(RESOLVED_QTY_CACHE_KEY_PREFIX, resolvedCacheKey),
      );
    } catch {}
    resetResolvedAvailableQty();
  }, [resetResolvedAvailableQty, resolvedCacheKey]);

  return {
    products,
    setProducts,
    variantsMap,
    setVariantsMap,
    loading,
    refreshing,
    lastUpdated,
    resolvedAvailableQtyById,
    getResolvedAvailableQuantity,
    resolveAvailableQuantity,
    ensureResolvedAvailableQuantities,
    resetResolvedAvailableQty,
    refresh,
    refreshSilently,
    invalidateCache,
    fetchProducts,
  };
}

// =====================================================
//  🧹 Clear all product caches
// =====================================================
export function clearAllProductCaches() {
  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (
        key.startsWith(CACHE_KEY_PREFIX) ||
        key.startsWith(VARIANTS_CACHE_KEY_PREFIX) ||
        key.startsWith(RESOLVED_QTY_CACHE_KEY_PREFIX)
      ) {
        localStorage.removeItem(key);
      }
    }
  } catch {}
}
