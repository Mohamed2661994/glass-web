"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Pencil, Check, Trash2, Printer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { highlightText } from "@/lib/highlight-text";

interface ProductCompactCardProps {
  product: any;
  variants?: any[];
  onEdit?: () => void;
  onDelete?: () => void;
  onToggle?: (value: boolean) => Promise<void>;
  onPrintBarcode?: (product: any) => void;
  searchQuery?: string;
}

export function ProductCompactCard({
  product,
  variants = [],
  onEdit,
  onDelete,
  onToggle,
  onPrintBarcode,
  searchQuery = "",
}: ProductCompactCardProps) {
  const [active, setActive] = useState(product.is_active);
  const [toggling, setToggling] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (barcode: string, id: string) => {
    navigator.clipboard.writeText(barcode);
    setCopiedId(id);
    toast.success("تم نسخ الباركود");
    setTimeout(() => setCopiedId(null), 1500);
  };

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

  const hasVariants = variants.length > 0;

  return (
    <Card
      className={`rounded-xl border overflow-hidden transition-all duration-200 hover:shadow-md ${
        !active ? "opacity-50 grayscale" : ""
      }`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between p-2.5 gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold truncate">
            {highlightText(product.name, searchQuery)}
            {product.manufacturer ? (
              <>
                {" - "}
                {highlightText(product.manufacturer, searchQuery)}
              </>
            ) : (
              ""
            )}
          </h3>
          <div className="flex items-center gap-2 mt-0.5">
            {product.barcode && (
              <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground font-mono">
                <span>{highlightText(product.barcode, searchQuery)}</span>
                <button
                  onClick={() =>
                    handleCopy(product.barcode, `cmp-${product.id}`)
                  }
                  className="p-0.5 rounded hover:bg-muted transition-colors"
                >
                  {copiedId === `cmp-${product.id}` ? (
                    <Check className="h-2.5 w-2.5 text-green-600" />
                  ) : (
                    <Copy className="h-2.5 w-2.5" />
                  )}
                </button>
                <button
                  onClick={() => onPrintBarcode?.(product)}
                  className="p-0.5 rounded hover:bg-muted transition-colors"
                >
                  <Printer className="h-2.5 w-2.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`relative h-4 w-8 rounded-full transition-all duration-300
              ${active ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"}
              ${toggling ? "opacity-60 cursor-not-allowed" : ""}
            `}
          >
            <span
              className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all duration-300
                ${active ? "right-0.5" : "left-0.5"}
              `}
            />
          </button>
        </div>
      </div>

      {/* Prices - Compact 2 column */}
      <div className="grid grid-cols-2 text-center">
        <div className="bg-sky-500/10 dark:bg-sky-500/15 py-2 px-2 border-l border-border/50">
          <div className="text-[10px] text-sky-600 dark:text-sky-400 font-semibold mb-0.5">
            جملة
          </div>
          <div className="text-sm font-black text-sky-600 dark:text-sky-400">
            {fmt(product.wholesale_price)}
          </div>
          <div className="text-[9px] text-muted-foreground">
            شراء: {fmt(product.purchase_price)}
          </div>
        </div>
        <div className="bg-amber-500/10 dark:bg-amber-500/15 py-2 px-2">
          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold mb-0.5">
            قطاعي
          </div>
          <div className="text-sm font-black text-amber-600 dark:text-amber-400">
            {fmt(product.retail_price)}
          </div>
          <div className="text-[9px] text-muted-foreground">
            شراء: {fmt(product.retail_purchase_price)}
          </div>
        </div>
      </div>

      {/* Discount + Variants badge + Actions */}
      <div className="flex items-center justify-between p-2 gap-1">
        <div className="flex items-center gap-1.5">
          {product.discount_amount > 0 && (
            <span className="text-[10px] text-red-500 font-bold bg-red-500/10 px-1.5 py-0.5 rounded">
              خصم {fmt(product.discount_amount)}
            </span>
          )}
          {hasVariants && (
            <span className="text-[10px] text-purple-600 dark:text-purple-400 font-medium bg-purple-500/10 px-1.5 py-0.5 rounded">
              {variants.length} أكواد فرعية
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-red-500 hover:text-red-600"
              onClick={onDelete}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={onEdit}
          >
            <Pencil className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
