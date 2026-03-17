import { NextRequest, NextResponse } from "next/server";
import { API_URL } from "@/services/api";
import { normalizeMovementRows } from "@/lib/package-stock";

type BalanceRequestProduct = {
  id?: number | string | null;
  name?: string | null;
  retail_package?: string | null;
  wholesale_package?: string | null;
};

type MovementBalanceEntry = {
  package: string;
  quantity: number;
};

type BalanceMovementRows = Parameters<typeof normalizeMovementRows>[0]["rows"];

const MAX_PRODUCTS = 50;
const MAX_CONCURRENCY = 6;

function normalizeProducts(
  products: BalanceRequestProduct[],
): BalanceRequestProduct[] {
  return Array.from(
    new Map(
      (products || [])
        .filter(
          (product) =>
            Number(product?.id || 0) > 0 && String(product?.name || "").trim(),
        )
        .map((product) => [Number(product?.id || 0), product]),
    ).values(),
  ).slice(0, MAX_PRODUCTS);
}

function normalizeBranchIds(branchIds: unknown): number[] {
  return Array.from(
    new Set(
      Array.isArray(branchIds)
        ? branchIds
            .map((branchId) => Number(branchId || 0))
            .filter((branchId) => branchId > 0)
        : [],
    ),
  );
}

async function runLimitedTasks<T>(
  taskFactories: Array<() => Promise<T>>,
  maxConcurrency: number,
): Promise<T[]> {
  const results: T[] = [];
  const limit = Math.max(1, Math.min(maxConcurrency, taskFactories.length));
  let index = 0;

  const worker = async () => {
    while (index < taskFactories.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await taskFactories[currentIndex]();
    }
  };

  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}

async function fetchProductMovementRows({
  productName,
  authorization,
}: {
  productName: string;
  authorization?: string | null;
}) {
  const url = new URL("/reports/product-movement", API_URL);
  url.searchParams.set("product_name", productName);

  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(authorization ? { Authorization: authorization } : {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch movement rows: ${response.status}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

function buildBalanceFromRows({
  rows,
  branchId,
  retailPackage,
  wholesalePackage,
}: {
  rows: BalanceMovementRows;
  branchId: number;
  retailPackage?: string | null;
  wholesalePackage?: string | null;
}) {
  const totalsByPackage = new Map<string, number>();

  const normalizedRows = normalizeMovementRows({
    rows,
    warehouseScope:
      branchId === 1 ? "showroom" : branchId === 2 ? "warehouse" : "all",
    displayMode: branchId === 1 ? "retail" : "movement",
    retailPackage,
    wholesalePackage,
  });

  normalizedRows.forEach((row) => {
    const packageName = String(
      row.display_package_name || row.raw_package_name || "-",
    ).trim();
    const delta = row.is_in
      ? Number(row.quantity || 0)
      : -Number(row.quantity || 0);
    totalsByPackage.set(
      packageName,
      (totalsByPackage.get(packageName) || 0) + delta,
    );
  });

  const total = Array.from(totalsByPackage.values()).reduce(
    (sum, quantity) => sum + (Number(quantity) || 0),
    0,
  );

  const entries: MovementBalanceEntry[] = Array.from(totalsByPackage.entries())
    .map(([pkg, quantity]) => ({ package: pkg, quantity }))
    .filter(
      (entry) =>
        entry.package !== "-" &&
        entry.package !== "بدون عبوة" &&
        !Number.isNaN(entry.quantity),
    )
    .sort((left, right) => left.package.localeCompare(right.package, "ar"));

  return {
    entries,
    total,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const products = normalizeProducts(
      Array.isArray(body?.products) ? body.products : [],
    );
    const branchIds = normalizeBranchIds(body?.branchIds);

    if (products.length === 0 || branchIds.length === 0) {
      return NextResponse.json({ results: [] });
    }

    const authorization = request.headers.get("authorization");

    const results = await runLimitedTasks(
      products.map((product) => async () => {
        const rows = await fetchProductMovementRows({
          productName: String(product.name || ""),
          authorization,
        });

        return branchIds.map((branchId) => ({
          productId: Number(product.id || 0),
          branchId,
          result: buildBalanceFromRows({
            rows,
            branchId,
            retailPackage: product.retail_package,
            wholesalePackage: product.wholesale_package,
          }),
        }));
      }),
      MAX_CONCURRENCY,
    );

    return NextResponse.json({ results: results.flat() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, results: [] }, { status: 500 });
  }
}
