import api from "@/services/api";

export type PackageStockMap = Record<number, number>;

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

export function getPackageVariantId(variant?: PackageVariant | null): number {
  return Number(variant?.variant_id ?? variant?.id ?? 0);
}

export function sumPackageStockMap(stockMap?: PackageStockMap | null): number {
  return Object.values(stockMap || {}).reduce(
    (sum, quantity) => sum + (Number(quantity) || 0),
    0,
  );
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
  } catch {
    return Number(fallbackQuantity) || 0;
  }
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
      Object.entries(incoming).filter(([, value]) => value != null && value !== ""),
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
    const normalizedLabel = getVariantPackageLabel(row, packageField, basePackage);
    const displayName = getVariantPackageDisplayLabel(row, packageField, basePackage);
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
      const baseGroup = ensureGroup(normalizedBase, basePackage || normalizedBase);
      baseGroup.quantity += remainder;
      baseGroup.variantIds.add(0);
    }
  } else if (!hasQuantityMap && rows.length > 0 && !variantLabels.has(0)) {
    const remainder = Number(totalQuantity || 0) - rowsTotal;
    if (Math.abs(remainder) > 0.0001) {
      const baseGroup = ensureGroup(normalizedBase, basePackage || normalizedBase);
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
        (normalizedLabel === normalizedBase ? 0 : getPackageVariantId(group.variants[0]));

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
        price: Number(variant?.wholesale_price ?? variant?.price ?? fallbackPrice),
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
    .sort((left, right) => left.packageName.localeCompare(right.packageName, "ar"));
}

type MovementRow = {
  warehouse_name?: string | null;
  movement_type?: string | null;
  invoice_movement_type?: string | null;
  quantity?: number | null;
  package_name?: string | null;
};

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
      normalized.includes("الرئيسي") ||
      normalized.includes("المخزن الرئيسي")
    );
  }

  return true;
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
  const response = await api.get("/reports/product-movement", {
    params: { product_name: productName },
  });

  const rows: MovementRow[] = Array.isArray(response.data) ? response.data : [];
  const totalsByPackage = new Map<string, number>();

  for (const row of rows) {
    if (!matchesBranchWarehouse(String(row.warehouse_name || ""), branchId)) {
      continue;
    }

    const qty = Number(row.quantity || 0);
    if (!Number.isFinite(qty) || qty === 0) continue;

    const movementType = row.movement_type || row.invoice_movement_type || "";
    const delta = IN_MOVEMENT_TYPES.has(movementType) ? qty : -qty;
    const pkg = normalizePackageName(row.package_name || basePackage || "-");
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
}