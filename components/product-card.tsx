"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Pencil, Printer } from "lucide-react";
import { useState } from "react";

interface ProductCardProps {
  product: any;
  onEdit?: () => void;
  onToggle?: (value: boolean) => Promise<void>;
  onPrintBarcode?: (product: any) => void;
}

export function ProductCard({
  product,
  onEdit,
  onToggle,
  onPrintBarcode,
}: ProductCardProps) {
  const [active, setActive] = useState(product.is_active);
  const [toggling, setToggling] = useState(false);

  const fmt = (v: number) =>
    Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

  const handleToggle = async () => {
    if (toggling) return;
    const newValue = !active;
    setActive(newValue);
    setToggling(true);
    try {
      await onToggle?.(newValue);
    } catch {
      setActive(!newValue);
    } finally {
      setToggling(false);
    }
  };

  return (
    <Card
      className={`rounded-2xl border overflow-hidden transition-all duration-300 hover:shadow-lg ${
        !active ? "opacity-50 grayscale" : ""
      }`}
    >
      {/* ===== HEADER ===== */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold truncate leading-tight">
              {product.name}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {product.manufacturer || "—"}
            </p>
          </div>
          <div className="flex items-center shrink-0">
            <button
              onClick={handleToggle}
              disabled={toggling}
              className={`relative h-5 w-10 rounded-full transition-all duration-300 shrink-0
                ${active ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"}
                ${toggling ? "opacity-60 cursor-not-allowed" : ""}
              `}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-300
                  ${active ? "right-0.5" : "left-0.5"}
                `}
              />
            </button>
          </div>
        </div>

        {/* BARCODE */}
        <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground font-mono">
          <span>{product.barcode || "—"}</span>
          {product.barcode && (
            <>
              <button
                onClick={() => navigator.clipboard.writeText(product.barcode)}
                className="p-0.5 rounded hover:bg-muted transition-colors"
              >
                <Copy className="h-3 w-3" />
              </button>
              <button
                onClick={() => onPrintBarcode?.(product)}
                className="p-0.5 rounded hover:bg-muted transition-colors"
              >
                <Printer className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ===== SPLIT PRICING ===== */}
      <div className="grid grid-cols-2 text-center">
        {/* جملة - RIGHT */}
        <div className="bg-sky-500/10 dark:bg-sky-500/15 p-3 border-l border-border/50">
          <div className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 mb-2">
            جملة
          </div>
          <div className="space-y-2">
            <div>
              <div className="text-[10px] text-muted-foreground">بيع</div>
              <div className="text-base font-black text-sky-600 dark:text-sky-400">
                {fmt(product.wholesale_price)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">شراء</div>
              <div className="text-sm font-semibold">
                {fmt(product.purchase_price)}
              </div>
            </div>
            <div className="pt-1 border-t border-sky-500/20">
              <div className="text-[10px] text-muted-foreground">العبوة</div>
              <div className="text-xs font-medium truncate">
                {product.wholesale_package || "-"}
              </div>
            </div>
          </div>
        </div>

        {/* قطاعي - LEFT */}
        <div className="bg-amber-500/10 dark:bg-amber-500/15 p-3">
          <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 mb-2">
            قطاعي
          </div>
          <div className="space-y-2">
            <div>
              <div className="text-[10px] text-muted-foreground">بيع</div>
              <div className="text-base font-black text-amber-600 dark:text-amber-400">
                {fmt(product.retail_price)}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground">شراء</div>
              <div className="text-sm font-semibold">
                {fmt(product.retail_purchase_price)}
              </div>
            </div>
            <div className="pt-1 border-t border-amber-500/20">
              <div className="text-[10px] text-muted-foreground">العبوة</div>
              <div className="text-xs font-medium truncate">
                {product.retail_package || "-"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== DISCOUNT ===== */}
      {product.discount_amount > 0 && (
        <div className="bg-red-500/10 text-center py-2 px-4">
          <span className="text-red-500 text-sm font-bold">
            خصم {fmt(product.discount_amount)} ج
          </span>
        </div>
      )}

      {/* ===== FOOTER ===== */}
      <div className="flex justify-end p-3 pt-2 pb-3">
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={onEdit}
        >
          <Pencil className="h-3 w-3 ml-1" />
          تعديل
        </Button>
      </div>
    </Card>
  );
}
