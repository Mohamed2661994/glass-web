import api from "@/services/api";

export type PackageStockMap = Record<number, number>;

const REQUEST_CACHE_DURATION = 30 * 1000;
const INVALIDATION_KEY = "products_cache_invalidated_at";

type TimedCacheEntry<T> = {
  value: T;
  timestamp: number;
};

export type PackageVariant = {
  id?: number | null;
  variant_id?: number | null;
  wholesale_package?: string | null;
  retail_package?: string | null;
  package_name?: string | null;
  wholesale_price?: number | null;
  price?: number | null;
  label?: string | null;
  quantity?: number | null;
};

export type PackagePickerOption = {
  key: string;
  variantId: number;
  packageName: string;
  quantity: number;
  retailPackage?: string | null;
  price?: number | null;
  variant?: PackageVariant;
};

type ResolvedQuantityLookupProduct = {
  id?: number | string | null;
  name?: string | null;
  available_quantity?: number | string | null;
  retail_package?: string | null;
  wholesale_package?: string | null;
  variant_stock?: PackageVariant[] | null;
};

function getInvalidatedAt(): number {
  if (typeof window === "undefined") {
    return 0;
  }

  try {
    return parseInt(localStorage.getItem(INVALIDATION_KEY) || "0", 10) || 0;
  } catch {
    return 0;
  }
}

function getTimedCacheValue<T>(
  cache: Map<string, TimedCacheEntry<T>>,
  key: string,
  ttl = REQUEST_CACHE_DURATION,
): T | null {
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }

  const invalidatedAt = getInvalidatedAt();
  const expired = Date.now() - entry.timestamp > ttl;
  if (expired || invalidatedAt > entry.timestamp) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

function setTimedCacheValue<T>(
  cache: Map<string, TimedCacheEntry<T>>,
  key: string,
  value: T,
) {
  cache.set(key, {
    value,
    timestamp: Date.now(),
  });
}

async function fetchWithTimedCache<T>({
  key,
  cache,
  inFlight,
  loader,
  ttl = REQUEST_CACHE_DURATION,
}: {
  key: string;
  cache: Map<string, TimedCacheEntry<T>>;
  inFlight: Map<string, Promise<T>>;
  loader: () => Promise<T>;
  ttl?: number;
}): Promise<T> {
  const cached = getTimedCacheValue(cache, key, ttl);
  if (cached !== null) {
    return cached;
  }

  const pending = inFlight.get(key);
  if (pending) {
    return pending;
  }

  const request = loader()
    .then((value) => {
      setTimedCacheValue(cache, key, value);
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, request);
  return request;
}

async function runLimitedTasks<T>(
  taskFactories: Array<() => Promise<T>>,
  maxConcurrency: number,
): Promise<T[]> {
  const results: T[] = [];
  const limit = Math.max(1, maxConcurrency);
  let index = 0;

  const worker = async () => {
    while (index < taskFactories.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await taskFactories[currentIndex]();
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, taskFactories.length) }, () => worker()),
  );

  return results;
}

export function getPackageVariantId(variant?: PackageVariant | null): number {
  return Number(variant?.variant_id ?? variant?.id ?? 0);
}

export function sumPackageStockMap(stockMap?: PackageStockMap | null): number {
  return Object.values(stockMap || {}).reduce(
    (sum, quantity) => sum + (Number(quantity) || 0),
    0,
  );
}

function serializeVariantsForCache(variants?: PackageVariant[] | null): string {
  return JSON.stringify(
    (variants || [])
      .map((variant) => ({
        id: getPackageVariantId(variant),
        wholesale: String(
          variant?.wholesale_package || variant?.package_name || "",
        ).trim(),
        retail: String(variant?.retail_package || "").trim(),
      }))
      .sort((left, right) => left.id - right.id),
  );
}

function buildResolvedQuantityCacheKey({
  productId,
  productName,
  branchId,
  fallbackQuantity,
  basePackage,
  variants,
  packageField,
}: {
  productId: number;
  productName: string;
  branchId: number;
  fallbackQuantity?: number | null;
  basePackage?: string | null;
  variants?: PackageVariant[];
  packageField: "wholesale_package" | "retail_package";
}) {
  return JSON.stringify({
    type: "resolved-quantity",
    productId,
    productName,
    branchId,
    fallbackQuantity: Number(fallbackQuantity) || 0,
    basePackage: String(basePackage || ""),
    packageField,
    variants: serializeVariantsForCache(variants),
  });
}

