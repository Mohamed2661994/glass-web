import api from "@/services/api";

export type PackageStockMap = Record<number, number>;

type PackageVariant = {
  id?: number | null;
  variant_id?: number | null;
  wholesale_package?: string | null;
  retail_package?: string | null;
  package_name?: string | null;
};

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
  productName,
  branchId,
  basePackage,
  variants,
  packageField = "wholesale_package",
}: {
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
  stockMap[0] = Number(
    totalsByPackage.get(normalizePackageName(basePackage || "-")) || 0,
  );

  for (const variant of variants || []) {
    const variantId = Number(variant.id ?? variant.variant_id ?? 0);
    const packageName =
      packageField === "retail_package"
        ? variant.retail_package
        : variant.wholesale_package || variant.package_name;

    stockMap[variantId] = Number(
      totalsByPackage.get(
        normalizePackageName(packageName || basePackage || "-"),
      ) || 0,
    );
  }

  return stockMap;
}