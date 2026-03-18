"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "@/services/api";
import { highlightText } from "@/lib/highlight-text";
import {
  buildPackagePickerOptions,
  fetchPackageStockMapFromMovements,
  mergePackageVariants,
  normalizePackageName,
  type PackageVariant,
} from "@/lib/package-stock";
import { multiWordMatch } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { CalendarDays, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";

interface Product {
  id: number;
  name: string;
  manufacturer: string;
  wholesale_package: string;
  retail_package: string;
  available_quantity: number;
  wholesale_price: number;
  percent: number;
  variant_stock?: PackageVariant[];
}

interface TransferItem {
  uid: string;
  product_id: number;
  variant_id: number;
  product_name: string;
  manufacturer: string;
  quantity: number;
  percent: number;
  price_addition: number;
  wholesale_package: string;
  retail_package: string;
  wholesale_price: number;
  available_quantity: number;
}

type PackageStockMap = Record<number, number>;

export default function StockTransferPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<TransferItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Variant package picker
  const [variantsMap, setVariantsMap] = useState<Record<number, any[]>>({});
  const [packagePickerProduct, setPackagePickerProduct] =
    useState<Product | null>(null);
  const [packageStockByProduct, setPackageStockByProduct] = useState<
    Record<number, PackageStockMap>
  >({});
  const [loadingPackageStockForProductId, setLoadingPackageStockForProductId] =
    useState<number | null>(null);

  // Manufacturers percentage map
  const [mfgPercentMap, setMfgPercentMap] = useState<Record<string, number>>(
    {},
  );

  const FROM_BRANCH_ID = 2;
  const TO_BRANCH_ID = 1;

  /* ========== Load Products ========== */
  useEffect(() => {
    (async () => {
      try {
        const [productsRes, mfgRes] = await Promise.all([
          api.get("/products/for-replace", {
            params: { branch_id: FROM_BRANCH_ID },
          }),
          api.get("/admin/manufacturers").catch(() => ({ data: [] })),
        ]);

        const prods = Array.isArray(productsRes.data) ? productsRes.data : [];
        setProducts(prods);

        // بناء خريطة نسب المصانع
        const pMap: Record<string, number> = {};
        for (const m of mfgRes.data || []) {
          pMap[m.name] = Number(m.percentage) || 0;
        }
        setMfgPercentMap(pMap);

        // جلب الأكواد الفرعية
        if (prods.length > 0) {
          try {
            const ids = prods.map((p: any) => p.id).join(",");
            const vRes = await api.get("/products/variants", {
              params: { product_ids: ids },
            });
            const map: Record<number, any[]> = {};
            for (const v of vRes.data || []) {
              if (!map[v.product_id]) map[v.product_id] = [];
              map[v.product_id].push(v);
            }
            setVariantsMap(map);
          } catch {
            /* silent */
          }
        }

        // Auto-add reorder products from low-stock-reorder page
        try {
          const reorderRaw = sessionStorage.getItem("reorder_product_ids");
          if (reorderRaw) {
            sessionStorage.removeItem("reorder_product_ids");
            const reorderIds: number[] = JSON.parse(reorderRaw);
            if (reorderIds.length > 0) {
              const autoItems: TransferItem[] = [];
              for (const pid of reorderIds) {
                const product = prods.find((p: Product) => p.id === pid);
                if (product && product.available_quantity > 0) {
                  const uid = `${product.id}_0`;
                  const pct = pMap[product.manufacturer] || 0;
                  autoItems.push({
                    uid,
                    product_id: product.id,
                    variant_id: 0,
                    product_name: product.name,
                    manufacturer: product.manufacturer,
                    quantity: 1,
                    percent: pct,
                    price_addition: pct ? 0 : 5,
                    wholesale_package: product.wholesale_package,
                    retail_package: product.retail_package,
                    wholesale_price: product.wholesale_price,
                    available_quantity: product.available_quantity,
                  });
                }
              }
              if (autoItems.length > 0) {
                setItems(autoItems);
                toast.success(`تم إضافة ${autoItems.length} صنف تلقائياً`);
              }
            }
          }
        } catch {
          /* silent */
        }
      } catch {
        toast.error("فشل تحميل الأصناف");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ========== Filter ========== */
  const filtered = products.filter((p) => {
    return (
      p.available_quantity > 0 &&
      multiWordMatch(search, String(p.id), p.name, p.manufacturer)
    );
  });

  /* ========== Keyboard Navigation ========== */
  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (filtered.length > 0) {
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
    [filtered],
  );

  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>, index: number) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(index + 1, filtered.length - 1);
        setFocusedIndex(next);
        const el = listRef.current?.querySelector(
          `[data-product-index='${next}']`,
        ) as HTMLElement;
        el?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (index === 0) {
          setFocusedIndex(-1);
          searchRef.current?.focus();
        } else {
          const prev = index - 1;
          setFocusedIndex(prev);
          const el = listRef.current?.querySelector(
            `[data-product-index='${prev}']`,
          ) as HTMLElement;
          el?.focus();
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        addProduct(filtered[index]);
      } else if (e.key === "Escape") {
        setShowModal(false);
      }
    },
    [filtered],
  );

  /* ========== Add Product ========== */
  const loadPackageStocks = useCallback(
    async (productId: number) => {
      if (packageStockByProduct[productId]) {
        return packageStockByProduct[productId];
      }

      const product = products.find((item) => item.id === productId);
      if (!product) return {} as PackageStockMap;
      const productVariants = mergePackageVariants(
        Array.isArray(product.variant_stock) ? product.variant_stock : [],
        variantsMap[productId] || [],
      );

      setLoadingPackageStockForProductId(productId);
      try {
        const stockMap = await fetchPackageStockMapFromMovements({
          productId: productId,
          productName: product.name,
          branchId: FROM_BRANCH_ID,
          basePackage: product.wholesale_package,
          variants: productVariants,
          packageField: "wholesale_package",
        });

        setPackageStockByProduct((prev) => ({
          ...prev,
          [productId]: stockMap,
        }));

        return stockMap;
      } catch {
        try {
          const res = await api.get("/stock/quantity-all", {
            params: {
              product_id: productId,
              branch_id: FROM_BRANCH_ID,
            },
          });

          const stockMap: PackageStockMap = {};
          for (const [variantId, quantity] of Object.entries(res.data || {})) {
            stockMap[Number(variantId)] = Number(quantity) || 0;
          }

          setPackageStockByProduct((prev) => ({
            ...prev,
            [productId]: stockMap,
          }));

          return stockMap;
        } catch {
          toast.error("فشل تحميل أرصدة العبوات");
          return {} as PackageStockMap;
        }
      } finally {
        setLoadingPackageStockForProductId((current) =>
          current === productId ? null : current,
        );
      }
    },
    [packageStockByProduct, products, variantsMap],
  );

  const getProductPackageVariants = useCallback(
    (product: Product | null) => {
      if (!product) return [] as PackageVariant[];

      return mergePackageVariants(
        Array.isArray(product.variant_stock) ? product.variant_stock : [],
        variantsMap[product.id] || [],
      );
    },
    [variantsMap],
  );

  const getPackageAvailableQuantity = useCallback(
    (productId: number, variantId: number, fallbackQuantity: number = 0) => {
      const stockMap = packageStockByProduct[productId];
      if (!stockMap) return variantId === 0 ? fallbackQuantity : 0;
      if (!Object.prototype.hasOwnProperty.call(stockMap, variantId)) {
        return variantId === 0 ? fallbackQuantity : 0;
      }
      return Number(stockMap[variantId] ?? 0);
    },
    [packageStockByProduct],
  );

  const packagePickerVariantOptions = useMemo(() => {
    if (!packagePickerProduct) return [];

    const basePackageName = normalizePackageName(
      packagePickerProduct.wholesale_package,
    );

    return buildPackagePickerOptions({
      basePackage: packagePickerProduct.wholesale_package,
      totalQuantity: packagePickerProduct.available_quantity,
      variants: getProductPackageVariants(packagePickerProduct),
      quantityMap: packageStockByProduct[packagePickerProduct.id],
      packageField: "wholesale_package",
      fallbackPrice: packagePickerProduct.wholesale_price,
    }).filter(
      (option) =>
        option.variantId !== 0 &&
        normalizePackageName(option.packageName) !== basePackageName,
    );
  }, [getProductPackageVariants, packagePickerProduct, packageStockByProduct]);

  const addProduct = (product: Product) => {
    // لو الصنف عنده أكواد فرعية → نعرض اختيار العبوة
    const variants = getProductPackageVariants(product);
    if (variants && variants.length > 0) {
      setPackagePickerProduct(product);
      setShowModal(false);
      void loadPackageStocks(product.id);
      return;
    }

    finalizeAddProduct(
      product,
      product.wholesale_package,
      product.wholesale_price,
      0,
      product.retail_package,
      product.available_quantity,
    );
  };

  const finalizeAddProduct = (
    product: any,
    pkg: string,
    price: number,
    variantId: number = 0,
    retailPkg?: string,
    availableQty: number = Number(product.available_quantity) || 0,
  ) => {
    const uid = `${product.id}_${variantId}`;
    if (items.find((i) => i.uid === uid)) {
      toast.warning("الصنف بهذه العبوة مضاف بالفعل");
      return;
    }

    const pct = mfgPercentMap[product.manufacturer] || 0;

    setItems((prev) => [
      ...prev,
      {
        uid,
        product_id: product.id,
        variant_id: variantId,
        product_name: product.name,
        manufacturer: product.manufacturer,
        quantity: 1,
        percent: pct,
        price_addition: pct ? 0 : 5,
        wholesale_package: pkg,
        retail_package: retailPkg || product.retail_package,
        wholesale_price: price,
        available_quantity: availableQty,
      },
    ]);
    setShowModal(false);
    setPackagePickerProduct(null);
  };

  /* ========== Update Item ========== */
  const updateItem = (
    uid: string,
    field: "quantity" | "percent" | "price_addition",
    value: number,
  ) => {
    setItems((prev) =>
      prev.map((i) => (i.uid === uid ? { ...i, [field]: value } : i)),
    );
  };

  /* ========== Remove Item ========== */
  const removeItem = (uid: string) => {
    setItems((prev) => prev.filter((i) => i.uid !== uid));
  };

  /* ========== Total ========== */
  const totalAmount = items.reduce((sum, i) => {
    const unitPrice = Number(i.wholesale_price) + (i.price_addition || 0);
    const base = i.quantity * unitPrice;
    const discount = base * (i.percent / 100);
    return sum + (base - discount);
  }, 0);

  /* ========== Go to Preview ========== */
  const goToPreview = () => {
    if (items.length === 0) {
      toast.error("أضف صنف واحد على الأقل");
      return;
    }

    // التحقق من الرصيد المتاح
    const overStock = items.filter(
      (item) => Number(item.quantity) > Number(item.available_quantity),
    );
    if (overStock.length > 0) {
      overStock.forEach((item) => {
        toast.error(
          `الصنف "${item.product_name}" الكمية (${item.quantity}) أكبر من الرصيد المتاح (${item.available_quantity})`,
        );
      });
      return;
    }

    const payload = {
      from_branch_id: FROM_BRANCH_ID,
      to_branch_id: TO_BRANCH_ID,
      total_amount: totalAmount,
      items: items.map((i) => {
        const unitPrice = Number(i.wholesale_price) + (i.price_addition || 0);
        const base = i.quantity * unitPrice;
        const discount = base * (i.percent / 100);
        return {
          product_id: i.product_id,
          variant_id: i.variant_id,
          quantity: i.quantity,
          final_price: base - discount,
          package_name: i.wholesale_package,
          wholesale_package: i.wholesale_package,
          retail_package: i.retail_package,
        };
      }),
    };

    // Store in sessionStorage and navigate
    sessionStorage.setItem("transfer_payload", JSON.stringify(payload));
    sessionStorage.setItem("transfer_items", JSON.stringify(items));
    router.push("/stock-transfer/preview");
  };

  /* ========== Render ========== */
  if (loading) {
    return (
      <div dir="rtl" className="max-w-xl mx-auto space-y-4 py-6 px-4">
        <Skeleton className="h-8 w-48 mx-auto mb-6" />
        <Skeleton className="h-10 w-full rounded-md" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="max-w-xl mx-auto space-y-4 py-6 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">فاتورة تحويل للمعرض</h1>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => {
            const today = new Date().toISOString().split("T")[0];
            router.push(`/transfers/by-date?date=${today}`);
          }}
        >
          <CalendarDays className="h-4 w-4" />
          تحويلات اليوم
        </Button>
      </div>

      {/* ===== اختيار صنف ===== */}
      <Button className="w-full" onClick={() => setShowModal(true)}>
        اختر صنف
      </Button>

      {/* ===== الأصناف المضافة ===== */}
      {items.length > 0 && (
        <Label className="text-sm text-muted-foreground">الأصناف المضافة</Label>
      )}

      {items.map((item) => {
        const unitPrice =
          Number(item.wholesale_price) + (item.price_addition || 0);
        const base = item.quantity * unitPrice;
        const discount = base * (item.percent / 100);
        const final = base - discount;

        return (
          <Card key={item.uid}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                {/* حذف */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 shrink-0"
                  onClick={() => removeItem(item.uid)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>

                {/* النسبة */}
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">
                    نسبة%
                  </span>
                  <Input
                    type="number"
                    placeholder="%"
                    className="w-16 text-center bg-muted"
                    value={item.percent || ""}
                    readOnly
                  />
                </div>

                {/* إضافة للسعر */}
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">
                    +سعر
                  </span>
                  <Input
                    type="number"
                    placeholder="+سعر"
                    className="w-16 text-center"
                    value={item.price_addition || ""}
                    onChange={(e) =>
                      updateItem(
                        item.uid,
                        "price_addition",
                        Number(e.target.value) || 0,
                      )
                    }
                  />
                </div>

                {/* الكمية */}
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">
                    الكمية
                  </span>
                  <Input
                    type="number"
                    className="w-20 text-center"
                    value={item.quantity || ""}
                    onChange={(e) =>
                      updateItem(
                        item.uid,
                        "quantity",
                        Number(e.target.value) || 1,
                      )
                    }
                  />
                  {Number(item.quantity) > Number(item.available_quantity) && (
                    <div className="text-[11px] text-red-500 mt-1">
                      الرصيد المتاح: {item.available_quantity}
                    </div>
                  )}
                </div>

                {/* التفاصيل */}
                <div className="flex-1 text-right min-w-0">
                  <div className="font-bold text-sm truncate">
                    {item.product_name} – {item.manufacturer}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {item.wholesale_package} ×{" "}
                    {item.wholesale_price.toLocaleString()}
                    {(item.price_addition || 0) > 0 && (
                      <span className="text-green-600 font-medium">
                        {" "}
                        + {item.price_addition} = {unitPrice.toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    = {Math.round(final).toLocaleString()} ج
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* ===== الإجمالي ===== */}
      {items.length > 0 && (
        <>
          <Card>
            <CardContent className="p-4 text-center font-bold">
              الإجمالي: {totalAmount.toFixed(2)} جنيه
            </CardContent>
          </Card>

          <Button
            className="w-full text-base py-6"
            variant="default"
            onClick={goToPreview}
          >
            عرض التحويل
          </Button>
        </>
      )}

      {/* ===== مودال اختيار الصنف ===== */}
      <Dialog
        open={showModal}
        onOpenChange={(open) => {
          setShowModal(open);
          if (open) {
            setFocusedIndex(-1);
            setTimeout(() => searchRef.current?.focus(), 100);
          }
        }}
      >
        <DialogContent
          dir="rtl"
          className="max-w-md p-0 flex flex-col"
          style={{ height: 420, maxHeight: "75vh" }}
        >
          <DialogHeader className="p-4 border-b shrink-0">
            <DialogTitle>اختر صنف</DialogTitle>
          </DialogHeader>

          <div className="p-4 border-b shrink-0">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchRef}
                placeholder="ابحث عن صنف... (Enter للتنقل)"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setFocusedIndex(-1);
                }}
                onKeyDown={handleSearchKeyDown}
                className="pr-9"
                autoFocus
              />
            </div>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-1">
            {filtered.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                لا توجد نتائج
              </div>
            ) : (
              filtered.map((p, index) => (
                <div
                  key={p.id}
                  data-product-index={index}
                  tabIndex={0}
                  role="button"
                  className={`w-full text-right px-3 py-2.5 rounded-lg transition-colors outline-none cursor-pointer ${
                    focusedIndex === index
                      ? "ring-2 ring-primary bg-muted"
                      : "hover:bg-muted"
                  }`}
                  onClick={() => addProduct(p)}
                  onKeyDown={(e) => handleListKeyDown(e, index)}
                >
                  <div className="flex items-center gap-2">
                    <div className="font-semibold text-sm">
                      {highlightText(p.name, search)} –{" "}
                      {highlightText(p.manufacturer, search)}
                    </div>
                    {variantsMap[p.id]?.length > 0 && (
                      <span className="text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full">
                        {variantsMap[p.id].length + 1} عبوات
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {p.wholesale_package} • رصيد: {p.available_quantity}
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== مودال اختيار العبوة ===== */}
      <Dialog
        open={!!packagePickerProduct}
        onOpenChange={(open) => {
          if (!open) setPackagePickerProduct(null);
        }}
      >
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              اختر العبوة — {packagePickerProduct?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {loadingPackageStockForProductId === packagePickerProduct?.id && (
              <div className="text-sm text-muted-foreground text-center py-2">
                جاري تحميل أرصدة العبوات...
              </div>
            )}
            {/* العبوة الأساسية */}
            {packagePickerProduct &&
              (() => {
                const availableQty = getPackageAvailableQuantity(
                  packagePickerProduct.id,
                  0,
                  packagePickerProduct.available_quantity,
                );
                const disabled = availableQty <= 0;

                return (
                  <button
                    type="button"
                    disabled={disabled}
                    className={`w-full p-3 rounded-lg border transition text-right ${
                      disabled
                        ? "opacity-50 cursor-not-allowed bg-muted/40"
                        : "hover:bg-muted"
                    }`}
                    onClick={() => {
                      if (disabled) return;
                      finalizeAddProduct(
                        packagePickerProduct,
                        packagePickerProduct.wholesale_package,
                        packagePickerProduct.wholesale_price,
                        0,
                        packagePickerProduct.retail_package,
                        availableQty,
                      );
                    }}
                  >
                    <div className="font-medium">
                      {packagePickerProduct.wholesale_package}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      السعر: {packagePickerProduct.wholesale_price} ج
                    </div>
                    <div
                      className={`text-sm mt-1 ${
                        availableQty > 0 ? "text-green-600" : "text-red-500"
                      }`}
                    >
                      الرصيد: {availableQty}
                    </div>
                  </button>
                );
              })()}

            {/* العبوات الفرعية */}
            {packagePickerProduct &&
              packagePickerVariantOptions.map((option) => {
                const disabled = option.quantity <= 0;

                return (
                  <button
                    key={option.key}
                    type="button"
                    disabled={disabled}
                    className={`w-full p-3 rounded-lg border transition text-right ${
                      disabled
                        ? "opacity-50 cursor-not-allowed bg-muted/40"
                        : "hover:bg-muted"
                    }`}
                    onClick={() => {
                      if (disabled) return;
                      finalizeAddProduct(
                        packagePickerProduct,
                        option.packageName,
                        Number(option.price) ||
                          packagePickerProduct.wholesale_price,
                        option.variantId,
                        option.retailPackage ||
                          packagePickerProduct.retail_package,
                        option.quantity,
                      );
                    }}
                  >
                    <div className="font-medium">{option.packageName}</div>
                    <div className="text-sm text-muted-foreground">
                      السعر:{" "}
                      {Number(option.price) ||
                        packagePickerProduct.wholesale_price}{" "}
                      ج
                      {option.variant?.label && (
                        <span className="mr-2">({option.variant.label})</span>
                      )}
                    </div>
                    <div
                      className={`text-sm mt-1 ${
                        option.quantity > 0 ? "text-green-600" : "text-red-500"
                      }`}
                    >
                      الرصيد: {option.quantity}
                    </div>
                  </button>
                );
              })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
