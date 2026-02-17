"use client";

import { useEffect, useRef, useState } from "react";
import api from "@/services/api";
import { highlightText } from "@/lib/highlight-text";
import { noSpaces } from "@/lib/utils";
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
import { Loader2, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface Product {
  id: number;
  name: string;
  manufacturer: string;
  wholesale_package: string;
  retail_package: string;
  available_quantity: number;
  wholesale_price: number;
  percent: number;
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

export default function StockTransferPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<TransferItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Variant package picker
  const [variantsMap, setVariantsMap] = useState<Record<number, any[]>>({});
  const [packagePickerProduct, setPackagePickerProduct] =
    useState<Product | null>(null);

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
      } catch {
        toast.error("فشل تحميل الأصناف");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ========== Filter ========== */
  const filtered = products.filter(
    (p) => {
      const s = noSpaces(search).toLowerCase();
      return p.available_quantity > 0 &&
      (String(p.id).includes(s) ||
        noSpaces(p.name).toLowerCase().includes(s) ||
        (p.manufacturer && noSpaces(p.manufacturer).toLowerCase().includes(s)));
    },
  );

  /* ========== Add Product ========== */
  const addProduct = (product: Product) => {
    // لو الصنف عنده أكواد فرعية → نعرض اختيار العبوة
    const variants = variantsMap[product.id];
    if (variants && variants.length > 0) {
      setPackagePickerProduct(product);
      setShowModal(false);
      return;
    }

    finalizeAddProduct(
      product,
      product.wholesale_package,
      product.wholesale_price,
    );
  };

  const finalizeAddProduct = (
    product: any,
    pkg: string,
    price: number,
    variantId: number = 0,
    retailPkg?: string,
  ) => {
    const uid = `${product.id}_${variantId}`;
    if (items.find((i) => i.uid === uid)) {
      toast.warning("الصنف بهذه العبوة مضاف بالفعل");
      return;
    }

    setItems((prev) => [
      ...prev,
      {
        uid,
        product_id: product.id,
        variant_id: variantId,
        product_name: product.name,
        manufacturer: product.manufacturer,
        quantity: 1,
        percent: mfgPercentMap[product.manufacturer] || 0,
        price_addition: 0,
        wholesale_package: pkg,
        retail_package: retailPkg || product.retail_package,
        wholesale_price: price,
        available_quantity: product.available_quantity,
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="max-w-xl mx-auto space-y-4 py-6 px-4">
      <h1 className="text-2xl font-bold text-center mb-6">
        فاتورة تحويل للمعرض
      </h1>

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
          if (open) setTimeout(() => searchRef.current?.focus(), 100);
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
                placeholder="ابحث عن صنف..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-9"
                autoFocus
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filtered.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                لا توجد نتائج
              </div>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  className="w-full text-right px-3 py-2.5 rounded-lg hover:bg-muted transition-colors"
                  onClick={() => addProduct(p)}
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
                </button>
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
            {/* العبوة الأساسية */}
            {packagePickerProduct && (
              <button
                className="w-full p-3 rounded-lg border hover:bg-muted transition text-right"
                onClick={() => {
                  finalizeAddProduct(
                    packagePickerProduct,
                    packagePickerProduct.wholesale_package,
                    packagePickerProduct.wholesale_price,
                    0,
                    packagePickerProduct.retail_package,
                  );
                }}
              >
                <div className="font-medium">
                  {packagePickerProduct.wholesale_package}
                </div>
                <div className="text-sm text-muted-foreground">
                  السعر: {packagePickerProduct.wholesale_price} ج
                </div>
              </button>
            )}

            {/* العبوات الفرعية */}
            {packagePickerProduct &&
              variantsMap[packagePickerProduct.id]?.map((v: any) => (
                <button
                  key={v.id}
                  className="w-full p-3 rounded-lg border hover:bg-muted transition text-right"
                  onClick={() => {
                    finalizeAddProduct(
                      packagePickerProduct,
                      v.wholesale_package || "-",
                      Number(v.wholesale_price),
                      v.id,
                      v.retail_package,
                    );
                  }}
                >
                  <div className="font-medium">
                    {v.wholesale_package || "-"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    السعر: {v.wholesale_price} ج
                    {v.label && <span className="mr-2">({v.label})</span>}
                  </div>
                </button>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
