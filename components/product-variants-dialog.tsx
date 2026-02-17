"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import api from "@/services/api";

interface Variant {
  id?: number;
  product_id: number;
  label: string;
  barcode: string;
  wholesale_package: string;
  retail_package: string;
  purchase_price: number;
  retail_purchase_price: number;
  wholesale_price: number;
  retail_price: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: any;
  onSuccess?: () => void;
}

const wholesaleTypes = ["دستة", "طقم", "قطعة"];
const retailTypes = ["شيالة", "علبة", "طقم", "قطعة"];

/* =============================================
   مودال إضافة / تعديل عبوة فرعية
   ============================================= */
function VariantFormDialog({
  open,
  onOpenChange,
  product,
  variant,
  existingCount,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: any;
  variant: Variant | null;
  existingCount: number;
  onSaved: () => void;
}) {
  const isEdit = !!variant;

  const emptyForm = {
    barcode: "",
    wholesale_package_type: "",
    wholesale_package_qty: "",
    retail_package_type: "",
    retail_package_qty: "",
    retail_package_qty2: "",
    purchase_price: "",
    wholesale_price: "",
    retail_purchase_price: "",
    retail_price: "",
  };

  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [barcodeExists, setBarcodeExists] = useState(false);
  const [barcodeValid, setBarcodeValid] = useState(false);
  const [checkingBarcode, setCheckingBarcode] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (variant) {
      // Parse wholesale_package "كرتونة 3 دستة" => qty=3, type=دستة
      const parseWholesale = (value: string) => {
        if (!value) return { qty: "", type: "" };
        const parts = value.split(" ");
        return { qty: parts[1] || "", type: parts[2] || "" };
      };
      // Parse retail_package "3,6 علبة" => qty=3, qty2=6, type=علبة
      const parseRetail = (value: string) => {
        if (!value) return { qty: "", qty2: "", type: "" };
        const parts = value.split(" ");
        const qtyPart = parts[0] || "";
        const type = parts[1] || "";
        if (qtyPart.includes(",")) {
          const [q1, q2] = qtyPart.split(",");
          return { qty: q1, qty2: q2, type };
        }
        return { qty: qtyPart, qty2: "", type };
      };

      const wp = parseWholesale(variant.wholesale_package);
      const rp = parseRetail(variant.retail_package);

      setForm({
        barcode: variant.barcode || "",
        wholesale_package_type: wp.type,
        wholesale_package_qty: wp.qty,
        retail_package_type: rp.type,
        retail_package_qty: rp.qty,
        retail_package_qty2: rp.qty2,
        purchase_price: variant.purchase_price || "",
        wholesale_price: variant.wholesale_price || "",
        retail_purchase_price: variant.retail_purchase_price || "",
        retail_price: variant.retail_price || "",
      });
    } else {
      // Auto-generate barcode: product barcode + next number
      const autoBarcode = product?.barcode
        ? `${product.barcode}${existingCount + 1}`
        : "";
      setForm({ ...emptyForm, barcode: autoBarcode });
    }

    setBarcodeExists(false);
    setBarcodeValid(false);
  }, [open, variant]);

  // Barcode check
  useEffect(() => {
    if (!form.barcode) {
      setBarcodeExists(false);
      setBarcodeValid(false);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        setCheckingBarcode(true);
        const res = await api.get(
          `/admin/products/check-barcode/${form.barcode}`,
          {
            params: {
              exclude_variant_id: isEdit ? variant?.id : undefined,
            },
          },
        );
        setBarcodeExists(res.data.exists);
        setBarcodeValid(!res.data.exists);
      } catch {
        // ignore
      } finally {
        setCheckingBarcode(false);
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [form.barcode, isEdit, variant?.id]);

  const handleSubmit = async () => {
    if (barcodeExists) {
      toast.error("الباركود مستخدم بالفعل");
      return;
    }

    const wholesale_package = `كرتونة ${form.wholesale_package_qty || 0} ${form.wholesale_package_type || ""}`;
    const retailQty = form.retail_package_qty2
      ? `${form.retail_package_qty || 0},${form.retail_package_qty2}`
      : `${form.retail_package_qty || 0}`;
    const retail_package = `${retailQty} ${form.retail_package_type || ""}`;

    const payload = {
      label: "",
      barcode: form.barcode || "",
      wholesale_package,
      retail_package,
      purchase_price: Number(form.purchase_price || 0),
      wholesale_price: Number(form.wholesale_price || 0),
      retail_purchase_price: Number(form.retail_purchase_price || 0),
      retail_price: Number(form.retail_price || 0),
    };

    try {
      setSaving(true);
      if (isEdit && variant?.id) {
        await api.put(`/admin/products/variants/${variant.id}`, payload);
        toast.success("تم التعديل");
      } else {
        await api.post(`/admin/products/${product.id}/variants`, payload);
        toast.success("تم إضافة العبوة الفرعية");
      }
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "حدث خطأ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "تعديل عبوة فرعية" : "إضافة عبوة فرعية"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Barcode */}
          <div className="space-y-1">
            <div className="relative">
              <Input
                placeholder="الباركود (اختياري)"
                value={form.barcode}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                className={`pr-10 ${
                  barcodeExists
                    ? "border-red-500 focus-visible:ring-red-500 bg-red-50 dark:bg-red-950/30"
                    : ""
                } ${
                  barcodeValid
                    ? "border-green-500 focus-visible:ring-green-500 bg-green-50 dark:bg-green-950/30"
                    : ""
                }`}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {checkingBarcode && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {!checkingBarcode && barcodeExists && (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
                {!checkingBarcode && barcodeValid && (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
              </div>
            </div>
            {barcodeExists && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                هذا الباركود مسجل بالفعل
              </p>
            )}
            {barcodeValid && (
              <p className="text-xs text-green-500 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                الباركود متاح للاستخدام
              </p>
            )}
          </div>

          {/* Wholesale Package */}
          <div className="grid grid-cols-3 gap-2 items-center">
            <Input value="كرتونة" disabled />
            <Input
              placeholder="عدد"
              type="number"
              value={form.wholesale_package_qty}
              onChange={(e) =>
                setForm({ ...form, wholesale_package_qty: e.target.value })
              }
            />
            <Select
              value={form.wholesale_package_type}
              onValueChange={(val) =>
                setForm({ ...form, wholesale_package_type: val })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر" />
              </SelectTrigger>
              <SelectContent>
                {wholesaleTypes.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Retail Package */}
          <div className="grid grid-cols-3 gap-2 items-center">
            <Select
              value={form.retail_package_type}
              onValueChange={(val) =>
                setForm({ ...form, retail_package_type: val })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر" />
              </SelectTrigger>
              <SelectContent>
                {retailTypes.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="عدد 1"
              type="number"
              value={form.retail_package_qty}
              onChange={(e) =>
                setForm({ ...form, retail_package_qty: e.target.value })
              }
            />
            <Input
              placeholder="عدد 2 (اختياري)"
              type="number"
              value={form.retail_package_qty2}
              onChange={(e) =>
                setForm({ ...form, retail_package_qty2: e.target.value })
              }
            />
          </div>

          {/* Prices */}
          <Input
            type="number"
            placeholder="سعر الشراء جملة"
            value={form.purchase_price}
            onChange={(e) =>
              setForm({ ...form, purchase_price: e.target.value })
            }
          />
          <Input
            type="number"
            placeholder="سعر البيع جملة"
            value={form.wholesale_price}
            onChange={(e) =>
              setForm({ ...form, wholesale_price: e.target.value })
            }
          />
          <Input
            type="number"
            placeholder="سعر الشراء قطاعي"
            value={form.retail_purchase_price}
            onChange={(e) =>
              setForm({ ...form, retail_purchase_price: e.target.value })
            }
          />
          <Input
            type="number"
            placeholder="سعر البيع قطاعي"
            value={form.retail_price}
            onChange={(e) => setForm({ ...form, retail_price: e.target.value })}
          />

          <Button
            className="w-full mt-4"
            onClick={handleSubmit}
            disabled={saving}
          >
            {saving ? "جاري الحفظ..." : isEdit ? "حفظ التعديل" : "حفظ العبوة"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* =============================================
   مودال قائمة العبوات الفرعية
   ============================================= */
export function ProductVariantsDialog({
  open,
  onOpenChange,
  product,
  onSuccess,
}: Props) {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(false);

  // Sub-dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<Variant | null>(null);

  useEffect(() => {
    if (open && product?.id) {
      fetchVariants();
    }
  }, [open, product?.id]);

  const fetchVariants = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/admin/products/${product.id}/variants`);
      setVariants(res.data);
    } catch {
      toast.error("فشل تحميل العبوات الفرعية");
    } finally {
      setLoading(false);
    }
  };

  const openAddForm = () => {
    setEditingVariant(null);
    setFormOpen(true);
  };

  const openEditForm = (v: Variant) => {
    setEditingVariant(v);
    setFormOpen(true);
  };

  const handleSaved = () => {
    fetchVariants();
    onSuccess?.();
  };

  const handleDelete = async (variantId: number) => {
    if (!confirm("هل أنت متأكد من حذف هذه العبوة الفرعية؟")) return;
    try {
      await api.delete(`/admin/products/variants/${variantId}`);
      toast.success("تم الحذف");
      fetchVariants();
      onSuccess?.();
    } catch {
      toast.error("فشل الحذف");
    }
  };

  const fmt = (v: number) =>
    Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          dir="rtl"
          className="max-w-2xl max-h-[90vh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              عبوات بديلة — {product?.name}
            </DialogTitle>
          </DialogHeader>

          {/* العبوة الأساسية */}
          <Card className="bg-muted/50">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <Badge variant="secondary" className="mb-1">
                    أساسي
                  </Badge>
                  <div className="text-sm font-medium mt-1">
                    جملة: {product?.wholesale_package || "-"} —{" "}
                    {fmt(product?.wholesale_price)} ج
                  </div>
                  <div className="text-sm font-medium">
                    قطاعي: {product?.retail_package || "-"} —{" "}
                    {fmt(product?.retail_price)} ج
                  </div>
                </div>
                <div className="text-xs text-muted-foreground font-mono">
                  {product?.barcode}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* قائمة العبوات الفرعية */}
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : variants.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              لا توجد عبوات فرعية
            </div>
          ) : (
            <div className="space-y-2">
              {variants.map((v) => (
                <Card key={v.id} className="border">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        {v.label && (
                          <div className="text-xs text-muted-foreground mb-1">
                            {v.label}
                          </div>
                        )}
                        <div className="text-sm">
                          جملة:{" "}
                          <span className="font-medium">
                            {v.wholesale_package || "-"}
                          </span>{" "}
                          — {fmt(v.wholesale_price)} ج
                        </div>
                        <div className="text-sm">
                          قطاعي:{" "}
                          <span className="font-medium">
                            {v.retail_package || "-"}
                          </span>{" "}
                          — {fmt(v.retail_price)} ج
                        </div>
                        {v.barcode && (
                          <div className="text-xs text-muted-foreground font-mono mt-1">
                            باركود: {v.barcode}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => openEditForm(v)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => handleDelete(v.id!)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Button variant="outline" className="w-full" onClick={openAddForm}>
            <Plus className="h-4 w-4 ml-2" />
            إضافة عبوة فرعية
          </Button>
        </DialogContent>
      </Dialog>

      {/* مودال إضافة/تعديل العبوة */}
      <VariantFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        product={product}
        variant={editingVariant}
        existingCount={variants.length}
        onSaved={handleSaved}
      />
    </>
  );
}
