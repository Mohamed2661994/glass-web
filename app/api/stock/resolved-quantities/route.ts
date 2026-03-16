import { NextRequest, NextResponse } from "next/server";
import { API_URL } from "@/services/api";
import { normalizeMovementRows } from "@/lib/package-stock";

type QuantityRequestProduct = {
  id?: number | string | null;
  name?: string | null;
  available_quantity?: number | string | null;
};

const MAX_PRODUCTS = 50;
const MAX_CONCURRENCY = 6;

function normalizeProducts(products: QuantityRequestProduct[]): QuantityRequestProduct[] {
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

function buildResolvedQuantityFromRows({
  rows,
  branchId,
}: {
  rows: any[];
  branchId: number;
}) {
  const normalizedRows = normalizeMovementRows({
    rows,
    warehouseScope:
      branchId === 1 ? "showroom" : branchId === 2 ? "warehouse" : "all",
    displayMode: branchId === 1 ? "retail" : "movement",
  });

  return normalizedRows.reduce((sum, row) => {
    const delta = row.is_in ? Number(row.quantity || 0) : -Number(row.quantity || 0);
    return sum + delta;
  }, 0);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const products = normalizeProducts(
      Array.isArray(body?.products) ? body.products : [],
    );
    const branchId = Number(body?.branchId || 0);

    if (products.length === 0 || branchId <= 0) {
      return NextResponse.json({ results: [] });
    }

    const authorization = request.headers.get("authorization");

    const results = await runLimitedTasks(
      products.map((product) => async () => {
        const fallbackQuantity = Number(product.available_quantity) || 0;
        try {
          const rows = await fetchProductMovementRows({
            productName: String(product.name || ""),
            authorization,
          });

          return {
            productId: Number(product.id || 0),
            quantity: buildResolvedQuantityFromRows({ rows, branchId }),
          };
        } catch {
          return {
            productId: Number(product.id || 0),
            quantity: fallbackQuantity,
          };
        }
      }),
      MAX_CONCURRENCY,
    );

    return NextResponse.json({ results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message, results: [] },
      { status: 500 },
    );
  }
}