export async function fetchResolvedProductQuantity({
  productId,
  productName,
  branchId,
  fallbackQuantity,
  basePackage,
  variants,
  packageField = "wholesale_package",
}: {
  productId: number;
  productName: string;
  branchId: number;
  fallbackQuantity?: number | null;
  basePackage?: string | null;
  variants?: PackageVariant[];
  packageField?: "wholesale_package" | "retail_package";
}): Promise<number> {
  try {
    const cacheKey = buildResolvedQuantityCacheKey({
      productId,
      productName,
      branchId,
      fallbackQuantity,
      basePackage,
      packageField,
    });

    const quantity = await fetchWithTimedCache({
      key: cacheKey,
      cache: resolvedQuantityCache,
      inFlight: resolvedQuantityInFlight,
      loader: async () => {
        const stockMap = await fetchPackageStockMapFromMovements({
          productId,
          productName,
          branchId,
          basePackage,
          variants,
          packageField,
        });

        if (Object.keys(stockMap || {}).length === 0) {
          return Number(fallbackQuantity) || 0;
        }

        return sumPackageStockMap(stockMap);
      },
    });

    return Number(quantity) || 0;
  } catch {
    return Number(fallbackQuantity) || 0;
  }
}

export async function prefetchResolvedProductQuantities({
  products,
  branchId,
  variantsMap,
  packageField = "wholesale_package",
  maxConcurrency = 4,
}: {
  products: ResolvedQuantityLookupProduct[];
  branchId: number;
  variantsMap?: Record<number, PackageVariant[] | undefined>;
  packageField?: "wholesale_package" | "retail_package";
  maxConcurrency?: number;
}): Promise<Array<{ productId: number; quantity: number }>> {
  const dedupedProducts = Array.from(
    new Map(
      products
        .filter((product) => Number(product?.id || 0) > 0)
        .map((product) => [Number(product?.id || 0), product]),
    ).values(),
  );

  const pendingProducts = dedupedProducts.filter((product) => {
    const productId = Number(product?.id || 0);
    const cacheKey = buildResolvedQuantityCacheKey({
      productId,
      productName: String(product?.name || ""),
      branchId,
      fallbackQuantity: Number(product?.available_quantity) || 0,
      basePackage:
        packageField === "retail_package"
          ? product?.retail_package
          : product?.wholesale_package,
      variants: mergePackageVariants(
        Array.isArray(product?.variant_stock) ? product.variant_stock : [],
        variantsMap?.[productId] || [],
      ),
      packageField,
    });

    return getTimedCacheValue(resolvedQuantityCache, cacheKey) === null;
  });

  if (pendingProducts.length === 0) {
    return dedupedProducts.map((product) => {
      const productId = Number(product?.id || 0);
      const cacheKey = buildResolvedQuantityCacheKey({
        productId,
        productName: String(product?.name || ""),
        branchId,
        fallbackQuantity: Number(product?.available_quantity) || 0,
        basePackage:
          packageField === "retail_package"
            ? product?.retail_package
            : product?.wholesale_package,
        variants: mergePackageVariants(
          Array.isArray(product?.variant_stock) ? product.variant_stock : [],
          variantsMap?.[productId] || [],
        ),
        packageField,
      });

      return {
        productId,
        quantity:
          Number(getTimedCacheValue(resolvedQuantityCache, cacheKey)) ||
          Number(product?.available_quantity) ||
          0,
      };
    });
  }

  try {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/stock/resolved-quantities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          branchId,
          products: pendingProducts.map((product) => ({
            id: product.id,
            name: product.name,
            available_quantity: product.available_quantity,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`Bulk resolved quantities request failed: ${response.status}`);
      }

      const payload = await response.json();
      const results: Array<{ productId?: number; quantity?: number }> =
        Array.isArray(payload?.results) ? payload.results : [];
      const resultMap = new Map<number, number>();

      results.forEach((entry) => {
        resultMap.set(Number(entry?.productId || 0), Number(entry?.quantity) || 0);
      });

      dedupedProducts.forEach((product) => {
        const productId = Number(product?.id || 0);
        const mergedVariants = mergePackageVariants(
          Array.isArray(product?.variant_stock) ? product.variant_stock : [],
          variantsMap?.[productId] || [],
        );
        const cacheKey = buildResolvedQuantityCacheKey({
          productId,
          productName: String(product?.name || ""),
          branchId,
          fallbackQuantity: Number(product?.available_quantity) || 0,
          basePackage:
            packageField === "retail_package"
              ? product?.retail_package
              : product?.wholesale_package,
          variants: mergedVariants,
          packageField,
        });

        if (resultMap.has(productId)) {
          setTimedCacheValue(
            resolvedQuantityCache,
            cacheKey,
            Number(resultMap.get(productId)) || 0,
          );
        }
      });

      return dedupedProducts.map((product) => {
        const productId = Number(product?.id || 0);
        return {
          productId,
          quantity:
            Number(resultMap.get(productId)) || Number(product?.available_quantity) || 0,
        };
      });
    }
  } catch {
    // Fall back to the existing per-product flow below.
  }

  const tasks = dedupedProducts.map((product) => async () => {
    const productId = Number(product?.id || 0);
    const quantity = await fetchResolvedProductQuantity({
      productId,
      productName: String(product?.name || ""),
      branchId,
      fallbackQuantity: Number(product?.available_quantity) || 0,
      basePackage:
        packageField === "retail_package"
          ? product?.retail_package
          : product?.wholesale_package,
      variants: mergePackageVariants(
        Array.isArray(product?.variant_stock) ? product.variant_stock : [],
        variantsMap?.[productId] || [],
      ),
      packageField,
    });

    return { productId, quantity };
  });

  return runLimitedTasks(tasks, maxConcurrency);
}

