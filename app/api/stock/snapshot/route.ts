import { NextRequest, NextResponse } from "next/server";
import { API_URL } from "@/services/api";

type SnapshotProduct = {
  id?: number | string | null;
  name?: string | null;
  available_quantity?: number | string | null;
};

type SnapshotPayload = {
  endpoint?: string;
  params?: Record<string, any>;
  cacheKey?: string;
  invalidateAfter?: number;
  forceRefresh?: boolean;
};

type SnapshotResponse = {
  products: SnapshotProduct[];
  variantsMap: Record<number, any[]>;
  resolvedQtyById: Record<number, number>;
  generatedAt: number;
};

const SNAPSHOT_TTL = 60 * 1000;
const snapshotCache = new Map<
  string,
  { timestamp: number; invalidateAfter: number; value: SnapshotResponse }
>();
const snapshotInFlight = new Map<string, Promise<SnapshotResponse>>();

function buildExternalUrl(endpoint: string, params: Record<string, any> = {}) {
  const url = new URL(endpoint, API_URL);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }
    url.searchParams.set(key, String(value));
  });
  return url;
}

async function fetchExternalJson<T>(url: URL, authorization?: string | null) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(authorization ? { Authorization: authorization } : {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url.pathname}: ${response.status}`);
  }

  return (await response.json()) as T;
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function fetchVariantsMap({
  productIds,
  authorization,
}: {
  productIds: number[];
  authorization?: string | null;
}) {
  const variantsMap: Record<number, any[]> = {};
  if (productIds.length === 0) {
    return variantsMap;
  }

  await Promise.all(
    chunk(productIds, 120).map(async (batch) => {
      const rows = await fetchExternalJson<any[]>(
        buildExternalUrl("/products/variants", {
          product_ids: batch.join(","),
        }),
        authorization,
      ).catch(() => []);

      for (const variant of Array.isArray(rows) ? rows : []) {
        const productId = Number(variant?.product_id || 0);
        if (!productId) {
          continue;
        }

        if (!variantsMap[productId]) {
          variantsMap[productId] = [];
        }

        variantsMap[productId].push(variant);
      }
    }),
  );

  return variantsMap;
}

async function fetchResolvedQtyById({
  origin,
  branchId,
  products,
  authorization,
}: {
  origin: string;
  branchId: number;
  products: SnapshotProduct[];
  authorization?: string | null;
}) {
  if (branchId <= 0 || products.length === 0) {
    return {} as Record<number, number>;
  }

  const response = await fetch(`${origin}/api/stock/resolved-quantities`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authorization ? { Authorization: authorization } : {}),
    },
    body: JSON.stringify({
      branchId,
      products: products.map((product) => ({
        id: product.id,
        name: product.name,
        available_quantity: product.available_quantity,
      })),
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch resolved quantities: ${response.status}`);
  }

  const payload = await response.json();
  const entries = Array.isArray(payload?.results) ? payload.results : [];
  return Object.fromEntries(
    entries.map((entry: { productId?: number; quantity?: number }) => [
      Number(entry?.productId || 0),
      Number(entry?.quantity) || 0,
    ]),
  );
}

async function buildSnapshot({
  endpoint,
  params,
  origin,
  authorization,
}: {
  endpoint: string;
  params: Record<string, any>;
  origin: string;
  authorization?: string | null;
}): Promise<SnapshotResponse> {
  const products = await fetchExternalJson<SnapshotProduct[]>(
    buildExternalUrl(endpoint, params),
    authorization,
  );

  const normalizedProducts = Array.isArray(products) ? products : [];
  const productIds = normalizedProducts
    .map((product) => Number(product?.id || 0))
    .filter((productId) => productId > 0);

  const [variantsMap, resolvedQtyById] = await Promise.all([
    fetchVariantsMap({ productIds, authorization }),
    fetchResolvedQtyById({
      origin,
      branchId: Number(params?.branch_id || 0),
      products: normalizedProducts,
      authorization,
    }).catch(() => ({})),
  ]);

  return {
    products: normalizedProducts,
    variantsMap,
    resolvedQtyById,
    generatedAt: Date.now(),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SnapshotPayload;
    const endpoint = String(body?.endpoint || "").trim();
    const params = body?.params && typeof body.params === "object" ? body.params : {};
    const invalidateAfter = Number(body?.invalidateAfter || 0);
    const forceRefresh = Boolean(body?.forceRefresh);

    if (endpoint !== "/products" && endpoint !== "/products/for-replace") {
      return NextResponse.json(
        { error: "Unsupported snapshot endpoint" },
        { status: 400 },
      );
    }

    const cacheKey = JSON.stringify({ endpoint, params, cacheKey: body?.cacheKey || "" });
    const cached = snapshotCache.get(cacheKey);
    if (
      !forceRefresh &&
      cached &&
      Date.now() - cached.timestamp <= SNAPSHOT_TTL &&
      invalidateAfter <= cached.invalidateAfter
    ) {
      return NextResponse.json(cached.value);
    }

    const pending = snapshotInFlight.get(cacheKey);
    if (pending) {
      return NextResponse.json(await pending);
    }

    const snapshotPromise = buildSnapshot({
      endpoint,
      params,
      origin: request.nextUrl.origin,
      authorization: request.headers.get("authorization"),
    }).finally(() => {
      snapshotInFlight.delete(cacheKey);
    });

    snapshotInFlight.set(cacheKey, snapshotPromise);
    const snapshot = await snapshotPromise;
    snapshotCache.set(cacheKey, {
      timestamp: Date.now(),
      invalidateAfter,
      value: snapshot,
    });

    return NextResponse.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
