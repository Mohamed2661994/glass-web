import { normalizePackageName } from "@/lib/package-stock";

type PreviewApiRow = {
  product_id?: number | null;
  variant_id?: number | null;
  product_name?: string;
  manufacturer?: string;
  package_name?: string | null;
  quantity?: number | null;
  from_quantity?: number | null;
  to_quantity?: number | null;
  final_price?: number | null;
  from?: string;
  to?: string;
  status?: "ok" | "rejected";
  reason?: string;
};

type LocalTransferSelection = {
  product_id: number;
  variant_id?: number | null;
  product_name?: string;
  manufacturer?: string;
  wholesale_package?: string | null;
  quantity?: number | null;
  final_price?: number | null;
};

type MergedPreviewRow = PreviewApiRow & {
  product_id: number;
  variant_id: number;
  product_name: string;
  manufacturer: string;
  package_name: string;
  quantity: number;
  from_quantity: number;
  to_quantity: number;
  final_price: number;
  status: "ok" | "rejected";
};

const getVariantId = (value?: number | null) => Number(value || 0);

export function mergeTransferPreviewRows(
  rows: PreviewApiRow[],
  selections: LocalTransferSelection[],
): MergedPreviewRow[] {
  const responseRows = Array.isArray(rows) ? rows : [];
  const localSelections = Array.isArray(selections) ? selections : [];
  const usedIndexes = new Set<number>();

  const takeRow = (predicate: (row: PreviewApiRow) => boolean) => {
    const index = responseRows.findIndex(
      (row, rowIndex) => !usedIndexes.has(rowIndex) && predicate(row),
    );

    if (index < 0) return null;

    usedIndexes.add(index);
    return responseRows[index];
  };

  return localSelections.map((selection) => {
    const productId = Number(selection.product_id || 0);
    const variantId = getVariantId(selection.variant_id);
    const selectedPackage = normalizePackageName(
      selection.wholesale_package || "",
    );

    let matchedRow = takeRow(
      (row) =>
        Number(row.product_id || 0) === productId &&
        getVariantId(row.variant_id) === variantId,
    );

    if (!matchedRow && selectedPackage) {
      matchedRow = takeRow(
        (row) =>
          Number(row.product_id || 0) === productId &&
          normalizePackageName(row.package_name || "") === selectedPackage,
      );
    }

    if (!matchedRow) {
      const sameProductUnmatchedIndexes = responseRows
        .map((row, index) => ({ row, index }))
        .filter(
          ({ row, index }) =>
            !usedIndexes.has(index) &&
            Number(row.product_id || 0) === productId,
        );

      if (sameProductUnmatchedIndexes.length === 1) {
        const fallback = sameProductUnmatchedIndexes[0];
        usedIndexes.add(fallback.index);
        matchedRow = fallback.row;
      }
    }

    // Use locally-known available quantity when the server returns
    // INSUFFICIENT_STOCK but the client has verified stock from movements.
    const localQty = Number(selection.quantity || 0);
    const serverFromQty = Number(matchedRow?.from_quantity || 0);
    const localAvailable = Number(
      (selection as any).available_quantity ?? 0,
    );
    const serverRejectedStock =
      matchedRow?.status === "rejected" &&
      String(matchedRow?.reason || "").includes("INSUFFICIENT_STOCK");

    const effectiveFromQty =
      serverRejectedStock && localAvailable > 0 ? localAvailable : serverFromQty;

    const status =
      !serverRejectedStock &&
      (matchedRow?.status === "ok" || matchedRow?.status === "rejected")
        ? matchedRow.status
        : effectiveFromQty > 0 && effectiveFromQty >= localQty
          ? "ok"
          : "rejected";

    return {
      ...matchedRow,
      product_id: productId,
      variant_id: variantId,
      product_name: selection.product_name || matchedRow?.product_name || "",
      manufacturer: selection.manufacturer || matchedRow?.manufacturer || "",
      package_name:
        selection.wholesale_package || matchedRow?.package_name || "",
      quantity: localQty,
      from_quantity: effectiveFromQty || serverFromQty,
      to_quantity: Number(matchedRow?.to_quantity || 0),
      final_price: Number(
        selection.final_price ?? matchedRow?.final_price ?? 0,
      ),
      status,
      reason:
        status === "ok"
          ? undefined
          : matchedRow?.reason ||
            (matchedRow
              ? undefined
              : "تعذر مطابقة العبوة المختارة في المعاينة"),
    };
  });
}