function getVariantPackageLabel(
  variant: PackageVariant | null | undefined,
  packageField: "wholesale_package" | "retail_package",
  basePackage?: string | null,
): string {
  const rawLabel =
    packageField === "retail_package"
      ? variant?.retail_package
      : variant?.wholesale_package || variant?.package_name;

  return normalizePackageName(rawLabel || basePackage || "-");
}

function getVariantPackageDisplayLabel(
  variant: PackageVariant | null | undefined,
  packageField: "wholesale_package" | "retail_package",
  basePackage?: string | null,
): string {
  return (
    (packageField === "retail_package"
      ? variant?.retail_package
      : variant?.wholesale_package || variant?.package_name) ||
    basePackage ||
    "-"
  );
}

function mergeVariantFields(
  current: PackageVariant | undefined,
  incoming: PackageVariant,
): PackageVariant {
  if (!current) {
    return { ...incoming };
  }

  return {
    ...current,
    ...Object.fromEntries(
      Object.entries(incoming).filter(
        ([, value]) => value != null && value !== "",
      ),
    ),
  };
}

export function mergePackageVariants(
  ...variantGroups: Array<PackageVariant[] | undefined | null>
): PackageVariant[] {
  const merged = new Map<string, PackageVariant>();

  for (const group of variantGroups) {
    for (const variant of group || []) {
      const variantId = getPackageVariantId(variant);
      const wholesaleLabel = getVariantPackageLabel(
        variant,
        "wholesale_package",
      );
      const retailLabel = getVariantPackageLabel(variant, "retail_package");
      const key =
        variantId !== 0
          ? `id:${variantId}`
          : `label:${wholesaleLabel}:${retailLabel}`;

      merged.set(key, mergeVariantFields(merged.get(key), variant));
    }
  }

  return Array.from(merged.values());
}

