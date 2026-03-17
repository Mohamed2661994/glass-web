import api from "@/services/api";

const PRODUCT_PACKAGE_CACHE_KEY = "product-package-meta:v1";
const PRODUCT_PACKAGE_CACHE_TTL_MS = 10 * 60 * 1000;

export type ProductPackageMeta = {
  id: number;
  manufacturer?: string | null;
  manufacturer_name?: string | null;
  retail_package?: string | null;
  wholesale_package?: string | null;
  is_active?: boolean | string | number | null;
  has_wholesale?: boolean | string | number | null;
  wholesale_price?: number | string | null;
};

type StoredProductPackageCache = {
  expiresAt: number;
  items: ProductPackageMeta[];
};

type ProductPackageCacheEntry = StoredProductPackageCache & {
  map: Map<number, ProductPackageMeta>;
};

let memoryCache: ProductPackageCacheEntry | null = null;
let inFlight: Promise<Map<number, ProductPackageMeta>> | null = null;

function buildProductPackageMap(items: ProductPackageMeta[]) {
  return new Map<number, ProductPackageMeta>(
    items
      .filter((item) => Number(item?.id || 0) > 0)
      .map((item) => [Number(item.id), item]),
  );
}

function setProductPackageCache(
  items: ProductPackageMeta[],
  expiresAt: number,
) {
  const payload: ProductPackageCacheEntry = {
    expiresAt,
    items,
    map: buildProductPackageMap(items),
  };

  memoryCache = payload;

  if (typeof window === "undefined") {
    return payload;
  }

  try {
    localStorage.setItem(
      PRODUCT_PACKAGE_CACHE_KEY,
      JSON.stringify({ expiresAt, items } satisfies StoredProductPackageCache),
    );
  } catch {
    /* ignore cache write failures */
  }

  return payload;
}

function readStoredProductPackageCache() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = localStorage.getItem(PRODUCT_PACKAGE_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as StoredProductPackageCache;
    if (!parsed || !Array.isArray(parsed.items)) {
      return null;
    }

    if (Number(parsed.expiresAt || 0) <= Date.now()) {
      localStorage.removeItem(PRODUCT_PACKAGE_CACHE_KEY);
      return null;
    }

    return setProductPackageCache(parsed.items, Number(parsed.expiresAt));
  } catch {
    return null;
  }
}

export function getCachedProductPackageMap() {
  if (memoryCache && memoryCache.expiresAt > Date.now()) {
    return new Map(memoryCache.map);
  }

  const stored = readStoredProductPackageCache();
  return stored ? new Map(stored.map) : new Map<number, ProductPackageMeta>();
}

export async function fetchProductPackageMap(options?: { force?: boolean }) {
  const force = options?.force === true;
  const cached = getCachedProductPackageMap();
  if (!force && cached.size > 0) {
    return cached;
  }

  if (inFlight) {
    const shared = await inFlight;
    return new Map(shared);
  }

  inFlight = (async () => {
    const response = await api.get("/admin/products", {
      params: { active: "all" },
    });

    const items: ProductPackageMeta[] = Array.isArray(response.data)
      ? response.data
      : [];

    const expiresAt = Date.now() + PRODUCT_PACKAGE_CACHE_TTL_MS;
    return setProductPackageCache(items, expiresAt).map;
  })();

  try {
    const map = await inFlight;
    return new Map(map);
  } finally {
    inFlight = null;
  }
}

export function warmProductPackageMap() {
  void fetchProductPackageMap();
}
