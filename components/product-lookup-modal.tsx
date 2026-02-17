"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCachedProducts } from "@/hooks/use-cached-products";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: number;
}

export function ProductLookupModal({ open, onOpenChange, branchId }: Props) {
  const [search, setSearch] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const invoiceType = branchId === 1 ? "retail" : "wholesale";

  /* =========================================================
     Fetch products (Cached — localStorage + auto-refresh)
     ========================================================= */
  const { products, loading, refresh } = useCachedProducts({
    endpoint: "/products",
    params: {
      branch_id: branchId,
      invoice_type: invoiceType,
      movement_type: "sale",
    },
    cacheKey: `lookup_${invoiceType}`,
  });

  const [refreshing, setRefreshing] = useState(false);

  // Reset search when modal opens (data loads from cache instantly)
  useEffect(() => {
    if (!open) return;
    setSearch("");
    setFocusedIndex(-1);
  }, [open]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  /* =========================================================
     Filtered products
     ========================================================= */
  const filteredProducts = useMemo(() => {
    const filtered = products.filter((p) => {
      const s = search.toLowerCase();
      return (
        String(p.id).includes(s) ||
        p.name.toLowerCase().includes(s) ||
        (p.description && p.description.toLowerCase().includes(s)) ||
        (p.barcode && p.barcode.toLowerCase().includes(s))
      );
    });

    return filtered.sort((a, b) => {
      const aInStock = Number(a.available_quantity) > 0 ? 1 : 0;
      const bInStock = Number(b.available_quantity) > 0 ? 1 : 0;
      if (aInStock !== bInStock) return bInStock - aInStock;
      return String(a.name || "").localeCompare(String(b.name || ""), "ar");
    });
  }, [products, search]);

  /* =========================================================
     Keyboard navigation
     ========================================================= */
  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (filteredProducts.length > 0) {
          setFocusedIndex(0);
          setTimeout(() => {
            const firstItem = listRef.current?.querySelector(
              "[data-product-index='0']",
            ) as HTMLElement;
            firstItem?.focus();
          }, 0);
        }
      }
    },
    [filteredProducts],
  );

  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>, index: number) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(index + 1, filteredProducts.length - 1);
        setFocusedIndex(next);
        const el = listRef.current?.querySelector(
          `[data-product-index='${next}']`,
        ) as HTMLElement;
        el?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (index === 0) {
          setFocusedIndex(-1);
          searchInputRef.current?.focus();
        } else {
          const prev = index - 1;
          setFocusedIndex(prev);
          const el = listRef.current?.querySelector(
            `[data-product-index='${prev}']`,
          ) as HTMLElement;
          el?.focus();
        }
      } else if (e.key === "Escape") {
        onOpenChange(false);
      }
    },
    [filteredProducts.length, onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="max-w-2xl p-0 flex flex-col"
        style={{ height: 500, maxHeight: "80vh" }}
      >
        {/* ===== Header ===== */}
        <DialogHeader className="p-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Search className="size-5" />
            استعلام عن الأصناف
          </DialogTitle>
        </DialogHeader>

        {/* ===== Search ===== */}
        <div className="p-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Input
              ref={searchInputRef}
              autoFocus
              placeholder="ابحث بالكود أو الاسم أو الوصف أو الباركود... (Enter للتنقل)"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setFocusedIndex(-1);
              }}
              onKeyDown={handleSearchKeyDown}
              onFocus={(e) => e.target.select()}
              className="flex-1"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={refreshing}
              title="تحديث الأصناف"
              className="shrink-0"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
          {!loading && (
            <div className="text-xs text-muted-foreground mt-2">
              عدد النتائج: {filteredProducts.length} صنف
            </div>
          )}
        </div>

        {/* ===== Products List ===== */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-2"
        >
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="p-3 rounded-lg border space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              لا توجد نتائج
            </div>
          ) : (
            filteredProducts.map((product, index) => {
              const outOfStock = Number(product.available_quantity) <= 0;
              return (
                <div
                  key={product.id}
                  data-product-index={index}
                  tabIndex={outOfStock ? -1 : 0}
                  onKeyDown={(e) => !outOfStock && handleListKeyDown(e, index)}
                  className={`p-3 rounded-lg border transition outline-none ${
                    outOfStock
                      ? "opacity-50 cursor-not-allowed bg-muted/30"
                      : focusedIndex === index
                        ? "ring-2 ring-primary bg-muted"
                        : "hover:bg-muted/50"
                  }`}
                >
                  {/* Row 1: Name + Barcode */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium">{product.name}</div>
                    <div className="flex items-center gap-1.5">
                      {outOfStock && (
                        <span className="text-[10px] bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full font-medium">
                          نفذ
                        </span>
                      )}
                      {product.barcode && (
                        <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                          {product.barcode}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Details */}
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    <span>المصنع: {product.manufacturer || "-"}</span>
                    <span>
                      العبوة:{" "}
                      {invoiceType === "retail"
                        ? product.retail_package || "-"
                        : product.wholesale_package || "-"}
                    </span>
                    <span className="font-semibold text-foreground">
                      السعر: {product.price}
                    </span>
                    {product.discount_amount > 0 && (
                      <span className="text-destructive">
                        خصم: {product.discount_amount}
                      </span>
                    )}
                    <span>الرصيد: {product.available_quantity}</span>
                  </div>

                  {/* Row 3: Description if exists */}
                  {product.description && (
                    <div className="text-xs text-muted-foreground mt-1 opacity-70">
                      {product.description}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