export function buildPackagePickerOptions({
  basePackage,
  totalQuantity,
  variants,
  quantityMap,
  packageField = "wholesale_package",
  fallbackPrice,
}: {
  basePackage?: string | null;
  totalQuantity?: number | null;
  variants?: PackageVariant[];
  quantityMap?: PackageStockMap;
  packageField?: "wholesale_package" | "retail_package";
  fallbackPrice?: number | null;
}): PackagePickerOption[] {
  const rows = Array.isArray(variants) ? variants : [];
  const grouped = new Map<
    string,
    {
      displayName: string;
      quantity: number;
      variants: PackageVariant[];
      variantIds: Set<number>;
    }
  >();
  const variantLabels = new Map<number, string>();
  const variantsById = new Map<number, PackageVariant>();
  const normalizedBase = normalizePackageName(basePackage || "-");
  const hasQuantityMap = quantityMap !== undefined;
  let rowsTotal = 0;

  const ensureGroup = (normalizedLabel: string, displayName: string) => {
    if (!grouped.has(normalizedLabel)) {
      grouped.set(normalizedLabel, {
        displayName,
        quantity: 0,
        variants: [],
        variantIds: new Set<number>(),
      });
    }

    return grouped.get(normalizedLabel)!;
  };

  for (const row of rows) {
    const variantId = getPackageVariantId(row);
    const normalizedLabel = getVariantPackageLabel(
      row,
      packageField,
      basePackage,
    );
    const displayName = getVariantPackageDisplayLabel(
      row,
      packageField,
      basePackage,
    );
    const group = ensureGroup(normalizedLabel, displayName);

    group.variants.push(row);
    group.variantIds.add(variantId);
    variantLabels.set(variantId, normalizedLabel);
    variantsById.set(variantId, row);

    if (!hasQuantityMap) {
      const qty = Number(row.quantity || 0);
      group.quantity += qty;
      rowsTotal += qty;
    }
  }

  let mappedTotal = 0;
  if (hasQuantityMap) {
    for (const [variantIdRaw, qtyValue] of Object.entries(quantityMap || {})) {
      const variantId = Number(variantIdRaw);
      const qty = Number(qtyValue) || 0;
      const normalizedLabel = variantLabels.get(variantId) || normalizedBase;
      const displayName =
        normalizedLabel === normalizedBase
          ? basePackage || normalizedBase
          : variantsById.get(variantId)
            ? getVariantPackageDisplayLabel(
                variantsById.get(variantId),
                packageField,
                basePackage,
              )
            : normalizedLabel;
      const group = ensureGroup(normalizedLabel, displayName);

      group.quantity += qty;
      group.variantIds.add(variantId);
      mappedTotal += qty;
    }
  }

  const hasExplicitBase =
    Object.prototype.hasOwnProperty.call(quantityMap || {}, "0") ||
    variantLabels.has(0);

  if (hasQuantityMap && !hasExplicitBase) {
    const remainder = Number(totalQuantity || 0) - mappedTotal;
    if (Math.abs(remainder) > 0.0001) {
      const baseGroup = ensureGroup(
        normalizedBase,
        basePackage || normalizedBase,
      );
      baseGroup.quantity += remainder;
      baseGroup.variantIds.add(0);
    }
  } else if (!hasQuantityMap && rows.length > 0 && !variantLabels.has(0)) {
    const remainder = Number(totalQuantity || 0) - rowsTotal;
    if (Math.abs(remainder) > 0.0001) {
      const baseGroup = ensureGroup(
        normalizedBase,
        basePackage || normalizedBase,
      );
      baseGroup.quantity += remainder;
      baseGroup.variantIds.add(0);
    }
  }

  return Array.from(grouped.entries())
    .map(([normalizedLabel, group]) => {
      const candidateVariantIds = Array.from(group.variantIds).filter(
        (variantId) => variantId !== 0,
      );

      const variantId =
        candidateVariantIds.sort((leftId, rightId) => {
          const leftQty = Number(quantityMap?.[leftId] ?? 0);
          const rightQty = Number(quantityMap?.[rightId] ?? 0);
          return rightQty - leftQty;
        })[0] ??
        (normalizedLabel === normalizedBase
          ? 0
          : getPackageVariantId(group.variants[0]));

      const variant =
        variantsById.get(variantId) ||
        group.variants.find((row) => getPackageVariantId(row) === variantId) ||
        group.variants[0];

      return {
        key: `${normalizedLabel}:${variantId}`,
        variantId,
        packageName: group.displayName,
        quantity: Number(group.quantity) || 0,
        retailPackage: variant?.retail_package,
        price: Number(
          variant?.wholesale_price ?? variant?.price ?? fallbackPrice,
        ),
        variant,
      };
    })
    .filter(
      (entry) =>
        entry.packageName &&
        entry.packageName !== "-" &&
        entry.packageName !== "بدون عبوة" &&
        !Number.isNaN(entry.quantity),
    )
    .sort((left, right) =>
      left.packageName.localeCompare(right.packageName, "ar"),
    );
}

type MovementRow = {
  created_at?: string | null;
  movement_date?: string | null;
  invoice_date?: string | null;
  entry_date?: string | null;
  warehouse_name?: string | null;
  movement_type?: string | null;
  invoice_movement_type?: string | null;
  quantity?: number | null;
  package_name?: string | null;
  product_name?: string | null;
  manufacturer_name?: string | null;
  party_name?: string | null;
  note?: string | null;
  invoice_id?: number | null;
  variant_id?: number | null;
};

