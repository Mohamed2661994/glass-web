"use client";

import { useEffect } from "react";
import { warmStockSnapshot } from "@/lib/stock-snapshot";

export function StockSnapshotPreload() {
  useEffect(() => {
    warmStockSnapshot({
      endpoint: "/products",
      params: {
        branch_id: 1,
        invoice_type: "retail",
        movement_type: "sale",
      },
      cacheKey: "retail_sale",
    });

    warmStockSnapshot({
      endpoint: "/products",
      params: {
        branch_id: 1,
        invoice_type: "retail",
        movement_type: "sale",
      },
      cacheKey: "lookup_retail",
    });

    warmStockSnapshot({
      endpoint: "/products",
      params: {
        branch_id: 1,
        invoice_type: "retail",
        movement_type: "purchase",
      },
      cacheKey: "retail_purchase",
    });

    warmStockSnapshot({
      endpoint: "/products",
      params: {
        branch_id: 2,
        invoice_type: "wholesale",
        movement_type: "sale",
      },
      cacheKey: "wholesale_sale",
    });

    warmStockSnapshot({
      endpoint: "/products",
      params: {
        branch_id: 2,
        invoice_type: "wholesale",
        movement_type: "sale",
      },
      cacheKey: "lookup_wholesale",
    });

    warmStockSnapshot({
      endpoint: "/products",
      params: {
        branch_id: 2,
        invoice_type: "wholesale",
        movement_type: "purchase",
      },
      cacheKey: "wholesale_purchase",
    });

    warmStockSnapshot({
      endpoint: "/products/for-replace",
      params: { branch_id: 2 },
      cacheKey: "for_replace_wholesale",
    });
  }, []);

  return null;
}