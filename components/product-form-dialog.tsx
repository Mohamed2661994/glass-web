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
import { CheckCircle, Plus } from "lucide-react";
import api from "@/services/api";
import { toast } from "sonner";
import { AlertCircle, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: any;
  onSuccess: () => void;
}

const wholesaleTypes = ["دستة", "طقم", "قطعة"];
const retailTypes = ["شيالة", "علبة", "طقم", "قطعة"];

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
  const [checkingBarcode, setCheckingBarcode] = useState(false);
  const [barcodeValid, setBarcodeValid] = useState(false);
  const emptyForm = {
    barcode: "",
    name: "",
    manufacturer: "",
    wholesale_package_type: "",
    wholesale_package_qty: "",
    retail_package_type: "",
    retail_package_qty: "",
    purchase_price: "",
    wholesale_price: "",
    retail_purchase_price: "",
    retail_price: "",
    discount_amount: "",
  };

  const [form, setForm] = useState<any>(emptyForm);

  useEffect(() => {
    fetchManufacturers();

    if (product) {
      const parseWholesale = (value: string) => {
        if (!value) return { qty: "", type: "" };
        const parts = value.split(" ");
        return {
          qty: parts[1] || "",
          type: parts[2] || "",
        };
      };

      const parseRetail = (value: string) => {
        if (!value) return { qty: "", type: "" };
        const parts = value.split(" ");
        return {
          qty: parts[0] || "",
          type: parts[1] || "",
        };
      };

      const wholesaleParsed = parseWholesale(product.wholesale_package);
      const retailParsed = parseRetail(product.retail_package);

      setForm({
        ...product,
        wholesale_package_qty: wholesaleParsed.qty,
        wholesale_package_type: wholesaleParsed.type,
        retail_package_qty: retailParsed.qty,
        retail_package_type: retailParsed.type,
      });
    } else {
      // 👈 لو مفيش product يبقى إضافة جديدة
      setForm(emptyForm);
    }
  }, [product, open]);

  // =========================
  // فحص الباركود (Debounce)
  // =========================
  const checkBarcode = async (value: string) => {
    if (!value) {
      setBarcodeExists(false);
      setBarcodeValid(false);
      return;
    }

    try {
      setCheckingBarcode(true);

      const res = await api.get("/admin/products");
      const products = res.data;

      const exists = products.some(
        (p: any) => p.barcode === value && (!isEdit || p.id !== product?.id), // مهم عشان التعديل
      );

      setBarcodeExists(exists);
      setBarcodeValid(!exists);
    } catch (err) {
      console.error(err);
    } finally {
      setCheckingBarcode(false);
    }
  };

  useEffect(() => {
    const delay = setTimeout(() => {
      if (form.barcode) {
        checkBarcode(form.barcode);
      } else {
        setBarcodeExists(false);
        setBarcodeValid(false);
      }
    }, 500);

    return () => clearTimeout(delay);
  }, [form.barcode]);

  useEffect(() => {
    if (!form.barcode) {
      setBarcodeExists(false);
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
      } catch (err) {
        console.error(err);
      } finally {
        setCheckingBarcode(false);
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [form.barcode]);

  const fetchManufacturers = async () => {
    try {
      const res = await api.get("/admin/products");
      const unique = [...new Set(res.data.map((p: any) => p.manufacturer))];
      setManufacturers(unique.filter((m): m is string => Boolean(m)));
    } catch (err) {}
  };

  const generateBarcode = async () => {
    const res = await api.get("/admin/products");
    const count = res.data.length + 1;
    return `900000${count}`;
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

      // 🔹 تكوين نص العبوات بالشكل اللي الباك مستنيه
      const wholesale_package = `كرتونة ${form.wholesale_package_qty || 0} ${form.wholesale_package_type || ""}`;
      const retail_package = `${form.retail_package_qty || 0} ${form.retail_package_type || ""}`;

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
      };

      if (isEdit) {
        await api.put(`/admin/products/${product.id}`, payload);
      } else {
        await api.post("/admin/products", payload);
      }

      toast.success("تم الحفظ بنجاح");
      setForm(emptyForm); // 👈 دي مهمة
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء الحفظ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "تعديل صنف" : "إضافة صنف جديد"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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
          <Input
            placeholder="اسم الصنف"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

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
                const newM = prompt("اسم المصنع الجديد");
                if (newM) {
                  setManufacturers((prev) => [...prev, newM]);
                  setForm({ ...form, manufacturer: newM });
                }
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Wholesale Package */}
          <div className="grid grid-cols-3 gap-2 items-center">
            <Input value="كرتونة" disabled />

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

          {/* Retail Package */}
          <div className="grid grid-cols-2 gap-2 items-center">
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
              setForm({
                ...form,
                retail_purchase_price: e.target.value,
              })
            }
          />

          <Input
            type="number"
            placeholder="سعر البيع قطاعي"
            value={form.retail_price}
            onChange={(e) => setForm({ ...form, retail_price: e.target.value })}
          />

          <Input
            type="number"
            placeholder="خصم ثابت"
            value={form.discount_amount}
            onChange={(e) =>
              setForm({
                ...form,
                discount_amount: e.target.value,
              })
            }
          />

          <Button
            className="w-full mt-4"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "جاري الحفظ..." : "حفظ الصنف"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
