"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Pencil } from "lucide-react";
import { useState } from "react";

interface ProductCardProps {
  product: any;
  onEdit?: () => void;
  onToggle?: (value: boolean) => Promise<void>;
}

export function ProductCard({ product, onEdit, onToggle }: ProductCardProps) {
  const [active, setActive] = useState(product.is_active);
  const [toggling, setToggling] = useState(false);

  const formatMoney = (value: number) =>
    Number(value || 0).toLocaleString("ar-EG", {
      minimumFractionDigits: 2,
    });

  const handleToggle = async () => {
    if (toggling) return;

    const newValue = !active;
    setActive(newValue); // Optimistic UI
    setToggling(true);

    try {
      await onToggle?.(newValue);
    } catch (err) {
      setActive(!newValue); // rollback لو فشل
    } finally {
      setToggling(false);
    }
  };

  return (
    <Card className="rounded-2xl border shadow-sm hover:shadow-lg transition-all duration-300 p-5 space-y-5 text-right relative overflow-hidden">
      {/* HEADER */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xl font-bold flex items-center gap-2">
            {product.name}

            {product.discount_amount > 0 && (
              <span className="bg-green-100 text-green-600 text-xs px-2 py-1 rounded-full">
                خصم {formatMoney(product.discount_amount)} ج
              </span>
            )}
          </div>

          <div className="text-sm text-muted-foreground mt-1">
            {product.manufacturer || "-"}
          </div>
        </div>

        {/* SWITCH */}
        <button
          onClick={handleToggle}
          disabled={toggling}
          className={`relative flex items-center h-6 w-12 rounded-full transition-all duration-300
            ${active ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"}
            ${toggling ? "opacity-70 cursor-not-allowed" : ""}
          `}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md transition-all duration-300
              ${active ? "right-1" : "left-1"}
            `}
          />
        </button>
      </div>

      {/* BARCODE */}
      <div className="flex items-center justify-between text-sm bg-muted/30 rounded-xl px-3 py-2">
        <span className="text-muted-foreground">{product.barcode || "-"}</span>

        <Button
          variant="ghost"
          size="icon"
          onClick={() =>
            product.barcode && navigator.clipboard.writeText(product.barcode)
          }
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>

      {/* PACKAGES */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="bg-muted/40 p-3 rounded-xl">
          <div className="text-xs text-muted-foreground">عبوة جملة</div>
          <div className="font-medium">{product.wholesale_package || "-"}</div>
        </div>

        <div className="bg-muted/40 p-3 rounded-xl">
          <div className="text-xs text-muted-foreground">عبوة قطاعي</div>
          <div className="font-medium">{product.retail_package || "-"}</div>
        </div>
      </div>

      {/* PRICES */}
      <div className="grid grid-cols-2 gap-4 text-sm border-t pt-4">
        <div>
          <div className="text-xs text-muted-foreground">شراء جملة</div>
          <div className="font-semibold">
            {formatMoney(product.purchase_price)} ج
          </div>
        </div>

        <div>
          <div className="text-xs text-muted-foreground">بيع جملة</div>
          <div className="font-semibold">
            {formatMoney(product.wholesale_price)} ج
          </div>
        </div>

        <div>
          <div className="text-xs text-muted-foreground">شراء قطاعي</div>
          <div className="font-semibold">
            {formatMoney(product.retail_purchase_price)} ج
          </div>
        </div>

        <div>
          <div className="text-xs text-muted-foreground">بيع قطاعي</div>
          <div className="font-semibold text-primary">
            {formatMoney(product.retail_price)} ج
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="flex justify-end border-t pt-4">
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="h-4 w-4 ml-1" />
          تعديل
        </Button>
      </div>
    </Card>
  );
}
