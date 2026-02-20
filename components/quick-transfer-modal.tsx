"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import api from "@/services/api";
import { broadcastUpdate } from "@/lib/broadcast";
import { highlightText } from "@/lib/highlight-text";
import { multiWordMatch } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Loader2,
  Search,
  Trash2,
  ArrowLeftRight,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

/* ========== Types ========== */

interface WholesaleProduct {
  id: number;
  name: string;
  manufacturer: string;
  wholesale_package: string;
  retail_package: string;
  available_quantity: number;
  wholesale_price: number;
}

interface TransferItem {
  uid: string;
  product_id: number;
  variant_id: number;
  product_name: string;
  manufacturer: string;
  quantity: number;
  wholesale_package: string;
  retail_package: string;
  wholesale_price: number;
  available_quantity: number;
}

interface QuickTransferModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful transfer so the invoice page can refresh stock */
  onTransferComplete?: () => void;
}

/* ========== Component ========== */

export function QuickTransferModal({
  open,
  onOpenChange,
  onTransferComplete,
}: QuickTransferModalProps) {
  const FROM_BRANCH_ID = 2; // wholesale
  const TO_BRANCH_ID = 1; // retail

  /* --- State --- */
  const [step, setStep] = useState<"select" | "confirm" | "success">("select");
  const [products, setProducts] = useState<WholesaleProduct[]>([]);
  const [variantsMap, setVariantsMap] = useState<Record<number, any[]>>({});
  const [mfgPercentMap, setMfgPercentMap] = useState<Record<string, number>>(
    {},
  );
  const [items, setItems] = useState<TransferItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewItems, setPreviewItems] = useState<any[]>([]);
  const [payload, setPayload] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [transferNumber, setTransferNumber] = useState<number | null>(null);
  const [packagePickerProduct, setPackagePickerProduct] =
    useState<WholesaleProduct | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  /* --- Load products when modal opens --- */
  useEffect(() => {
    if (!open) return;
    // Reset state
    setStep("select");
    setItems([]);
    setSearch("");
    setTransferNumber(null);
    setPackagePickerProduct(null);
    setPreviewItems([]);
    setPayload(null);

    (async () => {
      setLoading(true);
      try {
        const [productsRes, mfgRes] = await Promise.all([
          api.get("/products/for-replace", {
            params: { branch_id: FROM_BRANCH_ID },
          }),
          api.get("/admin/manufacturers").catch(() => ({ data: [] })),
        ]);

        const prods: WholesaleProduct[] = Array.isArray(productsRes.data)
          ? productsRes.data
          : [];
        setProducts(prods);

        // Manufacturer percentages
        const pMap: Record<string, number> = {};
        for (const m of mfgRes.data || []) {
          pMap[m.name] = Number(m.percentage) || 0;
        }
        setMfgPercentMap(pMap);

        // Variants
        if (prods.length > 0) {
          try {
            const ids = prods.map((p) => p.id).join(",");
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
        toast.error("فشل تحميل أصناف المخزن");
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  /* --- Filtered products --- */
  const filtered = products.filter(
    (p) =>
      p.available_quantity > 0 &&
      multiWordMatch(search, String(p.id), p.name, p.manufacturer),
  );

  /* --- Add product --- */
  const addProduct = (product: WholesaleProduct) => {
    const variants = variantsMap[product.id];
    if (variants && variants.length > 0) {
      setPackagePickerProduct(product);
      return;
    }
    finalizeAdd(
      product,
      product.wholesale_package,
      product.wholesale_price,
      0,
      product.retail_package,
    );
  };

  const finalizeAdd = (
    product: WholesaleProduct,
    pkg: string,
    price: number,
    variantId: number = 0,
    retailPkg?: string,
  ) => {
    const uid = `${product.id}_${variantId}`;
    if (items.find((i) => i.uid === uid)) {
      toast.warning("الصنف مضاف بالفعل");
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
        wholesale_package: pkg,
        retail_package: retailPkg || product.retail_package,
        wholesale_price: price,
        available_quantity: product.available_quantity,
      },
    ]);
    setPackagePickerProduct(null);
  };

  /* --- Item helpers --- */
  const updateQty = (uid: string, qty: number) => {
    setItems((prev) =>
      prev.map((i) => (i.uid === uid ? { ...i, quantity: qty } : i)),
    );
  };

  const removeItem = (uid: string) => {
    setItems((prev) => prev.filter((i) => i.uid !== uid));
  };

  /* --- Go to confirm step (calls preview API) --- */
  const goToConfirm = useCallback(async () => {
    if (items.length === 0) {
      toast.error("أضف صنف واحد على الأقل");
      return;
    }

    // Validate quantities
    const overStock = items.filter((i) => i.quantity > i.available_quantity);
    if (overStock.length > 0) {
      overStock.forEach((item) =>
        toast.error(
          `"${item.product_name}" الكمية (${item.quantity}) أكبر من الرصيد (${item.available_quantity})`,
        ),
      );
      return;
    }

    const zeroQty = items.filter((i) => !i.quantity || i.quantity <= 0);
    if (zeroQty.length > 0) {
      toast.error("كل الأصناف لازم يكون ليها كمية");
      return;
    }

    const requestPayload = {
      from_branch_id: FROM_BRANCH_ID,
      to_branch_id: TO_BRANCH_ID,
      total_amount: 0,
      items: items.map((i) => ({
        product_id: i.product_id,
        variant_id: i.variant_id,
        quantity: i.quantity,
        final_price: 0,
      })),
    };

    setPreviewLoading(true);
    setStep("confirm");
    try {
      const res = await api.post(
        "/stock/wholesale-to-retail/preview",
        requestPayload,
      );

      const merged = (res.data || []).map((row: any) => {
        const localItem = items.find(
          (i) =>
            i.product_id === row.product_id &&
            (i.variant_id || 0) === (row.variant_id || 0),
        );
        return {
          ...row,
          quantity: localItem?.quantity ?? 0,
          from_quantity: row.from_quantity ?? 0,
          to_quantity: row.to_quantity ?? 0,
          final_price: 0,
          manufacturer: row.manufacturer ?? localItem?.manufacturer ?? "",
        };
      });

      setPreviewItems(merged);
      setPayload(requestPayload);
    } catch {
      toast.error("فشل تحميل معاينة التحويل");
      setStep("select");
    } finally {
      setPreviewLoading(false);
    }
  }, [items]);

  /* --- Execute transfer --- */
  const executeTransfer = useCallback(async () => {
    if (!payload) return;

    setSubmitting(true);
    try {
      const res = await api.post("/stock/wholesale-to-retail/execute", payload);
      setTransferNumber(res.data?.transfer_id ?? null);
      setStep("success");
      broadcastUpdate("transfer_created");
      toast.success("تم التحويل بنجاح");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "فشل تنفيذ التحويل");
    } finally {
      setSubmitting(false);
    }
  }, [payload]);

  /* --- Close handler --- */
  const handleClose = (val: boolean) => {
    if (!val && step === "success") {
      onTransferComplete?.();
    }
    onOpenChange(val);
  };

  /* ========== Render ========== */
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        dir="rtl"
        className="max-w-lg p-0 flex flex-col gap-0"
        style={{ height: "85vh", maxHeight: 700 }}
      >
        <DialogHeader className="p-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            {step === "success"
              ? "تم التحويل"
              : step === "confirm"
                ? "تأكيد التحويل"
                : "تحويل سريع للمعرض"}
          </DialogTitle>
        </DialogHeader>

        {/* ===== Loading ===== */}
        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* ===== SUCCESS ===== */}
        {step === "success" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
            <p className="text-lg font-bold">تم التحويل بنجاح</p>
            {transferNumber && (
              <p className="text-muted-foreground">
                رقم التحويل: {transferNumber}
              </p>
            )}
            <Button
              className="mt-4"
              onClick={() => {
                onTransferComplete?.();
                onOpenChange(false);
              }}
            >
              إغلاق والعودة للفاتورة
            </Button>
          </div>
        )}

        {/* ===== SELECT ITEMS ===== */}
        {!loading && step === "select" && (
          <>
            {/* Search */}
            <div className="p-3 border-b shrink-0">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchRef}
                  placeholder="ابحث عن صنف بالمخزن..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pr-9"
                  autoFocus
                />
              </div>
            </div>

            {/* Selected items bar */}
            {items.length > 0 && (
              <div className="px-3 py-2 border-b bg-muted/50 shrink-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    الأصناف المختارة ({items.length})
                  </span>
                  <Button
                    size="sm"
                    onClick={goToConfirm}
                    className="gap-1.5"
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                    متابعة التحويل
                  </Button>
                </div>

                {/* Mini items list */}
                <div className="mt-2 space-y-1 max-h-28 overflow-y-auto">
                  {items.map((item) => (
                    <div
                      key={item.uid}
                      className="flex items-center justify-between text-xs bg-background rounded px-2 py-1.5"
                    >
                      <span className="truncate flex-1">
                        {item.product_name} — {item.wholesale_package}
                      </span>
                      <div className="flex items-center gap-2 shrink-0 mr-2">
                        <Input
                          type="number"
                          className="w-14 h-6 text-center text-xs"
                          value={item.quantity || ""}
                          min={1}
                          max={item.available_quantity}
                          onChange={(e) =>
                            updateQty(item.uid, Number(e.target.value) || 1)
                          }
                        />
                        <button
                          className="text-red-500 hover:text-red-600"
                          onClick={() => removeItem(item.uid)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Products list */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filtered.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {search ? "لا توجد نتائج" : "لا توجد أصناف متاحة بالمخزن"}
                </div>
              ) : (
                filtered.map((p) => {
                  const isAdded = items.some(
                    (i) => i.product_id === p.id && i.variant_id === 0,
                  );
                  return (
                    <button
                      key={p.id}
                      className={`w-full text-right px-3 py-2.5 rounded-lg transition-colors ${
                        isAdded
                          ? "bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800"
                          : "hover:bg-muted"
                      }`}
                      onClick={() => !isAdded && addProduct(p)}
                      disabled={isAdded}
                    >
                      <div className="flex items-center gap-2">
                        <div className="font-semibold text-sm flex-1 truncate">
                          {highlightText(p.name, search)} –{" "}
                          {highlightText(p.manufacturer, search)}
                        </div>
                        {variantsMap[p.id]?.length > 0 && (
                          <span className="text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full shrink-0">
                            {variantsMap[p.id].length + 1} عبوات
                          </span>
                        )}
                        {isAdded && (
                          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {p.wholesale_package} • رصيد:{" "}
                        <span className="font-medium">
                          {p.available_quantity}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </>
        )}

        {/* ===== CONFIRM (with server preview) ===== */}
        {!loading && step === "confirm" && (
          <div className="flex-1 flex flex-col">
            {previewLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {previewItems.map((item: any, idx: number) => {
                    const noStock = item.from_quantity <= 0;
                    const isOk = item.status === "ok";

                    return (
                      <Card
                        key={idx}
                        className={
                          noStock
                            ? "border-red-500 bg-red-50 dark:bg-red-950/30"
                            : "bg-blue-950/80 dark:bg-blue-950/60 border-blue-900"
                        }
                      >
                        <CardContent className="p-0">
                          {noStock && (
                            <div className="flex items-center justify-center gap-2 py-2 text-red-500 text-xs font-bold">
                              <AlertTriangle className="h-3 w-3" />
                              {item.reason || "رصيد غير كافٍ بالمخزن"}
                            </div>
                          )}

                          {isOk ? (
                            <div className="overflow-hidden rounded-lg">
                              {/* Header */}
                              <div className="grid grid-cols-3 bg-gray-600 text-white text-xs font-bold text-center">
                                <div className="py-2">اسم الصنف</div>
                                <div className="py-2">من المخزن</div>
                                <div className="py-2">إلى المعرض</div>
                              </div>
                              {/* Row */}
                              <div className="grid grid-cols-3 text-white text-sm text-center">
                                <div className="py-3 font-bold text-right pr-3">
                                  {item.product_name} - {item.manufacturer}
                                  {item.package_name && (
                                    <div className="text-xs text-blue-200 mt-0.5">
                                      {item.package_name}
                                    </div>
                                  )}
                                </div>
                                <div className="py-3 font-semibold">
                                  {item.from_quantity}
                                </div>
                                <div className="py-3 font-semibold">
                                  {item.to_quantity}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="p-3 text-red-500 dark:text-red-300 font-semibold text-right text-sm">
                              {item.product_name} — {item.reason}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}

                  {previewItems.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      لا توجد أصناف
                    </div>
                  )}
                </div>

                {/* Bottom actions */}
                <div className="p-3 border-t space-y-2 shrink-0">
                  <div className="text-center text-sm text-muted-foreground">
                    {previewItems.filter((i: any) => i.status === "ok").length}{" "}
                    صنف سيتم تحويلهم من المخزن للمعرض
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setStep("select")}
                      disabled={submitting}
                    >
                      رجوع
                    </Button>
                    <Button
                      className="flex-1 gap-1.5"
                      onClick={executeTransfer}
                      disabled={
                        submitting ||
                        previewItems.filter((i: any) => i.status === "ok")
                          .length === 0
                      }
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowLeftRight className="h-4 w-4" />
                      )}
                      {submitting ? "جاري التحويل..." : "تأكيد التحويل"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ===== Package Picker sub-dialog ===== */}
        <Dialog
          open={!!packagePickerProduct}
          onOpenChange={(v) => {
            if (!v) setPackagePickerProduct(null);
          }}
        >
          <DialogContent dir="rtl" className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                اختر العبوة — {packagePickerProduct?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-2">
              {packagePickerProduct && (
                <button
                  className="w-full p-3 rounded-lg border hover:bg-muted transition text-right"
                  onClick={() =>
                    finalizeAdd(
                      packagePickerProduct,
                      packagePickerProduct.wholesale_package,
                      packagePickerProduct.wholesale_price,
                      0,
                      packagePickerProduct.retail_package,
                    )
                  }
                >
                  <div className="font-medium">
                    {packagePickerProduct.wholesale_package}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    رصيد: {packagePickerProduct.available_quantity}
                  </div>
                </button>
              )}

              {packagePickerProduct &&
                variantsMap[packagePickerProduct.id]?.map((v: any) => (
                  <button
                    key={v.id}
                    className="w-full p-3 rounded-lg border hover:bg-muted transition text-right"
                    onClick={() =>
                      finalizeAdd(
                        packagePickerProduct,
                        v.wholesale_package || "-",
                        Number(v.wholesale_price),
                        v.id,
                        v.retail_package,
                      )
                    }
                  >
                    <div className="font-medium">
                      {v.wholesale_package || "-"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {v.label && <span>({v.label})</span>}
                    </div>
                  </button>
                ))}
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