export type MovementWarehouseScope =
  | "all"
  | "showroom"
  | "warehouse"
  | "named";

export type MovementDisplayPackageMode = "movement" | "retail";

export type UnifiedMovementRow = MovementRow & {
  warehouse_name: string;
  quantity: number;
  movement_direction: "in" | "out";
  is_in: boolean;
  raw_package_name: string;
  display_package_name: string;
  date_value: string;
};

export type UnifiedMovementPackageTotals = {
  package: string;
  totalIn: number;
  totalOut: number;
  balance: number;
};

export type InventoryMovementSummaryRow = {
  warehouse_name: string;
  package_name: string;
  total_in: number;
  total_out: number;
};

const unifiedMovementRowsCache = new Map<
  string,
  TimedCacheEntry<UnifiedMovementRow[]>
>();
const unifiedMovementRowsInFlight = new Map<string, Promise<UnifiedMovementRow[]>>();
const packageStockMapCache = new Map<string, TimedCacheEntry<PackageStockMap>>();
const packageStockMapInFlight = new Map<string, Promise<PackageStockMap>>();
const resolvedQuantityCache = new Map<string, TimedCacheEntry<number>>();
const resolvedQuantityInFlight = new Map<string, Promise<number>>();

const IN_MOVEMENT_TYPES = new Set([
  "purchase",
  "transfer_in",
  "replace_in",
  "return_sale",
  "in",
]);

export function normalizePackageName(name?: string | null): string {
  const toWesternDigits = (value: string) =>
    value.replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));

  const cleaned = toWesternDigits(String(name || "بدون عبوة"))
    .replace(/\s+/g, " ")
    .trim();

  const withoutTrailingPiece = cleaned.replace(/\s+(قطعة|قطع|قطعه)$/i, "");
  const tokens = withoutTrailingPiece.split(" ").filter(Boolean);

  if (
    tokens.length === 2 &&
    /^\d+$/.test(tokens[0]) &&
    !/^\d+$/.test(tokens[1])
  ) {
    return `${tokens[1]} ${tokens[0]}`;
  }

  return withoutTrailingPiece;
}

function matchesBranchWarehouse(warehouseName: string, branchId: number) {
  const normalized = warehouseName.trim();
  if (branchId === 1) {
    return normalized.includes("المعرض");
  }

  if (branchId === 2) {
    return (
      normalized.includes("الرئيسي") || normalized.includes("المخزن الرئيسي")
    );
  }

  return true;
}

function matchesWarehouseScope(
  warehouseName: string,
  warehouseScope: MovementWarehouseScope,
  namedWarehouse?: string,
) {
  const normalized = warehouseName.trim();

  if (warehouseScope === "showroom") {
    return normalized.includes("المعرض");
  }

  if (warehouseScope === "warehouse") {
    return (
      normalized.includes("الرئيسي") ||
      normalized.includes("المخزن الرئيسي")
    );
  }

  if (warehouseScope === "named") {
    return normalized === String(namedWarehouse || "").trim();
  }

  return true;
}

function getMovementDateValue(row: MovementRow): string {
  return String(
    row.entry_date || row.invoice_date || row.movement_date || row.created_at || "",
  ).trim();
}

function resolveDisplayPackageName({
  rawPackageName,
  retailPackage,
  wholesalePackage,
  displayMode,
}: {
  rawPackageName?: string | null;
  retailPackage?: string | null;
  wholesalePackage?: string | null;
  displayMode: MovementDisplayPackageMode;
}) {
  const rawValue = String(rawPackageName || "").trim();
  const retailValue = String(retailPackage || "").trim();
  const wholesaleValue = String(wholesalePackage || "").trim();

  if (displayMode === "retail") {
    return normalizePackageName(retailValue || rawValue || wholesaleValue || "-");
  }

  return normalizePackageName(rawValue || wholesaleValue || retailValue || "-");
}

