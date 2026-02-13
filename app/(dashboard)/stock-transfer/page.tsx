"use client";

import { useEffect, useRef, useState } from "react";
import api from "@/services/api";
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
  product_id: number;
  product_name: string;
  manufacturer: string;
  quantity: number;
  percent: number;
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

  const FROM_BRANCH_ID = 2;
  const TO_BRANCH_ID = 1;

  /* ========== Load Products ========== */
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/products/for-replace", {
          params: { branch_id: FROM_BRANCH_ID },
        });
        setProducts(Array.isArray(data) ? data : []);
      } catch {
        toast.error("فشل تحميل الأصناف");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ========== Filter ========== */
  const filtered = products.filter(
    (p) =>
      p.available_quantity > 0 &&
      (p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.manufacturer?.toLowerCase().includes(search.toLowerCase())),
  );

  /* ========== Add Product ========== */
  const addProduct = (product: Product) => {
    if (items.find((i) => i.product_id === product.id)) {
      toast.warning("الصنف مضاف بالفعل");
      return;
    }

    setItems((prev) => [
      ...prev,
      {
        product_id: product.id,
        product_name: product.name,
        manufacturer: product.manufacturer,
        quantity: 1,
        percent: 0,
        wholesale_package: product.wholesale_package,
        retail_package: product.retail_package,
        wholesale_price: product.wholesale_price,
        available_quantity: product.available_quantity,
      },
    ]);
    setShowModal(false);
  };

  /* ========== Update Item ========== */
  const updateItem = (
    id: number,
    field: "quantity" | "percent",
    value: number,
  ) => {
    setItems((prev) =>
      prev.map((i) => (i.product_id === id ? { ...i, [field]: value } : i)),
    );
  };

  /* ========== Remove Item ========== */
  const removeItem = (id: number) => {
    setItems((prev) => prev.filter((i) => i.product_id !== id));
  };

  /* ========== Total ========== */
  const totalAmount = items.reduce((sum, i) => {
    const base = i.quantity * i.wholesale_price;
    const discount = base * (i.percent / 100);
    return sum + (base - discount);
  }, 0);

  /* ========== Go to Preview ========== */
  const goToPreview = () => {
    if (items.length === 0) {
      toast.error("أضف صنف واحد على الأقل");
      return;
    }

    const payload = {
      from_branch_id: FROM_BRANCH_ID,
      to_branch_id: TO_BRANCH_ID,
      total_amount: totalAmount,
      items: items.map((i) => {
        const base = i.quantity * i.wholesale_price;
        const discount = base * (i.percent / 100);
        return {
          product_id: i.product_id,
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
        const base = item.quantity * item.wholesale_price;
        const discount = base * (item.percent / 100);
        const final = base - discount;

        return (
          <Card key={item.product_id}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                {/* حذف */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 shrink-0"
                  onClick={() => removeItem(item.product_id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>

                {/* النسبة */}
                <Input
                  type="number"
                  placeholder="%"
                  className="w-16 text-center"
                  value={item.percent || ""}
                  onChange={(e) =>
                    updateItem(
                      item.product_id,
                      "percent",
                      Number(e.target.value) || 0,
                    )
                  }
                />

                {/* الكمية */}
                <Input
                  type="number"
                  className="w-20 text-center"
                  value={item.quantity || ""}
                  onChange={(e) =>
                    updateItem(
                      item.product_id,
                      "quantity",
                      Number(e.target.value) || 1,
                    )
                  }
                />

                {/* التفاصيل */}
                <div className="flex-1 text-right min-w-0">
                  <div className="font-bold text-sm truncate">
                    {item.product_name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {item.wholesale_package} ×{" "}
                    {item.wholesale_price.toLocaleString()}
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
                  <div className="font-semibold text-sm">
                    {p.name} – {p.manufacturer}
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
    </div>
  );
}
