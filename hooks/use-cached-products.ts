"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import api from "@/services/api";

// =====================================================
//  🏪  Product Cache — localStorage + auto-refresh
//  يتم تخزين بيانات الأصناف في localStorage
//  وتتحدث تلقائياً كل ساعة أو عند الطلب
// =====================================================

const CACHE_KEY_PREFIX = "products_cache_";
const VARIANTS_CACHE_KEY_PREFIX = "variants_cache_";
const CACHE_DURATION = 60 * 60 * 1000; // ساعة واحدة

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  params: string; // JSON string of fetch params for comparison
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

function getCacheKey(prefix: string, key: string) {
  return `${prefix}${key}`;
}

function getFromCache<T>(prefix: string, key: string, duration: number, params: string): T | null {
  try {
    const raw = localStorage.getItem(getCacheKey(prefix, key));
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    const isExpired = Date.now() - entry.timestamp > duration;
    const paramsMatch = entry.params === params;
    if (!isExpired && paramsMatch) return entry.data;
    return null;
  } catch {
    return null;
  }
}

function setCache<T>(prefix: string, key: string, data: T, params: string) {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now(), params };
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
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Generate cache key from params if not provided
  const resolvedCacheKey = cacheKey || JSON.stringify({ endpoint, ...params });
  const paramsString = JSON.stringify(params);

  const fetchProducts = useCallback(
    async (forceRefresh = false) => {
      // 1. Try cache first (unless force refresh)
      if (!forceRefresh) {
        const cached = getFromCache<any[]>(
          CACHE_KEY_PREFIX,
          resolvedCacheKey,
          cacheDuration,
          paramsString
        );
        if (cached) {
          setProducts(cached);
          // Also try variants cache
          if (fetchVariants) {
            const cachedVariants = getFromCache<Record<number, any[]>>(
              VARIANTS_CACHE_KEY_PREFIX,
              resolvedCacheKey,
              cacheDuration,
              paramsString
            );
            if (cachedVariants) setVariantsMap(cachedVariants);
          }
          // Get timestamp from cache
          try {
            const raw = localStorage.getItem(
              getCacheKey(CACHE_KEY_PREFIX, resolvedCacheKey)
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
        setLoading(true);
        const res = await api.get(endpoint, {
          params: Object.keys(params).length > 0 ? params : undefined,
        });
        const prods = res.data || [];
        setProducts(prods);
        setLastUpdated(new Date());

        // Save to cache
        setCache(CACHE_KEY_PREFIX, resolvedCacheKey, prods, paramsString);

        // 3. Fetch variants if needed
        if (fetchVariants && prods.length > 0) {
          try {
            const ids = prods.map((p: any) => p.id).join(",");
            const vRes = await api.get("/products/variants", {
              params: { product_ids: ids },
            });
            const map: Record<number, any[]> = {};
            for (const v of vRes.data || []) {
              if (!map[v.product_id]) map[v.product_id] = [];
              map[v.product_id].push(v);
            }
            setVariantsMap(map);
            setCache(VARIANTS_CACHE_KEY_PREFIX, resolvedCacheKey, map, paramsString);
          } catch {
            /* silent */
          }
        }

        return prods;
      } catch {
        // If fetch fails, try stale cache as fallback
        try {
          const raw = localStorage.getItem(
            getCacheKey(CACHE_KEY_PREFIX, resolvedCacheKey)
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
        setLoading(false);
      }
    },
    [endpoint, paramsString, resolvedCacheKey, fetchVariants, cacheDuration]
  );

  // Force refresh (bypasses cache)
  const refresh = useCallback(() => fetchProducts(true), [fetchProducts]);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetchProducts();
    }
  }, [autoFetch, fetchProducts]);

  // Auto-refresh every cacheDuration
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      fetchProducts(true);
    }, cacheDuration);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchProducts, cacheDuration]);

  // Invalidate cache manually
  const invalidateCache = useCallback(() => {
    try {
      localStorage.removeItem(getCacheKey(CACHE_KEY_PREFIX, resolvedCacheKey));
      localStorage.removeItem(
        getCacheKey(VARIANTS_CACHE_KEY_PREFIX, resolvedCacheKey)
      );
    } catch {}
  }, [resolvedCacheKey]);

  return {
    products,
    setProducts,
    variantsMap,
    setVariantsMap,
    loading,
    lastUpdated,
    refresh,
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
        key.startsWith(VARIANTS_CACHE_KEY_PREFIX)
      ) {
        localStorage.removeItem(key);
      }
    }
  } catch {}
}