export function normalizeMovementRows({
  rows,
  warehouseScope = "all",
  namedWarehouse,
  displayMode = "movement",
  retailPackage,
  wholesalePackage,
}: {
  rows: MovementRow[];
  warehouseScope?: MovementWarehouseScope;
  namedWarehouse?: string;
  displayMode?: MovementDisplayPackageMode;
  retailPackage?: string | null;
  wholesalePackage?: string | null;
}): UnifiedMovementRow[] {
  return rows
    .filter((row) =>
      matchesWarehouseScope(
        String(row.warehouse_name || ""),
        warehouseScope,
        namedWarehouse,
      ),
    )
    .map((row) => {
      const quantity = Number(row.quantity || 0);
      const movementType = row.movement_type || row.invoice_movement_type || "";
      const isIn = IN_MOVEMENT_TYPES.has(movementType);
      const movementDirection: UnifiedMovementRow["movement_direction"] = isIn
        ? "in"
        : "out";
      const rawPackageName = normalizePackageName(row.package_name || "-");

      return {
        ...row,
        warehouse_name: String(row.warehouse_name || "—").trim() || "—",
        quantity,
        movement_direction: movementDirection,
        is_in: isIn,
        raw_package_name: rawPackageName,
        display_package_name: resolveDisplayPackageName({
          rawPackageName: row.package_name,
          retailPackage,
          wholesalePackage,
          displayMode,
        }),
        date_value: getMovementDateValue(row),
      };
    })
    .filter((row) => Number.isFinite(row.quantity) && row.quantity !== 0);
}

export async function fetchUnifiedMovementRows({
  productName,
  from,
  to,
  warehouseScope = "all",
  namedWarehouse,
  displayMode = "movement",
  retailPackage,
  wholesalePackage,
}: {
  productName: string;
  from?: string;
  to?: string;
  warehouseScope?: MovementWarehouseScope;
  namedWarehouse?: string;
  displayMode?: MovementDisplayPackageMode;
  retailPackage?: string | null;
  wholesalePackage?: string | null;
}): Promise<UnifiedMovementRow[]> {
  const cacheKey = JSON.stringify({
    type: "movement-rows",
    productName,
    from: from || "",
    to: to || "",
    warehouseScope,
    namedWarehouse: namedWarehouse || "",
    displayMode,
    retailPackage: retailPackage || "",
    wholesalePackage: wholesalePackage || "",
  });

  return fetchWithTimedCache({
    key: cacheKey,
    cache: unifiedMovementRowsCache,
    inFlight: unifiedMovementRowsInFlight,
    loader: async () => {
      const response = await api.get("/reports/product-movement", {
        params: {
          product_name: productName,
          from: from || undefined,
          to: to || undefined,
        },
      });

      const rows: MovementRow[] = Array.isArray(response.data)
        ? response.data
        : [];
      return normalizeMovementRows({
        rows,
        warehouseScope,
        namedWarehouse,
        displayMode,
        retailPackage,
        wholesalePackage,
      });
    },
  });
}

export function summarizeUnifiedMovementRows(rows: UnifiedMovementRow[]): {
  totalIn: number;
  totalOut: number;
  packageTotals: UnifiedMovementPackageTotals[];
} {
  let totalIn = 0;
  let totalOut = 0;
  const grouped = new Map<string, { label: string; inQty: number; outQty: number }>();

  for (const row of rows) {
    const packageLabel = row.display_package_name || "بدون عبوة";
    const entry = grouped.get(packageLabel) || {
      label: packageLabel,
      inQty: 0,
      outQty: 0,
    };

    if (row.is_in) {
      totalIn += row.quantity;
      entry.inQty += row.quantity;
    } else {
      totalOut += row.quantity;
      entry.outQty += row.quantity;
    }

    grouped.set(packageLabel, entry);
  }

  return {
    totalIn,
    totalOut,
    packageTotals: Array.from(grouped.values())
      .map((item) => ({
        package: item.label,
        totalIn: item.inQty,
        totalOut: item.outQty,
        balance: item.inQty - item.outQty,
      }))
      .sort((left, right) => left.package.localeCompare(right.package, "ar")),
  };
}

export function summarizeInventoryMovementRows(
  rows: UnifiedMovementRow[],
): InventoryMovementSummaryRow[] {
  const grouped = new Map<string, InventoryMovementSummaryRow>();

  for (const row of rows) {
    const packageName = row.display_package_name || "—";
    const key = `${row.warehouse_name}__${packageName}`;
    const entry = grouped.get(key) || {
      warehouse_name: row.warehouse_name,
      package_name: packageName,
      total_in: 0,
      total_out: 0,
    };

    if (row.is_in) {
      entry.total_in += row.quantity;
    } else {
      entry.total_out += row.quantity;
    }

    grouped.set(key, entry);
  }

  return Array.from(grouped.values()).sort((left, right) => {
    if (left.warehouse_name !== right.warehouse_name) {
      return left.warehouse_name.localeCompare(right.warehouse_name, "ar");
    }

    return left.package_name.localeCompare(right.package_name, "ar");
  });
}

