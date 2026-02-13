"use client";

/* =========================================================
   Imports
   ========================================================= */

import { useEffect, useMemo, useState } from "react";
import api from "@/services/api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { PageContainer } from "@/components/layout/page-container";

/* =========================================================
   Main Component
   ========================================================= */

export default function CreateWholesaleInvoicePage() {
  /* =========================================================
     1️⃣ Invoice Header States
     ========================================================= */

  const [movementType, setMovementType] = useState<"sale" | "purchase">("sale");
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().substring(0, 10),
  );

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [previousBalance, setPreviousBalance] = useState("0");

  /* =========================================================
     2️⃣ Customer Search States
     ========================================================= */

  const [customerSuggestions, setCustomerSuggestions] = useState<any[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  /* =========================================================
     3️⃣ Products & Items States
     ========================================================= */

  const [products, setProducts] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [showProductModal, setShowProductModal] = useState(false);
  const [search, setSearch] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(false);

  /* =========================================================
     4️⃣ Invoice Payment States
     ========================================================= */

  const [extraDiscount, setExtraDiscount] = useState(0);
  const [paidAmount, setPaidAmount] = useState("0");

  /* =========================================================
     5️⃣ Fetch Products From Backend
     ========================================================= */

  const fetchProducts = async () => {
    try {
      setLoadingProducts(true);

      const res = await api.get("/products", {
        params: {
          branch_id: 2,
          invoice_type: "wholesale",
          movement_type: movementType,
        },
      });

      setProducts(res.data || []);
    } catch {
      toast.error("فشل تحميل الأصناف");
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [movementType]);

  /* =========================================================
     6️⃣ Customer Search By Name
     ========================================================= */

  const searchCustomersByName = async (name: string) => {
    if (name.length < 2) {
      setCustomerSuggestions([]);
      return;
    }

    try {
      const res = await api.get("/customers/search", {
        params: { name },
      });

      setCustomerSuggestions(res.data);
      setShowCustomerDropdown(true);
    } catch {
      toast.error("فشل البحث عن العميل");
    }
  };

  /* =========================================================
     7️⃣ Customer Search By Phone
     ========================================================= */

  const searchCustomerByPhone = async (phone: string) => {
    if (phone.length < 8) return;

    try {
      const res = await api.get("/customers/by-phone", {
        params: { phone },
      });

      const data = res.data;

      if (data) {
        setCustomerName(data.name);
        setCustomerId(data.id);
        fetchCustomerBalance(data.id);
      }
    } catch {}
  };

  /* =========================================================
     8️⃣ Fetch Customer Balance
     ========================================================= */

  const fetchCustomerBalance = async (id: number) => {
    try {
      const res = await api.get(`/customers/${id}/balance`, {
        params: { invoice_type: "wholesale" },
      });

      setPreviousBalance(String(res.data.balance || 0));
    } catch {
      setPreviousBalance("0");
    }
  };

  /* =========================================================
     9️⃣ Add Item To Invoice
     ========================================================= */

  const addItem = (product: any) => {
    const exists = items.find((i) => i.product_id === product.id);
    if (exists) {
      toast.warning("الصنف مضاف بالفعل");
      return;
    }

    setItems([
      ...items,
      {
        product_id: product.id,
        product_name: product.name,
        price: product.price,
        quantity: 1,
        discount: 0,
      },
    ]);

    setShowProductModal(false);
  };

  /* =========================================================
     🔟 Remove Item
     ========================================================= */

  const removeItem = (id: number) => {
    setItems(items.filter((i) => i.product_id !== id));
  };

  /* =========================================================
     1️⃣1️⃣ Calculations
     ========================================================= */

  const totalBeforeDiscount = useMemo(() => {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [items]);

  const finalTotal = useMemo(() => {
    const total = totalBeforeDiscount - extraDiscount;
    return total < 0 ? 0 : total;
  }, [totalBeforeDiscount, extraDiscount]);

  const totalWithPrevious = finalTotal + Number(previousBalance || 0);

  const remaining = totalWithPrevious - Number(paidAmount || 0);

  /* =========================================================
     1️⃣2️⃣ Save Invoice
     ========================================================= */

  const saveInvoice = async () => {
    if (items.length === 0) {
      toast.error("لا يوجد أصناف");
      return;
    }

    if (!customerName.trim()) {
      toast.error("برجاء إدخال اسم العميل");
      return;
    }

    try {
      await api.post("/invoices", {
        invoice_type: "wholesale",
        movement_type: movementType,
        invoice_date: invoiceDate,
        customer_id: customerId,
        customer_name: customerName,
        customer_phone: customerPhone || null,
        manual_discount: extraDiscount,
        items,
        paid_amount: Number(paidAmount) || 0,
        previous_balance: Number(previousBalance) || 0,
      });

      toast.success("تم حفظ الفاتورة بنجاح");
      setItems([]);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "فشل الحفظ");
    }
  };

  /* =========================================================
     JSX
     ========================================================= */
  return (
    <PageContainer size="md">
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-center">إنشاء فاتورة جملة</h1>

        <Card className="p-6 space-y-6">
          <div className="space-y-6">
            <div>
              <label className="text-sm mb-2 block">نوع الحركة</label>
              <Select
                value={movementType}
                onValueChange={(v: any) => setMovementType(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sale">بيع</SelectItem>
                  <SelectItem value="purchase">شراء</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm mb-2 block">التاريخ</label>
              <Input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm mb-2 block">اسم العميل</label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm mb-2 block">رقم الهاتف</label>
              <Input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>
          </div>
        </Card>

        <Button onClick={() => setShowProductModal(true)} className="w-full">
          + إضافة صنف
        </Button>

        {items.length > 0 && (
          <Card className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-3 text-right">الصنف</th>
                    <th className="p-3 text-center">السعر</th>
                    <th className="p-3 text-center">الكمية</th>
                    <th className="p-3 text-center">الإجمالي</th>
                    <th className="p-3 text-center">حذف</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.product_id} className="border-b">
                      <td className="p-3">{item.product_name}</td>
                      <td className="p-3 text-center">{item.price}</td>
                      <td className="p-3 text-center">
                        <Input
                          type="number"
                          className="w-20 mx-auto text-center"
                          value={item.quantity}
                          onChange={(e) =>
                            setItems((prev) =>
                              prev.map((i) =>
                                i.product_id === item.product_id
                                  ? {
                                      ...i,
                                      quantity: Number(e.target.value) || 1,
                                    }
                                  : i,
                              ),
                            )
                          }
                        />
                      </td>
                      <td className="p-3 text-center font-semibold">
                        {item.price * item.quantity}
                      </td>
                      <td className="p-3 text-center">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removeItem(item.product_id)}
                        >
                          حذف
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {items.length > 0 && (
          <Card className="p-6 space-y-6">
            <div className="flex justify-between">
              <span>الإجمالي</span>
              <span>{totalBeforeDiscount}</span>
            </div>

            <Input
              type="number"
              value={extraDiscount}
              onChange={(e) => setExtraDiscount(Number(e.target.value))}
              placeholder="خصم إضافي"
            />

            <div className="flex justify-between font-bold text-green-600">
              <span>الإجمالي النهائي</span>
              <span>{finalTotal}</span>
            </div>

            <Input
              type="number"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              placeholder="المدفوع"
            />

            <div className="flex justify-between font-bold text-red-500">
              <span>المتبقي</span>
              <span>{remaining}</span>
            </div>

            <Button onClick={saveInvoice} className="w-full">
              حفظ الفاتورة
            </Button>
          </Card>
        )}

        {/* ================= Product Modal ================= */}
        {showProductModal && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setShowProductModal(false)}
            />

            {/* ===== Modal ===== */}
            <div className="relative z-[10000] bg-background w-[94%] sm:w-[560px] rounded-2xl border shadow-2xl flex flex-col h-[620px]">
              {/* ===== Header ===== */}
              <div className="flex items-center justify-between p-4 border-b shrink-0">
                <h2 className="text-lg font-bold">اختيار صنف</h2>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowProductModal(false)}
                >
                  إغلاق
                </Button>
              </div>

              {/* ===== Search (ثابت) ===== */}
              <div className="p-4 border-b shrink-0">
                <Input
                  autoFocus
                  placeholder="ابحث عن صنف..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* ===== Products List ===== */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {loadingProducts ? (
                  <div className="text-center py-8 text-muted-foreground">
                    جاري التحميل...
                  </div>
                ) : (
                  products
                    .filter((p) =>
                      p.name.toLowerCase().includes(search.toLowerCase()),
                    )
                    .map((product) => (
                      <div
                        key={product.id}
                        onClick={() => addItem(product)}
                        className="
                  p-3 rounded-lg border
                  cursor-pointer
                  hover:bg-muted
                  transition-colors
                "
                      >
                        <div className="font-medium">{product.name}</div>

                        <div className="text-xs text-muted-foreground mt-1">
                          السعر: {product.price} | الرصيد:{" "}
                          {product.available_quantity}
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
