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
            !usedIndexes.has(index) && Number(row.product_id || 0) === productId,
        );

      if (sameProductUnmatchedIndexes.length === 1) {
        const fallback = sameProductUnmatchedIndexes[0];
        usedIndexes.add(fallback.index);
        matchedRow = fallback.row;
      }
    }

    const status =
      matchedRow?.status === "ok" || matchedRow?.status === "rejected"
        ? matchedRow.status
        : Number(matchedRow?.from_quantity || 0) > 0
          ? "ok"
          : "rejected";

    return {
      ...matchedRow,
      product_id: productId,
      variant_id: variantId,
      product_name: selection.product_name || matchedRow?.product_name || "",
      manufacturer: selection.manufacturer || matchedRow?.manufacturer || "",
      package_name: selection.wholesale_package || matchedRow?.package_name || "",
      quantity: Number(selection.quantity || 0),
      from_quantity: Number(matchedRow?.from_quantity || 0),
      to_quantity: Number(matchedRow?.to_quantity || 0),
      final_price: Number(selection.final_price ?? matchedRow?.final_price ?? 0),
      status,
      reason:
        matchedRow?.reason ||
        (matchedRow ? undefined : "تعذر مطابقة العبوة المختارة في المعاينة"),
    };
  });
}