type StockSnapshot = {
  products: any[];
  variantsMap: Record<number, any[]>;
  resolvedQtyById: Record<number, number>;
  generatedAt: number;
};

type SnapshotCacheEntry = {
  data: StockSnapshot;
  timestamp: number;
  params: string;
  version: number;
};

type FetchStockSnapshotOptions = {
  endpoint: "/products" | "/products/for-replace";
  params?: Record<string, any>;
  cacheKey: string;
  cacheDuration?: number;
  forceRefresh?: boolean;
};

const INVALIDATION_KEY = "products_cache_invalidated_at";
const STOCK_SNAPSHOT_CACHE_KEY_PREFIX = "stock_snapshot_cache_";
const STOCK_SNAPSHOT_CACHE_VERSION = 1;
const STOCK_SNAPSHOT_CACHE_DURATION = 60 * 60 * 1000;
const inFlightSnapshots = new Map<string, Promise<StockSnapshot>>();

function getSnapshotCacheKey(key: string) {
  return `${STOCK_SNAPSHOT_CACHE_KEY_PREFIX}${key}`;
}

function getInvalidatedAt() {
  if (typeof window === "undefined") {
    return 0;
  }

  try {
    return parseInt(localStorage.getItem(INVALIDATION_KEY) || "0", 10) || 0;
  } catch {
    return 0;
  }
}

function readSnapshotEntry(key: string): SnapshotCacheEntry | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = localStorage.getItem(getSnapshotCacheKey(key));
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as SnapshotCacheEntry;
  } catch {
    return null;
  }
}

function writeSnapshotEntry(key: string, data: StockSnapshot, params: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(
      getSnapshotCacheKey(key),
      JSON.stringify({
        data,
        timestamp: Date.now(),
        params,
        version: STOCK_SNAPSHOT_CACHE_VERSION,
      } satisfies SnapshotCacheEntry),
    );
  } catch {}
}

export function getCachedStockSnapshot(
  cacheKey: string,
  params: Record<string, any> = {},
  cacheDuration = STOCK_SNAPSHOT_CACHE_DURATION,
): StockSnapshot | null {
  const entry = readSnapshotEntry(cacheKey);
  if (!entry) {
    return null;
  }

  const paramsString = JSON.stringify(params || {});
  if (
    entry.version !== STOCK_SNAPSHOT_CACHE_VERSION ||
    entry.params !== paramsString
  ) {
    return null;
  }

  if (getInvalidatedAt() > entry.timestamp) {
    return null;
  }

  if (Date.now() - entry.timestamp > cacheDuration) {
    return null;
  }

  return entry.data;
}

export function getStaleStockSnapshot(
  cacheKey: string,
  params: Record<string, any> = {},
): StockSnapshot | null {
  const entry = readSnapshotEntry(cacheKey);
  if (!entry) {
    return null;
  }

  const paramsString = JSON.stringify(params || {});
  if (
    entry.version !== STOCK_SNAPSHOT_CACHE_VERSION ||
    entry.params !== paramsString
  ) {
    return null;
  }

  return entry.data;
}

export async function fetchStockSnapshot({
  endpoint,
  params = {},
  cacheKey,
  forceRefresh = false,
}: FetchStockSnapshotOptions): Promise<StockSnapshot> {
  const paramsString = JSON.stringify(params || {});
  const inFlightKey = JSON.stringify({ endpoint, cacheKey, paramsString, forceRefresh });
  const pending = inFlightSnapshots.get(inFlightKey);
  if (pending) {
    return pending;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (typeof window !== "undefined") {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    } catch {}
  }

  const request = fetch("/api/stock/snapshot", {
    method: "POST",
    headers,
    body: JSON.stringify({
      endpoint,
      params,
      cacheKey,
      invalidateAfter: getInvalidatedAt(),
      forceRefresh,
    }),
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Stock snapshot request failed: ${response.status}`);
      }

      const payload = (await response.json()) as Partial<StockSnapshot>;
      const snapshot: StockSnapshot = {
        products: Array.isArray(payload?.products) ? payload.products : [],
        variantsMap:
          payload && payload.variantsMap && typeof payload.variantsMap === "object"
            ? payload.variantsMap
            : {},
        resolvedQtyById:
          payload &&
          payload.resolvedQtyById &&
          typeof payload.resolvedQtyById === "object"
            ? payload.resolvedQtyById
            : {},
        generatedAt: Number(payload?.generatedAt || Date.now()),
      };

      writeSnapshotEntry(cacheKey, snapshot, paramsString);
      return snapshot;
    })
    .finally(() => {
      inFlightSnapshots.delete(inFlightKey);
    });

  inFlightSnapshots.set(inFlightKey, request);
  return request;
}

export async function loadStockSnapshot({
  endpoint,
  params = {},
  cacheKey,
  cacheDuration = STOCK_SNAPSHOT_CACHE_DURATION,
  forceRefresh = false,
}: FetchStockSnapshotOptions): Promise<StockSnapshot> {
  if (!forceRefresh) {
    const cached = getCachedStockSnapshot(cacheKey, params, cacheDuration);
    if (cached) {
      return cached;
    }
  }

  return fetchStockSnapshot({
    endpoint,
    params,
    cacheKey,
    cacheDuration,
    forceRefresh,
  });
}

export function warmStockSnapshot(options: FetchStockSnapshotOptions) {
  void loadStockSnapshot(options).catch(() => {
    // Ignore warm-up failures.
  });
}

export type { StockSnapshot };