export async function fetchPackageStockMapFromMovements({
  productId,
  productName,
  branchId,
  basePackage,
  variants,
  packageField = "wholesale_package",
}: {
  productId: number;
  productName: string;
  branchId: number;
  basePackage?: string | null;
  variants?: PackageVariant[];
  packageField?: "wholesale_package" | "retail_package";
}): Promise<PackageStockMap> {
  const cacheKey = JSON.stringify({
    type: "package-stock-map",
    productId,
    productName,
    branchId,
    basePackage: String(basePackage || ""),
    packageField,
    variants: serializeVariantsForCache(variants),
  });

  return fetchWithTimedCache({
    key: cacheKey,
    cache: packageStockMapCache,
    inFlight: packageStockMapInFlight,
    loader: async () => {
      const totalsByPackage = new Map<string, number>();

      const rows = await fetchUnifiedMovementRows({
        productName,
        warehouseScope:
          branchId === 1 ? "showroom" : branchId === 2 ? "warehouse" : "all",
        displayMode:
          branchId === 1 || packageField === "retail_package"
            ? "retail"
            : "movement",
        retailPackage: packageField === "retail_package" ? basePackage : null,
        wholesalePackage:
          packageField === "wholesale_package" ? basePackage : null,
      });

      for (const row of rows) {
        const delta = row.is_in ? row.quantity : -row.quantity;
        const pkg = normalizePackageName(
          row.display_package_name || row.raw_package_name || basePackage || "-",
        );
        totalsByPackage.set(pkg, (totalsByPackage.get(pkg) || 0) + delta);
      }

      const stockMap: PackageStockMap = {};
      const assignedPackages = new Set<string>();

      const baseLabel = normalizePackageName(basePackage || "-");
      stockMap[0] = Number(totalsByPackage.get(baseLabel) || 0);
      assignedPackages.add(baseLabel);

      for (const variant of variants || []) {
        const variantId = getPackageVariantId(variant);
        const label = getVariantPackageLabel(variant, packageField, basePackage);
        if (assignedPackages.has(label)) {
          stockMap[variantId] = 0;
        } else {
          stockMap[variantId] = Number(totalsByPackage.get(label) || 0);
          assignedPackages.add(label);
        }
      }

      return stockMap;
    },
  });
}

export type MovementBalanceEntry = { package: string; quantity: number };

const movementBalanceCache = new Map<
  string,
  TimedCacheEntry<{ entries: MovementBalanceEntry[]; total: number }>
>();
const movementBalanceInFlight = new Map<
  string,
  Promise<{ entries: MovementBalanceEntry[]; total: number }>
>();

/**
 * Returns per-package balances computed directly from the movement report.
 * No variant-ID mapping — uses the raw package_name from each movement row,
 * exactly matching the logic in تقرير حركة الأصناف.
 */
export async function fetchMovementBalances({
  productName,
  branchId,
  retailPackage,
  wholesalePackage,
}: {
  productName: string;
  branchId: number;
  retailPackage?: string | null;
  wholesalePackage?: string | null;
}): Promise<{ entries: MovementBalanceEntry[]; total: number }> {
  const cacheKey = JSON.stringify({
    type: "movement-balance",
    productName,
    branchId,
    retailPackage: retailPackage || "",
    wholesalePackage: wholesalePackage || "",
  });

  return fetchWithTimedCache({
    key: cacheKey,
    cache: movementBalanceCache,
    inFlight: movementBalanceInFlight,
    loader: async () => {
      const totalsByPackage = new Map<string, number>();

      const rows = await fetchUnifiedMovementRows({
        productName,
        warehouseScope:
          branchId === 1 ? "showroom" : branchId === 2 ? "warehouse" : "all",
        displayMode: branchId === 1 ? "retail" : "movement",
        retailPackage,
        wholesalePackage,
      });

      for (const row of rows) {
        const delta = row.is_in ? row.quantity : -row.quantity;
        const pkg = normalizePackageName(
          row.display_package_name || row.raw_package_name || "-",
        );
        totalsByPackage.set(pkg, (totalsByPackage.get(pkg) || 0) + delta);
      }

      const total = Array.from(totalsByPackage.values()).reduce(
        (sum, q) => sum + q,
        0,
      );

      const entries = Array.from(totalsByPackage.entries())
        .map(([pkg, qty]) => ({ package: pkg, quantity: qty }))
        .filter(
          (e) =>
            e.package !== "-" &&
            e.package !== "بدون عبوة" &&
            !Number.isNaN(e.quantity),
        )
        .sort((a, b) => a.package.localeCompare(b.package, "ar"));

      return { entries, total };
    },
  });
}

