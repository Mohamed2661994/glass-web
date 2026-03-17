export type LowStockReorderItem = {
  product_id: number;
  product_name: string;
  manufacturer_name?: string | null;
  warehouse_name: string;
  current_stock: number;
  wholesale_package?: string | null;
  retail_package?: string | null;
  variant_id?: number;
};

export type StockByProductId = Record<number, number>;

export function getTransferNeededProducts(
  items: LowStockReorderItem[],
  retailStock: StockByProductId,
  wholesaleStock: StockByProductId,
  options?: {
    onlyWithWholesaleStock?: boolean;
  },
): LowStockReorderItem[] {
  const onlyWithWholesaleStock = Boolean(options?.onlyWithWholesaleStock);

  const filtered = items.filter((item) => {
    const retailQty = retailStock[item.product_id] ?? Number(item.current_stock) ?? 0;
    const wholesaleQty = wholesaleStock[item.product_id] ?? 0;

    if (
      item.warehouse_name !== "مخزن المعرض" ||
      retailQty > 5 ||
      retailQty < 0 ||
      !item.wholesale_package
    ) {
      return false;
    }

    if (!(retailQty > 0 || wholesaleQty > 0)) {
      return false;
    }

    if (onlyWithWholesaleStock && wholesaleQty <= 0) {
      return false;
    }

    return true;
  });

  const byProduct = new Map<number, LowStockReorderItem>();
  for (const item of filtered) {
    if (byProduct.has(item.product_id)) continue;

    byProduct.set(item.product_id, {
      ...item,
      current_stock: retailStock[item.product_id] ?? Number(item.current_stock) ?? 0,
    });
  }

  return Array.from(byProduct.values());
}