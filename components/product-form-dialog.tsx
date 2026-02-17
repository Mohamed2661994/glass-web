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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle, Plus, Trash2, FileText } from "lucide-react";
import api from "@/services/api";
import { toast } from "sonner";
import { AlertCircle, Loader2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: any;
  onSuccess: () => void;
}

const wholesaleTypes = ["دستة", "طقم", "قطعة"];
const retailTypes = ["شيالة", "علبة", "طقم", "قطعة"];

interface VariantForm {
  _key: string; // مفتاح فريد للـ React
  id?: number; // لو موجود يبقى variant محفوظ في الداتابيز
  barcode: string;
  wholesale_package_type: string;
  wholesale_package_qty: string;
  retail_package_type: string;
  retail_package_qty: string;
  retail_package_qty2: string;
  purchase_price: string;
  wholesale_price: string;
  retail_purchase_price: string;
  retail_price: string;
  discount_amount: string;
  _deleted?: boolean; // علشان نعرف نحذفه من الباك
}

export function ProductFormDialog({
  open,
  onOpenChange,
  product,
  onSuccess,
}: Props) {
  const isEdit = !!product;

  const [manufacturers, setManufacturers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [barcodeExists, setBarcodeExists] = useState(false);

  // Add manufacturer dialog
  const [showAddMfg, setShowAddMfg] = useState(false);
  const [newMfgName, setNewMfgName] = useState("");
  const [savingMfg, setSavingMfg] = useState(false);
  const [checkingBarcode, setCheckingBarcode] = useState(false);
  const [barcodeValid, setBarcodeValid] = useState(false);
  const emptyForm = {
    barcode: "",
    name: "",
    description: "",
    manufacturer: "",
    wholesale_package_type: "",
    wholesale_package_qty: "",
    retail_package_type: "",
    retail_package_qty: "",
    retail_package_qty2: "",
    purchase_price: "",
    wholesale_price: "",
    retail_purchase_price: "",
    retail_price: "",
    discount_amount: "",
  };

  const [form, setForm] = useState<any>(emptyForm);
  const [variantForms, setVariantForms] = useState<VariantForm[]>([]);
  const [showDescription, setShowDescription] = useState(false);

  // ========= Parse helpers =========
  const parseWholesale = (value: string) => {
    if (!value) return { qty: "", type: "" };
    const parts = value.split(" ");
    return { qty: parts[1] || "", type: parts[2] || "" };
  };

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

  useEffect(() => {
    fetchManufacturers();

    if (product) {
      const wholesaleParsed = parseWholesale(product.wholesale_package);
      const retailParsed = parseRetail(product.retail_package);

      setForm({
        ...product,
        wholesale_package_qty: wholesaleParsed.qty,
        wholesale_package_type: wholesaleParsed.type,
        retail_package_qty: retailParsed.qty,
        retail_package_qty2: retailParsed.qty2 || "",
        retail_package_type: retailParsed.type,
      });

      // لو فيه وصف → نفتح الحقل تلقائي
      setShowDescription(!!product.description);

      // جلب العبوات الفرعية الموجودة
      fetchExistingVariants(product.id);
    } else {
      setForm(emptyForm);
      setVariantForms([]);
      setShowDescription(false);
    }
  }, [product, open]);

  const fetchExistingVariants = async (productId: number) => {
    try {
      const res = await api.get(`/admin/products/${productId}/variants`);
      const loaded: VariantForm[] = (res.data || []).map((v: any) => {
        const wp = parseWholesale(v.wholesale_package);
        const rp = parseRetail(v.retail_package);
        return {
          _key: `existing_${v.id}`,
          id: v.id,
          barcode: v.barcode || "",
          wholesale_package_type: wp.type,
          wholesale_package_qty: wp.qty,
          retail_package_type: rp.type,
          retail_package_qty: rp.qty,
          retail_package_qty2: rp.qty2 || "",
          purchase_price: String(v.purchase_price || ""),
          wholesale_price: String(v.wholesale_price || ""),
          retail_purchase_price: String(v.retail_purchase_price || ""),
          retail_price: String(v.retail_price || ""),
          discount_amount: String(v.discount_amount || ""),
        };
      });
      setVariantForms(loaded);
    } catch {
      setVariantForms([]);
    }
  };

  // =========================
  // فحص الباركود (Debounce)
  // =========================
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
              exclude_id: isEdit ? product?.id : undefined,
            },
          },
        );
        setBarcodeExists(res.data.exists);
        setBarcodeValid(!res.data.exists);
      } catch {
        // barcode check failed silently
      } finally {
        setCheckingBarcode(false);
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [form.barcode, isEdit, product?.id]);

  const fetchManufacturers = async () => {
    try {
      const [productsRes, mfgRes] = await Promise.all([
        api.get("/admin/products"),
        api.get("/admin/manufacturers").catch(() => ({ data: [] })),
      ]);
      const fromProducts = productsRes.data.map((p: any) => p.manufacturer);
      const fromTable = (mfgRes.data || []).map((m: any) => m.name);
      const unique = [
        ...new Set([...fromProducts, ...fromTable]),
      ];
      setManufacturers(unique.filter((m): m is string => Boolean(m)));
    } catch (err) {}
  };

  // ========= إضافة عبوة فرعية جديدة =========
  const addVariantForm = () => {
    const activeVariants = variantForms.filter((v) => !v._deleted);
    const nextNum = activeVariants.length + 1;
    const autoBarcode = form.barcode ? `${form.barcode}${nextNum}` : "";
    setVariantForms((prev) => [
      ...prev,
      {
        _key: `new_${Date.now()}`,
        barcode: autoBarcode,
        wholesale_package_type: "",
        wholesale_package_qty: "",
        retail_package_type: "",
        retail_package_qty: "",
        retail_package_qty2: "",
        purchase_price: "",
        wholesale_price: "",
        retail_purchase_price: "",
        retail_price: "",
        discount_amount: "",
      },
    ]);
  };

  // ========= تعديل variant form =========
  const updateVariantForm = (key: string, field: string, value: string) => {
    setVariantForms((prev) =>
      prev.map((v) => (v._key === key ? { ...v, [field]: value } : v)),
    );
  };

  // ========= حذف variant form =========
  const removeVariantForm = (key: string) => {
    setVariantForms(
      (prev) =>
        prev
          .map((v) => {
            if (v._key !== key) return v;
            // لو محفوظ في الداتابيز، نعلّمه بالحذف
            if (v.id) return { ...v, _deleted: true };
            // لو جديد، نشيله من الأراي
            return null;
          })
          .filter(Boolean) as VariantForm[],
    );
  };

  const handleSubmit = async () => {
    if (!form.name) {
      toast.error("اسم الصنف مطلوب");
      return;
    }
    if (barcodeExists) {
      toast.error("لا يمكن الحفظ — الباركود مستخدم بالفعل");
      return;
    }
    try {
      setLoading(true);

      const wholesale_package = `كرتونة ${form.wholesale_package_qty || 0} ${form.wholesale_package_type || ""}`;
      const retailQty = form.retail_package_qty2
        ? `${form.retail_package_qty || 0},${form.retail_package_qty2}`
        : `${form.retail_package_qty || 0}`;
      const retail_package = `${retailQty} ${form.retail_package_type || ""}`;

      const payload = {
        name: form.name,
        manufacturer: form.manufacturer,
        wholesale_package,
        retail_package,
        purchase_price: Number(form.purchase_price || 0),
        retail_purchase_price: Number(form.retail_purchase_price || 0),
        wholesale_price: Number(form.wholesale_price || 0),
        retail_price: Number(form.retail_price || 0),
        discount_amount: Number(form.discount_amount || 0),
        barcode: form.barcode || undefined,
        description: form.description || "",
      };

      let productId = product?.id;

      if (isEdit) {
        await api.put(`/admin/products/${product.id}`, payload);
      } else {
        const res = await api.post("/admin/products", payload);
        productId = res.data?.id || res.data?.product?.id;
      }

      // ========= حفظ العبوات الفرعية =========
      if (productId) {
        for (const vf of variantForms) {
          // حذف
          if (vf._deleted && vf.id) {
            await api.delete(`/admin/products/variants/${vf.id}`);
            continue;
          }
          if (vf._deleted) continue;

          const vWholesale = `كرتونة ${vf.wholesale_package_qty || 0} ${vf.wholesale_package_type || ""}`;
          const vRetailQty = vf.retail_package_qty2
            ? `${vf.retail_package_qty || 0},${vf.retail_package_qty2}`
            : `${vf.retail_package_qty || 0}`;
          const vRetail = `${vRetailQty} ${vf.retail_package_type || ""}`;

          const variantPayload = {
            label: "",
            barcode: vf.barcode || "",
            wholesale_package: vWholesale,
            retail_package: vRetail,
            purchase_price: Number(vf.purchase_price || 0),
            wholesale_price: Number(vf.wholesale_price || 0),
            retail_purchase_price: Number(vf.retail_purchase_price || 0),
            retail_price: Number(vf.retail_price || 0),
            discount_amount: Number(vf.discount_amount || 0),
          };

          if (vf.id) {
            // تعديل
            await api.put(`/admin/products/variants/${vf.id}`, variantPayload);
          } else {
            // إضافة
            await api.post(
              `/admin/products/${productId}/variants`,
              variantPayload,
            );
          }
        }
      }

      toast.success("تم الحفظ بنجاح");
      setForm(emptyForm);
      setVariantForms([]);
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء الحفظ");
    } finally {
      setLoading(false);
    }
  };

  const activeVariants = variantForms.filter((v) => !v._deleted);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="max-w-xl max-h-[90vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>{isEdit ? "تعديل صنف" : "إضافة صنف جديد"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Barcode */}
          <div className="space-y-1">
            <div className="relative">
              <Input
                placeholder="الباركود (اختياري)"
                value={form.barcode}
                onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                className={`
        pr-10
        ${
          barcodeExists
            ? "border-red-500 focus-visible:ring-red-500 bg-red-50 dark:bg-red-950/30"
            : ""
        }
        ${
          barcodeValid
            ? "border-green-500 focus-visible:ring-green-500 bg-green-50 dark:bg-green-950/30"
            : ""
        }
      `}
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

          {/* Name */}
          <div className="flex gap-2 items-center">
            <Input
              placeholder="اسم الصنف"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="flex-1"
            />
            <Button
              type="button"
              variant={showDescription ? "default" : "outline"}
              size="icon"
              className="shrink-0 h-9 w-9"
              onClick={() => setShowDescription(!showDescription)}
              title="إضافة وصف"
            >
              <FileText className="h-4 w-4" />
            </Button>
          </div>

          {/* Description / Keywords */}
          {showDescription && (
            <Input
              placeholder="وصف / كلمات مفتاحية (اختياري)"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              autoFocus
            />
          )}

          {/* Manufacturer */}
          <div className="flex gap-2">
            <Select
              value={form.manufacturer}
              onValueChange={(val) => setForm({ ...form, manufacturer: val })}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="المصنع" />
              </SelectTrigger>

              <SelectContent>
                {manufacturers.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                setNewMfgName("");
                setShowAddMfg(true);
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Add Manufacturer Dialog */}
          <Dialog open={showAddMfg} onOpenChange={setShowAddMfg}>
            <DialogContent dir="rtl" className="max-w-sm">
              <DialogHeader>
                <DialogTitle>إضافة مصنع جديد</DialogTitle>
              </DialogHeader>
              <div className="py-3">
                <Input
                  value={newMfgName}
                  onChange={(e) => setNewMfgName(e.target.value)}
                  placeholder="اسم المصنع"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newMfgName.trim()) {
                      e.preventDefault();
                      (async () => {
                        setSavingMfg(true);
                        try {
                          await api.post("/admin/manufacturers", {
                            name: newMfgName.trim(),
                            percentage: 0,
                          });
                        } catch {}
                        setManufacturers((prev) =>
                          prev.includes(newMfgName.trim())
                            ? prev
                            : [...prev, newMfgName.trim()],
                        );
                        setForm({ ...form, manufacturer: newMfgName.trim() });
                        setShowAddMfg(false);
                        setSavingMfg(false);
                      })();
                    }
                  }}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowAddMfg(false)}
                >
                  إلغاء
                </Button>
                <Button
                  disabled={!newMfgName.trim() || savingMfg}
                  onClick={async () => {
                    setSavingMfg(true);
                    try {
                      await api.post("/admin/manufacturers", {
                        name: newMfgName.trim(),
                        percentage: 0,
                      });
                    } catch {}
                    setManufacturers((prev) =>
                      prev.includes(newMfgName.trim())
                        ? prev
                        : [...prev, newMfgName.trim()],
                    );
                    setForm({ ...form, manufacturer: newMfgName.trim() });
                    setShowAddMfg(false);
                    setSavingMfg(false);
                  }}
                >
                  {savingMfg ? "جاري الحفظ..." : "إضافة"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Wholesale Package */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">عبوة الجملة</label>
            <div className="grid grid-cols-2 gap-3 items-center">
              <Input
                placeholder="عدد"
                type="number"
                value={form.wholesale_package_qty}
                onChange={(e) =>
                  setForm({
                    ...form,
                    wholesale_package_qty: e.target.value,
                  })
                }
              />

              <Select
                value={form.wholesale_package_type}
                onValueChange={(val) =>
                  setForm({
                    ...form,
                    wholesale_package_type: val,
                  })
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
          </div>

          {/* Retail Package */}
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">
              عبوة القطاعي
            </label>
            <div className="grid grid-cols-2 gap-3 items-center">
              <Input
                placeholder="عدد"
                type="number"
                value={form.retail_package_qty}
                onChange={(e) =>
                  setForm({
                    ...form,
                    retail_package_qty: e.target.value,
                  })
                }
              />

              <Select
                value={form.retail_package_type}
                onValueChange={(val) =>
                  setForm({
                    ...form,
                    retail_package_type: val,
                  })
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
            </div>
          </div>

          {/* Prices */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                سعر الشراء جملة
              </label>
              <Input
                type="number"
                placeholder="0.00"
                value={form.purchase_price}
                onChange={(e) =>
                  setForm({ ...form, purchase_price: e.target.value })
                }
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                سعر البيع جملة
              </label>
              <Input
                type="number"
                placeholder="0.00"
                value={form.wholesale_price}
                onChange={(e) =>
                  setForm({ ...form, wholesale_price: e.target.value })
                }
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                سعر الشراء قطاعي
              </label>
              <Input
                type="number"
                placeholder="0.00"
                value={form.retail_purchase_price}
                onChange={(e) =>
                  setForm({
                    ...form,
                    retail_purchase_price: e.target.value,
                  })
                }
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">
                سعر البيع قطاعي
              </label>
              <Input
                type="number"
                placeholder="0.00"
                value={form.retail_price}
                onChange={(e) =>
                  setForm({ ...form, retail_price: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">خصم ثابت</label>
            <Input
              type="number"
              placeholder="0"
              value={form.discount_amount}
              onChange={(e) =>
                setForm({
                  ...form,
                  discount_amount: e.target.value,
                })
              }
            />
          </div>

          {/* ========= العبوات الفرعية ========= */}
          {activeVariants.length > 0 && (
            <div className="space-y-4">
              {activeVariants.map((vf, idx) => (
                <div key={vf._key}>
                  <Separator className="my-2" />
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-muted-foreground">
                      عبوة فرعية {idx + 1}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => removeVariantForm(vf._key)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {/* Barcode */}
                    <Input
                      placeholder="باركود العبوة"
                      value={vf.barcode}
                      onChange={(e) =>
                        updateVariantForm(vf._key, "barcode", e.target.value)
                      }
                    />

                    {/* Wholesale Package */}
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        عبوة الجملة
                      </label>
                      <div className="grid grid-cols-2 gap-3 items-center">
                        <Input
                          placeholder="عدد"
                          type="number"
                          value={vf.wholesale_package_qty}
                          onChange={(e) =>
                            updateVariantForm(
                              vf._key,
                              "wholesale_package_qty",
                              e.target.value,
                            )
                          }
                        />
                        <Select
                          value={vf.wholesale_package_type}
                          onValueChange={(val) =>
                            updateVariantForm(
                              vf._key,
                              "wholesale_package_type",
                              val,
                            )
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
                    </div>

                    {/* Retail Package */}
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        عبوة القطاعي
                      </label>
                      <div className="grid grid-cols-2 gap-3 items-center">
                        <Input
                          placeholder="عدد"
                          type="number"
                          value={vf.retail_package_qty}
                          onChange={(e) =>
                            updateVariantForm(
                              vf._key,
                              "retail_package_qty",
                              e.target.value,
                            )
                          }
                        />
                        <Select
                          value={vf.retail_package_type}
                          onValueChange={(val) =>
                            updateVariantForm(
                              vf._key,
                              "retail_package_type",
                              val,
                            )
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
                      </div>
                    </div>

                    {/* Prices */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          سعر الشراء جملة
                        </label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={vf.purchase_price}
                          onChange={(e) =>
                            updateVariantForm(
                              vf._key,
                              "purchase_price",
                              e.target.value,
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          سعر البيع جملة
                        </label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={vf.wholesale_price}
                          onChange={(e) =>
                            updateVariantForm(
                              vf._key,
                              "wholesale_price",
                              e.target.value,
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          سعر الشراء قطاعي
                        </label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={vf.retail_purchase_price}
                          onChange={(e) =>
                            updateVariantForm(
                              vf._key,
                              "retail_purchase_price",
                              e.target.value,
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          سعر البيع قطاعي
                        </label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={vf.retail_price}
                          onChange={(e) =>
                            updateVariantForm(
                              vf._key,
                              "retail_price",
                              e.target.value,
                            )
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">
                        خصم ثابت
                      </label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={vf.discount_amount}
                        onChange={(e) =>
                          updateVariantForm(
                            vf._key,
                            "discount_amount",
                            e.target.value,
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* زرار إضافة عبوة أخرى */}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={addVariantForm}
          >
            <Plus className="h-4 w-4 ml-2" />
            إضافة عبوة أخرى
          </Button>

          <Button className="w-full" onClick={handleSubmit} disabled={loading}>
            {loading ? "جاري الحفظ..." : "حفظ الصنف"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