async function fetchBulkMovementBalances({
  products,
  branchIds,
}: {
  products: Array<{
    id?: number | string | null;
    name?: string | null;
    retail_package?: string | null;
    wholesale_package?: string | null;
  }>;
  branchIds: number[];
}): Promise<
  Array<{
    productId: number;
    branchId: number;
    result: { entries: MovementBalanceEntry[]; total: number };
  }>
> {
  if (typeof window === "undefined") {
    return [];
  }

  const token = localStorage.getItem("token");
  const response = await fetch("/api/stock/balances", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ products, branchIds }),
  });

  if (!response.ok) {
    throw new Error(`Bulk balances request failed: ${response.status}`);
  }

  const payload = await response.json();
  return Array.isArray(payload?.results) ? payload.results : [];
}

export async function prefetchMovementBalances({
  products,
  branchIds,
  maxConcurrency = 4,
  shouldSkip,
}: {
  products: Array<{
    id?: number | string | null;
    name?: string | null;
    retail_package?: string | null;
    wholesale_package?: string | null;
  }>;
  branchIds: number[];
  maxConcurrency?: number;
  shouldSkip?: (productId: number, branchId: number) => boolean;
}): Promise<
  Array<{
    productId: number;
    branchId: number;
    result: { entries: MovementBalanceEntry[]; total: number };
  }>
> {
  const seen = new Set<string>();
  const normalizedProducts = products.filter(
    (product) => Number(product?.id || 0) > 0 && String(product?.name || "").trim(),
  );

  for (const product of normalizedProducts) {
    const productId = Number(product?.id || 0);
    if (!productId) {
      continue;
    }

    for (const branchId of branchIds) {
      const key = `${productId}:${branchId}`;
      if (
        seen.has(key) ||
        shouldSkip?.(productId, branchId) ||
        getTimedCacheValue(movementBalanceCache, JSON.stringify({
          type: "movement-balance",
          productName: String(product?.name || ""),
          branchId,
          retailPackage: product?.retail_package || "",
          wholesalePackage: product?.wholesale_package || "",
        })) !== null
      ) {
        continue;
      }

      seen.add(key);
    }
  }

  const pendingProducts = normalizedProducts.filter((product) =>
    branchIds.some((branchId) => seen.has(`${Number(product?.id || 0)}:${branchId}`)),
  );

  if (pendingProducts.length === 0) {
    return [];
  }

  try {
    const bulkResults = await fetchBulkMovementBalances({
      products: pendingProducts,
      branchIds,
    });

    bulkResults.forEach(({ productId, branchId, result }) => {
      const product = pendingProducts.find((entry) => Number(entry?.id || 0) === productId);
      if (!product) {
        return;
      }

      const cacheKey = JSON.stringify({
        type: "movement-balance",
        productName: String(product?.name || ""),
        branchId,
        retailPackage: product?.retail_package || "",
        wholesalePackage: product?.wholesale_package || "",
      });

      setTimedCacheValue(movementBalanceCache, cacheKey, result);
    });

    return bulkResults.filter(({ productId, branchId }) =>
      seen.has(`${productId}:${branchId}`),
    );
  } catch {
    const tasks: Array<
      () => Promise<{
        productId: number;
        branchId: number;
        result: { entries: MovementBalanceEntry[]; total: number };
      }>
    > = [];

    for (const product of pendingProducts) {
      const productId = Number(product?.id || 0);
      for (const branchId of branchIds) {
        const key = `${productId}:${branchId}`;
        if (!seen.has(key)) {
          continue;
        }

        tasks.push(async () => ({
          productId,
          branchId,
          result: await fetchMovementBalances({
            productName: String(product?.name || ""),
            branchId,
            retailPackage: product?.retail_package,
            wholesalePackage: product?.wholesale_package,
          }),
        }));
      }
    }

    return runLimitedTasks(tasks, maxConcurrency);
  }
}
