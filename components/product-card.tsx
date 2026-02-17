"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Pencil, Printer, Check, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface Variant {
  id: number;
  product_id: number;

  label: string;
  barcode: string;
  wholesale_package: string;
  retail_package: string;
  purchase_price: number;
  retail_purchase_price: number;
  wholesale_price: number;
  retail_price: number;
  discount_amount?: number;
}

interface ProductCardProps {
  product: any;
  variants?: Variant[];
  onEdit?: () => void;
  onDelete?: () => void;
  onToggle?: (value: boolean) => Promise<void>;
  onPrintBarcode?: (product: any) => void;
}

export function ProductCard({
  product,
  variants = [],
  onEdit,
  onDelete,
  onToggle,
  onPrintBarcode,
}: ProductCardProps) {
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

  // Build unified packages array (original + variants)
  const packages = [
    {
      wholesale_package: product.wholesale_package,
      retail_package: product.retail_package,
      purchase_price: product.purchase_price,
      retail_purchase_price: product.retail_purchase_price,
      wholesale_price: product.wholesale_price,
      retail_price: product.retail_price,
      barcode: product.barcode,
      discount_amount: product.discount_amount || 0,
    },
    ...variants.map((v) => ({
      wholesale_package: v.wholesale_package,
      retail_package: v.retail_package,
      purchase_price: v.purchase_price,
      retail_purchase_price: v.retail_purchase_price,
      wholesale_price: v.wholesale_price,
      retail_price: v.retail_price,
      barcode: v.barcode,
      discount_amount: v.discount_amount || 0,
    })),
  ];
  const pkgCount = packages.length;
  const base = packages[0];

  // عمود القطاعي يظهر بس لو البيانات مختلفة عن الأساسي
  const pkgHasRetail = packages.map((pkg, i) => {
    if (i === 0) return true; // الأساسية دايماً تظهر
    const samePrice = Number(pkg.retail_price) === Number(base.retail_price);
    const samePurchase =
      Number(pkg.retail_purchase_price) === Number(base.retail_purchase_price);
    const samePackage =
      (pkg.retail_package || "") === (base.retail_package || "");
    // لو كل القيم متطابقة مع الأساسي → نخفي العمود
    return !(samePrice && samePurchase && samePackage);
  });
  const retailCount = pkgHasRetail.filter(Boolean).length;
  const totalCols = pkgCount + retailCount;
  const hasAnyDiscount = packages.some((p) => p.discount_amount > 0);

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
              {product.manufacturer ? ` - ${product.manufacturer}` : ""}
            </h3>
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
                onClick={() =>
                  handleCopy(product.barcode, `main-${product.id}`)
                }
                className="p-0.5 rounded hover:bg-muted transition-colors"
              >
                {copiedId === `main-${product.id}` ? (
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
      </div>

      {/* ===== SPLIT PRICING ===== */}
      {hasVariants ? (
        /* ---- Multi-package: 4+ column layout ---- */
        <div className="text-center">
          {/* Section Headers */}
          <div
            className="grid"
            style={{ gridTemplateColumns: `repeat(${totalCols}, 1fr)` }}
          >
            <div
              className="bg-sky-500/10 dark:bg-sky-500/15 py-1.5 border-l border-border/50"
              style={{ gridColumn: `span ${pkgCount}` }}
            >
              <div className="text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                جملة
              </div>
            </div>
            <div
              className="bg-amber-500/10 dark:bg-amber-500/15 py-1.5"
              style={{ gridColumn: `span ${retailCount}` }}
            >
              <div className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                قطاعي
              </div>
            </div>
          </div>

          {/* Price Data Columns */}
          <div
            className="grid"
            style={{ gridTemplateColumns: `repeat(${totalCols}, 1fr)` }}
          >
            {/* Wholesale columns */}
            {packages.map((pkg, i) => (
              <div
                key={`w-${i}`}
                className={`bg-sky-500/10 dark:bg-sky-500/15 p-2 space-y-1.5 ${
                  i < pkgCount - 1
                    ? "border-l border-dashed border-sky-500/30"
                    : "border-l border-border/50"
                }`}
              >
                <div>
                  <div className="text-[10px] text-muted-foreground">بيع</div>
                  <div className="text-sm font-black text-sky-600 dark:text-sky-400">
                    {fmt(pkg.wholesale_price)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">شراء</div>
                  <div className="text-xs font-semibold">
                    {fmt(pkg.purchase_price)}
                  </div>
                </div>
                <div className="pt-1 border-t border-sky-500/20">
                  <div className="text-[10px] text-muted-foreground">
                    العبوة
                  </div>
                  <div className="text-[10px] font-medium truncate">
                    {pkg.wholesale_package || "-"}
                  </div>
                </div>
                {pkg.barcode && i > 0 && (
                  <div className="flex items-center justify-center gap-0.5 text-[9px] text-muted-foreground font-mono">
                    <span>{pkg.barcode}</span>
                    <button
                      onClick={() =>
                        handleCopy(pkg.barcode, `var1-${product.id}-${i}`)
                      }
                      className="p-0.5 rounded hover:bg-muted transition-colors"
                    >
                      {copiedId === `var1-${product.id}-${i}` ? (
                        <Check className="h-2.5 w-2.5 text-green-600" />
                      ) : (
                        <Copy className="h-2.5 w-2.5" />
                      )}
                    </button>
                    <button
                      onClick={() =>
                        onPrintBarcode?.({ ...product, barcode: pkg.barcode })
                      }
                      className="p-0.5 rounded hover:bg-muted transition-colors"
                    >
                      <Printer className="h-2.5 w-2.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}

            {/* Retail columns - only for packages with retail data */}
            {packages.map((pkg, i) =>
              !pkgHasRetail[i] ? null : (
                <div
                  key={`r-${i}`}
                  className={`bg-amber-500/10 dark:bg-amber-500/15 p-2 space-y-1.5 ${
                    i < pkgCount - 1 && pkgHasRetail.slice(i + 1).some(Boolean)
                      ? "border-l border-dashed border-amber-500/30"
                      : ""
                  }`}
                >
                  <div>
                    <div className="text-[10px] text-muted-foreground">بيع</div>
                    <div className="text-sm font-black text-amber-600 dark:text-amber-400">
                      {fmt(pkg.retail_price)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground">
                      شراء
                    </div>
                    <div className="text-xs font-semibold">
                      {fmt(pkg.retail_purchase_price)}
                    </div>
                  </div>
                  <div className="pt-1 border-t border-amber-500/20">
                    <div className="text-[10px] text-muted-foreground">
                      العبوة
                    </div>
                    <div className="text-[10px] font-medium truncate">
                      {pkg.retail_package || "-"}
                    </div>
                  </div>
                  {pkg.barcode && i > 0 && (
                    <div className="flex items-center justify-center gap-0.5 text-[9px] text-muted-foreground font-mono">
                      <span>{pkg.barcode}</span>
                      <button
                        onClick={() =>
                          handleCopy(pkg.barcode, `var2-${product.id}-${i}`)
                        }
                        className="p-0.5 rounded hover:bg-muted transition-colors"
                      >
                        {copiedId === `var2-${product.id}-${i}` ? (
                          <Check className="h-2.5 w-2.5 text-green-600" />
                        ) : (
                          <Copy className="h-2.5 w-2.5" />
                        )}
                      </button>
                      <button
                        onClick={() =>
                          onPrintBarcode?.({ ...product, barcode: pkg.barcode })
                        }
                        className="p-0.5 rounded hover:bg-muted transition-colors"
                      >
                        <Printer className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  )}
                </div>
              ),
            )}
          </div>

          {/* Discount row under retail columns */}
          {hasAnyDiscount && (
            <div
              className="grid"
              style={{ gridTemplateColumns: `repeat(${totalCols}, 1fr)` }}
            >
              <div style={{ gridColumn: `span ${pkgCount}` }} />
              {packages.map((pkg, i) =>
                !pkgHasRetail[i] ? null : (
                  <div
                    key={`d-${i}`}
                    className={`bg-red-500/10 py-1.5 ${
                      i < pkgCount - 1 &&
                      pkgHasRetail.slice(i + 1).some(Boolean)
                        ? "border-l border-dashed border-red-500/30"
                        : ""
                    }`}
                  >
                    {pkg.discount_amount > 0 ? (
                      <span className="text-red-500 text-xs font-bold">
                        خصم {fmt(pkg.discount_amount)} ج
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">
                        —
                      </span>
                    )}
                  </div>
                ),
              )}
            </div>
          )}
        </div>
      ) : (
        /* ---- Single-package: 2-column layout ---- */
        <>
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
                  <div className="text-[10px] text-muted-foreground">
                    العبوة
                  </div>
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
                  <div className="text-[10px] text-muted-foreground">
                    العبوة
                  </div>
                  <div className="text-xs font-medium truncate">
                    {product.retail_package || "-"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Discount for single package */}
          {product.discount_amount > 0 && (
            <div className="bg-red-500/10 text-center py-2 px-4">
              <span className="text-red-500 text-sm font-bold">
                خصم {fmt(product.discount_amount)} ج
              </span>
            </div>
          )}
        </>
      )}

      {/* ===== FOOTER ===== */}
      <div className="flex justify-end items-center gap-2 p-3 pt-2 pb-3">
        {onDelete && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3 ml-1" />
            حذف
          </Button>
        )}
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
