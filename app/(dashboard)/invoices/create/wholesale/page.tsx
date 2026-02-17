"use client";

/* =========================================================
   Imports
   ========================================================= */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "@/services/api";
import { Trash2, Loader2, Pencil } from "lucide-react";
import { ProductFormDialog } from "@/components/product-form-dialog";
import { useCachedProducts } from "@/hooks/use-cached-products";
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
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/app/context/auth-context";
import { PageContainer } from "@/components/layout/page-container";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/* =========================================================
   Main Component
   ========================================================= */

export default function CreateWholesaleInvoicePage() {
  const { user } = useAuth();
  const isRetailUser = user?.branch_id === 1;

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
  const [journalPosted, setJournalPosted] = useState(false);

  /* =========================================================
     2️⃣ Customer Search States
     ========================================================= */

  const [customerSuggestions, setCustomerSuggestions] = useState<any[]>([]);
  const [showNameDropdown, setShowNameDropdown] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const nameDropdownRef = useRef<HTMLDivElement>(null);

  /* =========================================================
     3️⃣ Products & Items States
     ========================================================= */

  const [items, setItems] = useState<any[]>([]);
  const [showProductModal, setShowProductModal] = useState(false);
  const [search, setSearch] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [pendingDuplicate, setPendingDuplicate] = useState<{
    product: any;
    pkg: string;
    price: number;
  } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Variant package picker — from cache
  const [packagePickerProduct, setPackagePickerProduct] = useState<any>(null);
  const [packagePickerStock, setPackagePickerStock] = useState<Record<
    number,
    number
  > | null>(null);

  // Fetch stock when package picker opens
  useEffect(() => {
    if (!packagePickerProduct) return;
    setPackagePickerStock(null);
    api
      .get("/stock/quantity-all", {
        params: { product_id: packagePickerProduct.id, branch_id: 2 },
      })
      .then((res) => setPackagePickerStock(res.data || {}))
      .catch(() => setPackagePickerStock({}));
  }, [packagePickerProduct]);

  /* =========================================================
     4️⃣ Invoice Payment States
     ========================================================= */

  const [extraDiscount, setExtraDiscount] = useState("0");
  const [paidAmount, setPaidAmount] = useState("0");

  /* =========================================================
     5️⃣ Fetch Products (Cached — localStorage + auto-refresh)
     ========================================================= */

  const {
    products,
    variantsMap,
    loading: loadingProducts,
    refresh: refreshProducts,
    refreshSilently: refreshProductsSilently,
  } = useCachedProducts({
    endpoint: "/products",
    params: {
      branch_id: 2,
      invoice_type: "wholesale",
      movement_type: movementType,
    },
    fetchVariants: true,
    cacheKey: `wholesale_${movementType}`,
  });

  // Cleanup customer search timer on unmount
  useEffect(() => {
    return () => {
      if (nameTimerRef.current) clearTimeout(nameTimerRef.current);
    };
  }, []);

  /* =========================================================
     6️⃣ Customer Search By Name
     ========================================================= */

  const nameTimerRef = useRef<NodeJS.Timeout | null>(null);

  const searchCustomers = async (query: string) => {
    if (query.length < 2) {
      setCustomerSuggestions([]);
      setShowNameDropdown(false);
      return;
    }

    try {
      const res = await api.get("/customers/search", {
        params: { name: query },
      });

      setCustomerSuggestions(res.data || []);
      setShowNameDropdown((res.data || []).length > 0);
      setHighlightedIndex(-1);
    } catch {}
  };

  const selectCustomer = (customer: any) => {
    setCustomerName(customer.name);
    setCustomerId(customer.id);
    setCustomerPhone(customer.phone || customer.phones?.[0] || "");
    setShowNameDropdown(false);
    setCustomerSuggestions([]);
    fetchCustomerBalance(customer.id);
  };

  /* Close dropdown on outside click */
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        nameDropdownRef.current &&
        !nameDropdownRef.current.contains(e.target as Node)
      ) {
        setShowNameDropdown(false);
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

  const addItem = useCallback(
    (product: any) => {
      // لو الصنف عنده أكواد فرعية → نعرض اختيار العبوة
      const variants = variantsMap[product.id];
      if (variants && variants.length > 0) {
        setPackagePickerProduct(product);
        setShowProductModal(false);
        return;
      }

      finalizeAddItem(product, product.wholesale_package || "-", product.price);
    },
    [variantsMap],
  );

  const finalizeAddItem = useCallback(
    (product: any, pkg: string, price: number) => {
      let duplicate = false;
      const vid = product.variant_id || 0;
      const uid = `${product.id}_${vid}_${Date.now()}`;
      setItems((prev) => {
        const key = `${product.id}_${pkg}`;
        const exists = prev.find((i) => `${i.product_id}_${i.package}` === key);
        if (exists) {
          duplicate = true;
          return prev;
        }

        return [
          ...prev,
          {
            uid,
            product_id: product.id,
            product_name: product.name,
            manufacturer: product.manufacturer || "-",
            package: pkg,
            price: price,
            quantity: 1,
            discount: 0,
            variant_id: vid,
          },
        ];
      });

      if (duplicate) {
        setPendingDuplicate({ product, pkg, price });
      } else {
        setLastAddedId(uid);
      }
      setShowProductModal(false);
      setPackagePickerProduct(null);
    },
    [],
  );

  const confirmDuplicateAdd = useCallback(() => {
    if (!pendingDuplicate) return;
    const { product, pkg, price } = pendingDuplicate;
    const vid = product.variant_id || 0;
    const uid = `${product.id}_${vid}_${Date.now()}`;
    setItems((prev) => [
      ...prev,
      {
        uid,
        product_id: product.id,
        product_name: product.name,
        manufacturer: product.manufacturer || "-",
        package: pkg,
        price: price,
        quantity: 1,
        discount: 0,
        variant_id: vid,
      },
    ]);
    setLastAddedId(uid);
    setPendingDuplicate(null);
  }, [pendingDuplicate]);

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

  const removeItem = (uid: string) => {
    setItems((prev) => prev.filter((i) => i.uid !== uid));
  };

  /* =========================================================
     1️⃣1️⃣ Calculations
     ========================================================= */

  const totalBeforeDiscount = useMemo(() => {
    return items.reduce((sum, item) => {
      const raw =
        Number(item.price) * (Number(item.quantity) || 0) -
        (Number(item.discount) || 0);
      return sum + (item.is_return ? -raw : raw);
    }, 0);
  }, [items]);

  const finalTotal = useMemo(() => {
    return totalBeforeDiscount - (Number(extraDiscount) || 0);
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

    setSaving(true);
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
        created_by: user?.id,
        created_by_name: user?.username,
      });

      const newId = res.data?.id || res.data?.invoice_id;
      setSavedInvoiceId(newId);
      setJournalPosted(res.data?.journal_posted || false);
      setShowSavedModal(true);

      // تحديث كاش الأصناف بعد الحفظ
      refreshProductsSilently();

      setItems([]);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerId(null);
      setPreviousBalance("0");
      setExtraDiscount("0");
      setPaidAmount("0");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  /* =========================================================
     Warn before leaving with unsaved items
     ========================================================= */

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (items.length > 0) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [items.length]);

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

  const filteredProducts = useMemo(() => {
    const filtered = products.filter((p) => {
      const s = search.toLowerCase();
      return (
        String(p.id).includes(s) ||
        p.name.toLowerCase().includes(s) ||
        (p.description && p.description.toLowerCase().includes(s)) ||
        (p.barcode && p.barcode.toLowerCase().includes(s))
      );
    });

    return filtered.sort((a, b) => {
      const aInStock = Number(a.available_quantity) > 0 ? 1 : 0;
      const bInStock = Number(b.available_quantity) > 0 ? 1 : 0;
      if (aInStock !== bInStock) return bInStock - aInStock;
      return String(a.name || "").localeCompare(String(b.name || ""), "ar");
    });
  }, [products, search]);

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

        <Card className="p-6 space-y-6 overflow-hidden">
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
                placeholder="اكتب الاسم أو رقم التليفون..."
                onChange={(e) => {
                  const v = e.target.value;
                  setCustomerName(v);
                  setCustomerId(null);
                  if (nameTimerRef.current) clearTimeout(nameTimerRef.current);
                  nameTimerRef.current = setTimeout(
                    () => searchCustomers(v),
                    300,
                  );
                }}
                onFocus={() => {
                  if (customerSuggestions.length > 0) setShowNameDropdown(true);
                }}
                onKeyDown={(e) => {
                  if (!showNameDropdown || customerSuggestions.length === 0)
                    return;
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setHighlightedIndex((prev) =>
                      prev < customerSuggestions.length - 1 ? prev + 1 : 0,
                    );
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setHighlightedIndex((prev) =>
                      prev > 0 ? prev - 1 : customerSuggestions.length - 1,
                    );
                  } else if (e.key === "Enter" && highlightedIndex >= 0) {
                    e.preventDefault();
                    selectCustomer(customerSuggestions[highlightedIndex]);
                    setHighlightedIndex(-1);
                  } else if (e.key === "Escape") {
                    setShowNameDropdown(false);
                    setHighlightedIndex(-1);
                  }
                }}
              />
              {showNameDropdown && customerSuggestions.length > 0 && (
                <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {customerSuggestions.map((c: any, idx: number) => (
                    <div
                      key={c.id}
                      className={`px-3 py-2 cursor-pointer text-sm ${idx === highlightedIndex ? "bg-muted" : "hover:bg-muted"}`}
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
                    <th className="p-3 text-center">الخصم</th>
                    <th className="p-3 text-center">الإجمالي</th>
                    <th className="p-3 text-center">مرتجع</th>
                    <th className="p-3 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.uid} className="border-b">
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
                          data-quantity-id={item.uid}
                          className="w-20 mx-auto text-center"
                          value={item.quantity}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const el = document.querySelector(
                                `[data-discount-id="${item.uid}"]`,
                              ) as HTMLInputElement;
                              el?.focus();
                              el?.select();
                            }
                          }}
                          onChange={(e) =>
                            setItems((prev) =>
                              prev.map((i) =>
                                i.uid === item.uid
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
                          data-discount-id={item.uid}
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
                                i.uid === item.uid
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
                        {(() => {
                          const raw =
                            Number(item.price) * (Number(item.quantity) || 0) -
                            (Number(item.discount) || 0);
                          return item.is_return ? -raw : raw;
                        })()}
                      </td>
                      <td className="p-3 text-center">
                        <Checkbox
                          checked={item.is_return || false}
                          onCheckedChange={(checked) =>
                            setItems((prev) =>
                              prev.map((i) =>
                                i.uid === item.uid
                                  ? { ...i, is_return: !!checked }
                                  : i,
                              ),
                            )
                          }
                        />
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => {
                              const prod = products.find(
                                (p) => p.id === item.product_id,
                              );
                              if (prod) {
                                setEditProduct(prod);
                              }
                            }}
                          >
                            <Pencil className="size-4 text-blue-600" />
                          </Button>
                          {confirmDeleteId === item.uid ? (
                            <Button
                              variant="destructive"
                              size="icon-xs"
                              onClick={() => {
                                removeItem(item.uid);
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
                                setConfirmDeleteId(item.uid);
                                setTimeout(
                                  () =>
                                    setConfirmDeleteId((prev) =>
                                      prev === item.uid ? null : prev,
                                    ),
                                  2000,
                                );
                              }}
                            >
                              <Trash2 className="size-4 text-destructive" />
                            </Button>
                          )}
                        </div>
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

            <Button
              onClick={saveInvoice}
              className="w-full"
              size="lg"
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" /> جارٍ
                  الحفظ...
                </>
              ) : (
                "حفظ الفاتورة"
              )}
            </Button>
          </Card>
        )}

        {/* ================= Product Modal ================= */}

        {/* ===== مودل تم الحفظ ===== */}
        <Dialog open={showSavedModal} onOpenChange={setShowSavedModal}>
          <DialogContent dir="rtl" className="max-w-sm text-center">
            <DialogHeader>
              <DialogTitle>
                {isRetailUser ? "تم ارسال الفاتورة" : "تم حفظ الفاتورة"}
              </DialogTitle>
            </DialogHeader>
            {isRetailUser ? (
              <p className="text-lg py-4">تم ارسال الفاتورة الى المخزن</p>
            ) : (
              <>
                <p className="text-lg py-4">
                  تم حفظ الفاتورة برقم{" "}
                  <span className="font-bold text-primary">
                    {savedInvoiceId}
                  </span>
                </p>
                {movementType === "sale" && (
                  <p
                    className={`text-sm -mt-2 mb-2 ${journalPosted ? "text-muted-foreground" : "text-orange-500"}`}
                  >
                    {journalPosted
                      ? "تم ترحيل المبالغ إلى اليومية"
                      : "⚠️ لم يتم الترحيل لليومية (المدفوع = 0)"}
                  </p>
                )}
              </>
            )}
            <div className="flex gap-3">
              {!isRetailUser && (
                <Button
                  className="flex-1"
                  onClick={() => {
                    window.open(`/invoices/${savedInvoiceId}/print`, "_blank");
                    setShowSavedModal(false);
                  }}
                >
                  طباعة
                </Button>
              )}
              <Button
                variant={isRetailUser ? "default" : "outline"}
                className="flex-1"
                onClick={() => setShowSavedModal(false)}
              >
                {isRetailUser ? "تم" : "إلغاء"}
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
                placeholder="ابحث بالكود أو الاسم أو الوصف أو الباركود... (Enter للتنقل)"
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
                <div className="p-4 space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="p-3 rounded-lg border space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  ))}
                </div>
              ) : (
                filteredProducts.map((product, index) => {
                  const outOfStock =
                    movementType === "sale" &&
                    Number(product.available_quantity) <= 0;
                  return (
                    <div
                      key={product.id}
                      data-product-index={index}
                      tabIndex={outOfStock ? -1 : 0}
                      onClick={() => !outOfStock && addItem(product)}
                      onKeyDown={(e) =>
                        !outOfStock && handleListKeyDown(e, index)
                      }
                      className={`p-3 rounded-lg border transition outline-none ${
                        outOfStock
                          ? "opacity-50 cursor-not-allowed bg-muted/30"
                          : `cursor-pointer hover:bg-muted ${focusedIndex === index ? "ring-2 ring-primary bg-muted" : ""}`
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="font-medium">{product.name}</div>
                        {outOfStock && (
                          <span className="text-[10px] bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full font-medium">
                            نفذ
                          </span>
                        )}
                        {variantsMap[product.id]?.length > 0 && (
                          <span className="text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full">
                            {variantsMap[product.id].length + 1} عبوات
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                        <span>المصنع: {product.manufacturer || "-"}</span>
                        <span>العبوة: {product.wholesale_package || "-"}</span>
                        <span>السعر: {product.price}</span>
                        <span>الرصيد: {product.available_quantity}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* ================= Package Picker Modal ================= */}
        <Dialog
          open={!!packagePickerProduct}
          onOpenChange={(open) => {
            if (!open) {
              setPackagePickerProduct(null);
              setPackagePickerStock(null);
            }
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
              <button
                className="w-full p-3 rounded-lg border hover:bg-muted transition text-right"
                onClick={() => {
                  if (packagePickerProduct) {
                    finalizeAddItem(
                      packagePickerProduct,
                      packagePickerProduct.wholesale_package || "-",
                      packagePickerProduct.price,
                    );
                  }
                }}
              >
                <div className="font-medium">
                  {packagePickerProduct?.wholesale_package || "-"}
                </div>
                <div className="text-sm text-muted-foreground">
                  السعر: {packagePickerProduct?.price} ج
                  {packagePickerStock !== null && (
                    <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-semibold mr-2">
                      الرصيد: {packagePickerStock[0] ?? 0}
                    </span>
                  )}
                </div>
              </button>

              {/* العبوات الفرعية */}
              {packagePickerProduct &&
                variantsMap[packagePickerProduct.id]?.map((v: any) => (
                  <button
                    key={v.id}
                    className="w-full p-3 rounded-lg border hover:bg-muted transition text-right"
                    onClick={() => {
                      finalizeAddItem(
                        { ...packagePickerProduct, variant_id: v.id },
                        v.wholesale_package || "-",
                        movementType === "sale"
                          ? Number(v.wholesale_price)
                          : Number(v.purchase_price),
                      );
                    }}
                  >
                    <div className="font-medium">
                      {v.wholesale_package || "-"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      السعر:{" "}
                      {movementType === "sale"
                        ? v.wholesale_price
                        : v.purchase_price}{" "}
                      ج{v.label && <span className="mr-2">({v.label})</span>}
                      {packagePickerStock !== null && (
                        <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-semibold mr-2">
                          الرصيد: {packagePickerStock[v.id] ?? 0}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* Duplicate product confirmation */}
        <AlertDialog
          open={!!pendingDuplicate}
          onOpenChange={(open) => !open && setPendingDuplicate(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader className="text-center sm:text-center">
              <AlertDialogTitle>الصنف موجود مسبقاً</AlertDialogTitle>
              <AlertDialogDescription>
                الصنف &quot;{pendingDuplicate?.product?.name}&quot; موجود بالفعل
                في الفاتورة. هل تريد إضافته كسطر جديد؟
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex-row justify-center gap-3 sm:justify-center">
              <AlertDialogAction onClick={confirmDuplicateAdd}>
                نعم، أضف سطر جديد
              </AlertDialogAction>
              <AlertDialogCancel>لا</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {/* ================= Edit Product Dialog ================= */}
        <ProductFormDialog
          open={!!editProduct}
          onOpenChange={(open) => !open && setEditProduct(null)}
          product={editProduct || undefined}
          onSuccess={() => {
            refreshProducts();
            setEditProduct(null);
          }}
        />
      </div>
    </div>
  );
}
