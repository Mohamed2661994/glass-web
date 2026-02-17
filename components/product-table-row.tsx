"use client";

import { Button } from "@/components/ui/button";
import { Copy, Pencil, Check, Trash2, Printer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ProductTableRowProps {
  product: any;
  variants?: any[];
  onEdit?: () => void;
  onDelete?: () => void;
  onToggle?: (value: boolean) => Promise<void>;
  onPrintBarcode?: (product: any) => void;
}

export function ProductTableRow({
  product,
  variants = [],
  onEdit,
  onDelete,
  onToggle,
  onPrintBarcode,
}: ProductTableRowProps) {
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

  return (
    <>
      {/* Main product row */}
      <tr
        className={`border-b border-border/50 hover:bg-muted/50 transition-colors ${
          !active ? "opacity-50 grayscale" : ""
        }`}
      >
        {/* الاسم */}
        <td className="p-3">
          <div className="font-semibold text-sm">
            {product.name}
            {product.manufacturer ? ` - ${product.manufacturer}` : ""}
          </div>
        </td>

        {/* الباركود */}
        <td className="p-3">
          <div className="flex items-center gap-1 font-mono text-xs">
            <span>{product.barcode || "—"}</span>
            {product.barcode && (
              <>
                <button
                  onClick={() =>
                    handleCopy(product.barcode, `tbl-${product.id}`)
                  }
                  className="p-0.5 rounded hover:bg-muted transition-colors"
                >
                  {copiedId === `tbl-${product.id}` ? (
                    <Check className="h-3 w-3 text-green-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
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
        </td>

        {/* العبوة جملة */}
        <td className="p-3 text-xs text-center">
          {product.wholesale_package || "—"}
        </td>

        {/* سعر شراء جملة */}
        <td className="p-3 text-xs text-center font-medium">
          {fmt(product.purchase_price)}
        </td>

        {/* سعر بيع جملة */}
        <td className="p-3 text-center">
          <span className="text-sm font-bold text-sky-600 dark:text-sky-400">
            {fmt(product.wholesale_price)}
          </span>
        </td>

        {/* العبوة قطاعي */}
        <td className="p-3 text-xs text-center">
          {product.retail_package || "—"}
        </td>

        {/* سعر شراء قطاعي */}
        <td className="p-3 text-xs text-center font-medium">
          {fmt(product.retail_purchase_price)}
        </td>

        {/* سعر بيع قطاعي */}
        <td className="p-3 text-center">
          <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
            {fmt(product.retail_price)}
          </span>
        </td>

        {/* خصم */}
        <td className="p-3 text-center text-xs">
          {product.discount_amount > 0 ? (
            <span className="text-red-500 font-bold">
              {fmt(product.discount_amount)}
            </span>
          ) : (
            "—"
          )}
        </td>

        {/* حالة */}
        <td className="p-3 text-center">
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`relative h-5 w-9 rounded-full transition-all duration-300 shrink-0
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
        </td>

        {/* أكشن */}
        <td className="p-3">
          <div className="flex items-center gap-1 justify-center">
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                onClick={onDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={onEdit}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        </td>
      </tr>

      {/* Variant rows */}
      {variants.map((v, i) => (
        <tr
          key={v.id || i}
          className={`border-b border-border/30 bg-muted/20 hover:bg-muted/40 transition-colors text-xs ${
            !active ? "opacity-50 grayscale" : ""
          }`}
        >
          <td className="p-2 pr-8 text-muted-foreground">↳ كود فرعي {i + 1}</td>
          <td className="p-2">
            <div className="flex items-center gap-1 font-mono">
              <span>{v.barcode || "—"}</span>
              {v.barcode && (
                <>
                  <button
                    onClick={() =>
                      handleCopy(v.barcode, `tblv-${product.id}-${i}`)
                    }
                    className="p-0.5 rounded hover:bg-muted transition-colors"
                  >
                    {copiedId === `tblv-${product.id}-${i}` ? (
                      <Check className="h-2.5 w-2.5 text-green-600" />
                    ) : (
                      <Copy className="h-2.5 w-2.5" />
                    )}
                  </button>
                  <button
                    onClick={() =>
                      onPrintBarcode?.({ ...product, barcode: v.barcode })
                    }
                    className="p-0.5 rounded hover:bg-muted transition-colors"
                  >
                    <Printer className="h-2.5 w-2.5" />
                  </button>
                </>
              )}
            </div>
          </td>
          <td className="p-2 text-center">{v.wholesale_package || "—"}</td>
          <td className="p-2 text-center font-medium">
            {fmt(v.purchase_price)}
          </td>
          <td className="p-2 text-center">
            <span className="font-bold text-sky-600 dark:text-sky-400">
              {fmt(v.wholesale_price)}
            </span>
          </td>
          <td className="p-2 text-center">{v.retail_package || "—"}</td>
          <td className="p-2 text-center font-medium">
            {fmt(v.retail_purchase_price)}
          </td>
          <td className="p-2 text-center">
            <span className="font-bold text-amber-600 dark:text-amber-400">
              {fmt(v.retail_price)}
            </span>
          </td>
          <td className="p-2 text-center">
            {v.discount_amount > 0 ? (
              <span className="text-red-500 font-bold">
                {fmt(v.discount_amount)}
              </span>
            ) : (
              "—"
            )}
          </td>
          <td className="p-2" />
          <td className="p-2" />
        </tr>
      ))}
    </>
  );
}
