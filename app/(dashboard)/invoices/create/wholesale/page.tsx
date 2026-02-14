"use client";

/* =========================================================
   Imports
   ========================================================= */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "@/services/api";
import { Trash2 } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const [savedInvoiceId, setSavedInvoiceId] = useState<number | null>(null);
  const [showSavedModal, setShowSavedModal] = useState(false);

  /* =========================================================
     2️⃣ Customer Search States
     ========================================================= */

  const [customerSuggestions, setCustomerSuggestions] = useState<any[]>([]);
  const [showNameDropdown, setShowNameDropdown] = useState(false);
  const [phoneSuggestions, setPhoneSuggestions] = useState<any[]>([]);
  const [showPhoneDropdown, setShowPhoneDropdown] = useState(false);
  const nameDropdownRef = useRef<HTMLDivElement>(null);
  const phoneDropdownRef = useRef<HTMLDivElement>(null);

  /* =========================================================
     3️⃣ Products & Items States
     ========================================================= */

  const [products, setProducts] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [showProductModal, setShowProductModal] = useState(false);
  const [search, setSearch] = useState("");
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [lastAddedId, setLastAddedId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  /* =========================================================
     4️⃣ Invoice Payment States
     ========================================================= */

  const [extraDiscount, setExtraDiscount] = useState("0");
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

  const nameTimerRef = useRef<NodeJS.Timeout | null>(null);
  const phoneTimerRef = useRef<NodeJS.Timeout | null>(null);

  const searchCustomersByName = async (name: string) => {
    if (name.length < 2) {
      setCustomerSuggestions([]);
      setShowNameDropdown(false);
      return;
    }

    try {
      const res = await api.get("/customers/search", {
        params: { name },
      });

      setCustomerSuggestions(res.data || []);
      setShowNameDropdown((res.data || []).length > 0);
    } catch {}
  };

  /* =========================================================
     7️⃣ Customer Search By Phone
     ========================================================= */

  const searchCustomerByPhone = async (phone: string) => {
    if (phone.length < 3) {
      setPhoneSuggestions([]);
      setShowPhoneDropdown(false);
      return;
    }

    try {
      const res = await api.get("/customers/by-phone", {
        params: { phone },
      });

      const data = res.data || [];

      if (Array.isArray(data) && data.length > 0) {
        setPhoneSuggestions(data);
        setShowPhoneDropdown(true);
      } else {
        setPhoneSuggestions([]);
        setShowPhoneDropdown(false);
      }
    } catch {
      setPhoneSuggestions([]);
      setShowPhoneDropdown(false);
    }
  };

  const selectCustomer = (customer: any) => {
    setCustomerName(customer.name);
    setCustomerId(customer.id);
    setCustomerPhone(customer.phone || customer.phones?.[0] || "");
    setShowNameDropdown(false);
    setShowPhoneDropdown(false);
    setCustomerSuggestions([]);
    setPhoneSuggestions([]);
    fetchCustomerBalance(customer.id);
  };

  /* Close dropdowns on outside click */
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        nameDropdownRef.current &&
        !nameDropdownRef.current.contains(e.target as Node)
      ) {
        setShowNameDropdown(false);
      }
      if (
        phoneDropdownRef.current &&
        !phoneDropdownRef.current.contains(e.target as Node)
      ) {
        setShowPhoneDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

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

  const addItem = useCallback((product: any) => {
    setItems((prev) => {
      const exists = prev.find((i) => i.product_id === product.id);
      if (exists) {
        toast.warning("الصنف مضاف بالفعل");
        return prev;
      }

      return [
        ...prev,
        {
          product_id: product.id,
          product_name: product.name,
          manufacturer: product.manufacturer || "-",
          package: product.wholesale_package || "-",
          price: product.price,
          quantity: 1,
          discount: 0,
        },
      ];
    });

    setLastAddedId(product.id);
    setShowProductModal(false);
  }, []);

  /* Focus quantity input of last added item */
  useEffect(() => {
    if (lastAddedId !== null) {
      setTimeout(() => {
        const el = document.querySelector(
          `[data-quantity-id="${lastAddedId}"]`,
        ) as HTMLInputElement;
        if (el) {
          el.focus();
          el.select();
        }
        setLastAddedId(null);
      }, 100);
    }
  }, [lastAddedId]);

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
    return items.reduce(
      (sum, item) =>
        sum +
        (Number(item.price) * (Number(item.quantity) || 0) -
          (Number(item.discount) || 0)),
      0,
    );
  }, [items]);

  const finalTotal = useMemo(() => {
    const total = totalBeforeDiscount - (Number(extraDiscount) || 0);
    return total < 0 ? 0 : total;
  }, [totalBeforeDiscount, extraDiscount]);

  const totalWithPrevious = finalTotal + Number(previousBalance || 0);

  const remaining = totalWithPrevious - (Number(paidAmount) || 0);

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
      const res = await api.post("/invoices", {
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

      const newId = res.data?.id || res.data?.invoice_id;
      setSavedInvoiceId(newId);
      setShowSavedModal(true);

      setItems([]);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerId(null);
      setPreviousBalance("0");
      setExtraDiscount("0");
      setPaidAmount("0");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "فشل الحفظ");
    }
  };

  /* =========================================================
     Spacebar shortcut to open product dialog
     ========================================================= */

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.code === "Space" &&
        !showProductModal &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target instanceof HTMLSelectElement)
      ) {
        e.preventDefault();
        setShowProductModal(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showProductModal]);

  /* =========================================================
     Filtered products memo
     ========================================================= */

  const filteredProducts = useMemo(
    () =>
      products.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [products, search],
  );

  /* =========================================================
     Handle search keydown (Enter & arrows)
     ========================================================= */

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (filteredProducts.length > 0) {
          setFocusedIndex(0);
          // Focus the first item in the list
          setTimeout(() => {
            const firstItem = listRef.current?.querySelector(
              "[data-product-index='0']",
            ) as HTMLElement;
            firstItem?.focus();
          }, 0);
        }
      }
    },
    [filteredProducts],
  );

  /* =========================================================
     Handle list keydown (arrows & enter)
     ========================================================= */

  const handleListKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>, index: number) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(index + 1, filteredProducts.length - 1);
        setFocusedIndex(next);
        const el = listRef.current?.querySelector(
          `[data-product-index='${next}']`,
        ) as HTMLElement;
        el?.focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = Math.max(index - 1, 0);
        setFocusedIndex(prev);
        const el = listRef.current?.querySelector(
          `[data-product-index='${prev}']`,
        ) as HTMLElement;
        el?.focus();
      } else if (e.key === "Enter") {
        e.preventDefault();
        addItem(filteredProducts[index]);
      }
    },
    [filteredProducts, addItem],
  );

  /* =========================================================
     JSX
     ========================================================= */
  return (
    <div className="mx-auto px-4" style={{ maxWidth: 950, width: "100%" }}>
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

            <div className="relative" ref={nameDropdownRef}>
              <label className="text-sm mb-2 block">اسم العميل</label>
              <Input
                value={customerName}
                onChange={(e) => {
                  const v = e.target.value;
                  setCustomerName(v);
                  setCustomerId(null);
                  if (nameTimerRef.current) clearTimeout(nameTimerRef.current);
                  nameTimerRef.current = setTimeout(
                    () => searchCustomersByName(v),
                    300,
                  );
                }}
                onFocus={() => {
                  if (customerSuggestions.length > 0) setShowNameDropdown(true);
                }}
              />
              {showNameDropdown && customerSuggestions.length > 0 && (
                <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {customerSuggestions.map((c: any) => (
                    <div
                      key={c.id}
                      className="px-3 py-2 hover:bg-muted cursor-pointer text-sm"
                      onClick={() => selectCustomer(c)}
                    >
                      <span className="font-medium">{c.name}</span>
                      {c.phone && (
                        <span className="text-muted-foreground mr-2">
                          ({c.phone})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="relative" ref={phoneDropdownRef}>
              <label className="text-sm mb-2 block">رقم الهاتف</label>
              <Input
                value={customerPhone}
                onChange={(e) => {
                  const v = e.target.value;
                  setCustomerPhone(v);
                  if (phoneTimerRef.current)
                    clearTimeout(phoneTimerRef.current);
                  phoneTimerRef.current = setTimeout(
                    () => searchCustomerByPhone(v),
                    300,
                  );
                }}
                onFocus={() => {
                  if (phoneSuggestions.length > 0) setShowPhoneDropdown(true);
                }}
              />
              {showPhoneDropdown && phoneSuggestions.length > 0 && (
                <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {phoneSuggestions.map((c: any) => (
                    <div
                      key={c.id}
                      className="px-3 py-2 hover:bg-muted cursor-pointer text-sm"
                      onClick={() => selectCustomer(c)}
                    >
                      <span className="font-medium">{c.name}</span>
                      {c.phone && (
                        <span className="text-muted-foreground mr-2">
                          ({c.phone})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
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
                    <th className="p-3 text-center">الخصم</th>
                    <th className="p-3 text-center">الإجمالي</th>
                    <th className="p-3 text-center">حذف</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.product_id} className="border-b">
                      <td className="p-3">
                        <div>
                          {item.product_name} - {item.manufacturer}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {item.package}
                        </div>
                      </td>
                      <td className="p-3 text-center">{item.price}</td>
                      <td className="p-3 text-center">
                        <Input
                          type="number"
                          data-quantity-id={item.product_id}
                          className="w-20 mx-auto text-center"
                          value={item.quantity}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const el = document.querySelector(
                                `[data-discount-id="${item.product_id}"]`,
                              ) as HTMLInputElement;
                              el?.focus();
                              el?.select();
                            }
                          }}
                          onChange={(e) =>
                            setItems((prev) =>
                              prev.map((i) =>
                                i.product_id === item.product_id
                                  ? {
                                      ...i,
                                      quantity:
                                        e.target.value === ""
                                          ? ""
                                          : Number(e.target.value),
                                    }
                                  : i,
                              ),
                            )
                          }
                        />
                      </td>
                      <td className="p-3 text-center">
                        <Input
                          type="number"
                          data-discount-id={item.product_id}
                          className="w-20 mx-auto text-center"
                          value={item.discount}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              setShowProductModal(true);
                            }
                          }}
                          onChange={(e) =>
                            setItems((prev) =>
                              prev.map((i) =>
                                i.product_id === item.product_id
                                  ? {
                                      ...i,
                                      discount:
                                        e.target.value === ""
                                          ? ""
                                          : Number(e.target.value),
                                    }
                                  : i,
                              ),
                            )
                          }
                        />
                      </td>
                      <td className="p-3 text-center font-semibold">
                        {Number(item.price) * (Number(item.quantity) || 0) -
                          (Number(item.discount) || 0)}
                      </td>
                      <td className="p-3 text-center">
                        {confirmDeleteId === item.product_id ? (
                          <Button
                            variant="destructive"
                            size="icon-xs"
                            onClick={() => {
                              removeItem(item.product_id);
                              setConfirmDeleteId(null);
                            }}
                          >
                            متأكد؟
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => {
                              setConfirmDeleteId(item.product_id);
                              setTimeout(
                                () =>
                                  setConfirmDeleteId((prev) =>
                                    prev === item.product_id ? null : prev,
                                  ),
                                2000,
                              );
                            }}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {items.length > 0 && (
          <Card className="p-6 space-y-4">
            {/* الإجمالي */}
            <div className="grid grid-cols-3 items-center py-2 border-b">
              <span className="text-muted-foreground text-sm">
                إجمالي الأصناف
              </span>
              <span className="text-xl font-semibold text-center">
                {totalBeforeDiscount} ج.م
              </span>
              <span />
            </div>

            {/* خصم إضافي */}
            <div className="grid grid-cols-3 items-center gap-3">
              <label className="text-sm text-muted-foreground">خصم إضافي</label>
              <Input
                data-field="extra-discount"
                type="number"
                className="text-center"
                value={extraDiscount}
                onChange={(e) => setExtraDiscount(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const el = document.querySelector(
                      '[data-field="previous-balance"]',
                    ) as HTMLInputElement;
                    el?.focus();
                    el?.select();
                  }
                }}
              />
              <span />
            </div>

            {/* حساب سابق */}
            <div className="grid grid-cols-3 items-center gap-3">
              <label className="text-sm text-muted-foreground">حساب سابق</label>
              <Input
                data-field="previous-balance"
                type="number"
                className="text-center"
                value={previousBalance}
                onChange={(e) => setPreviousBalance(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const el = document.querySelector(
                      '[data-field="paid-amount"]',
                    ) as HTMLInputElement;
                    el?.focus();
                    el?.select();
                  }
                }}
              />
              <span />
            </div>

            {/* الإجمالي النهائي */}
            <div className="grid grid-cols-3 items-center py-2 border-b">
              <span className="font-bold text-green-600 text-sm">
                الإجمالي النهائي
              </span>
              <span className="text-xl font-bold text-green-600 text-center">
                {totalWithPrevious} ج.م
              </span>
              <span />
            </div>

            {/* المدفوع */}
            <div className="grid grid-cols-3 items-center gap-3">
              <label className="text-sm text-muted-foreground">المدفوع</label>
              <Input
                data-field="paid-amount"
                type="number"
                className="text-center"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
              />
              <span />
            </div>

            {/* المتبقي */}
            <div className="grid grid-cols-3 items-center py-3 px-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <span className="font-bold text-destructive text-sm">
                المتبقي
              </span>
              <span className="text-2xl font-bold text-destructive text-center">
                {remaining} ج.م
              </span>
              <span />
            </div>

            <Button onClick={saveInvoice} className="w-full" size="lg">
              حفظ الفاتورة
            </Button>
          </Card>
        )}

        {/* ================= Product Modal ================= */}

        {/* ===== مودل تم الحفظ ===== */}
        <Dialog open={showSavedModal} onOpenChange={setShowSavedModal}>
          <DialogContent dir="rtl" className="max-w-sm text-center">
            <DialogHeader>
              <DialogTitle>تم حفظ الفاتورة</DialogTitle>
            </DialogHeader>
            <p className="text-lg py-4">
              تم حفظ الفاتورة برقم{" "}
              <span className="font-bold text-primary">{savedInvoiceId}</span>
            </p>
            {movementType === "sale" && (
              <p className="text-sm text-muted-foreground -mt-2 mb-2">
                تم ترحيل المبالغ إلى اليومية
              </p>
            )}
            <div className="flex gap-3">
              <Button
                className="flex-1"
                onClick={() => {
                  window.open(`/invoices/${savedInvoiceId}/print`, "_blank");
                  setShowSavedModal(false);
                }}
              >
                طباعة
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowSavedModal(false)}
              >
                إلغاء
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* ================= Product Modal ================= */}
        <Dialog open={showProductModal} onOpenChange={setShowProductModal}>
          <DialogContent
            dir="rtl"
            className="max-w-xl p-0 flex flex-col"
            style={{ height: 420, maxHeight: "75vh" }}
          >
            {/* ===== Header ===== */}
            <DialogHeader className="p-4 border-b shrink-0">
              <DialogTitle>اختيار صنف</DialogTitle>
            </DialogHeader>

            {/* ===== Search ===== */}
            <div className="p-4 border-b shrink-0">
              <Input
                ref={searchInputRef}
                autoFocus
                placeholder="ابحث عن صنف... (Enter للتنقل)"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setFocusedIndex(-1);
                }}
                onKeyDown={handleSearchKeyDown}
                onFocus={(e) => e.target.select()}
              />
            </div>

            {/* ===== Products List ===== */}
            <div
              ref={listRef}
              className="flex-1 overflow-y-auto scrollbar-hide p-4 space-y-2"
            >
              {loadingProducts ? (
                <div className="text-center py-8 text-muted-foreground">
                  جاري التحميل...
                </div>
              ) : (
                filteredProducts.map((product, index) => (
                  <div
                    key={product.id}
                    data-product-index={index}
                    tabIndex={0}
                    onClick={() => addItem(product)}
                    onKeyDown={(e) => handleListKeyDown(e, index)}
                    className={`p-3 rounded-lg border cursor-pointer hover:bg-muted transition outline-none ${
                      focusedIndex === index
                        ? "ring-2 ring-primary bg-muted"
                        : ""
                    }`}
                  >
                    <div className="font-medium">{product.name}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                      <span>المصنع: {product.manufacturer || "-"}</span>
                      <span>العبوة: {product.wholesale_package || "-"}</span>
                      <span>السعر: {product.price}</span>
                      <span>الرصيد: {product.available_quantity}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
