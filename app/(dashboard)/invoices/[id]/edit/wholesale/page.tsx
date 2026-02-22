"use client";

/* =========================================================
   Imports
   ========================================================= */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/services/api";
import { Trash2, Loader2, Pencil, RefreshCw, ChevronDown } from "lucide-react";
import { ProductFormDialog } from "@/components/product-form-dialog";
import { useCachedProducts } from "@/hooks/use-cached-products";
import { highlightText } from "@/lib/highlight-text";
import { multiWordMatch, multiWordScore } from "@/lib/utils";
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
import { useAuth } from "@/app/context/auth-context";
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

export default function EditWholesaleInvoicePage() {
  const { user } = useAuth();
  const { id } = useParams();
  const router = useRouter();
  const [loadingInvoice, setLoadingInvoice] = useState(true);

  /* =========================================================
     1️⃣ Invoice Header States
     ========================================================= */

  const [movementType, setMovementType] = useState<"sale" | "purchase">("sale");
  const [invoiceDate, setInvoiceDate] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [previousBalance, setPreviousBalance] = useState("0");

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
  const [originalItems, setOriginalItems] = useState<any[]>([]);
  const [showProductModal, setShowProductModal] = useState(false);
  const [search, setSearch] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [refreshingProducts, setRefreshingProducts] = useState(false);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [expandedItemUid, setExpandedItemUid] = useState<string | null>(null);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [pendingDuplicate, setPendingDuplicate] = useState<{
    product: any;
  } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  /* =========================================================
     4️⃣ Invoice Payment States
     ========================================================= */

  const [extraDiscount, setExtraDiscount] = useState("0");
  const [paidAmount, setPaidAmount] = useState("0");
  const [applyItemsDiscount, setApplyItemsDiscount] = useState(false);

  /* =========================================================
     5️⃣ Fetch Invoice Data
     ========================================================= */

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        setLoadingInvoice(true);
        const res = await api.get(`/invoices/${id}/edit`);
        const inv = res.data;

        if (inv.invoice_type !== "wholesale") {
          toast.error("هذه فاتورة قطاعي وليست جملة");
          router.push("/invoices");
          return;
        }

        setMovementType(inv.movement_type);
        setInvoiceDate(
          inv.invoice_date ? inv.invoice_date.substring(0, 10) : "",
        );
        setCustomerName(inv.customer_name || "");
        setCustomerPhone(inv.customer_phone || "");
        setPreviousBalance(String(inv.previous_balance || 0));
        setExtraDiscount(String(inv.extra_discount || 0));
        setPaidAmount(String(inv.paid_amount || 0));
        setApplyItemsDiscount(inv.apply_items_discount ?? false);

        const loadedItems = (inv.items || []).map((item: any, idx: number) => ({
          uid: `${item.product_id}_${idx}_${Date.now()}`,
          product_name: item.product_name,
          product_id: item.product_id,
          manufacturer: item.manufacturer || "-",
          package: item.package || "-",
          price: item.price,
          quantity: item.quantity,
          discount: item.discount || 0,
          is_return: item.is_return || false,
        }));

        setItems(loadedItems);
        setOriginalItems(loadedItems);
      } catch {
        toast.error("فشل تحميل بيانات الفاتورة");
        router.push("/invoices");
      } finally {
        setLoadingInvoice(false);
      }
    };

    if (id) fetchInvoice();
  }, [id]);

  /* =========================================================
     6️⃣ Fetch Products From Backend
     ========================================================= */

  const {
    products,
    loading: loadingProducts,
    refresh: refreshProducts,
    invalidateCache,
  } = useCachedProducts({
    endpoint: "/products",
    params: {
      branch_id: 2,
      invoice_type: "wholesale",
      movement_type: movementType,
    },
    cacheKey: `wholesale_${movementType}`,
  });

  /* =========================================================
     7️⃣ Customer Search By Name
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

  /* Close dropdowns on outside click */
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
     9️⃣ Fetch Customer Balance
     ========================================================= */

  const fetchCustomerBalance = async (cid: number) => {
    try {
      const res = await api.get(`/customers/${cid}/balance`, {
        params: { invoice_type: "wholesale" },
      });

      setPreviousBalance(String(res.data.balance || 0));
    } catch {
      setPreviousBalance("0");
    }
  };

  /* =========================================================
     🔟 Add Item To Invoice
     ========================================================= */

  const addItem = useCallback((product: any) => {
    let duplicate = false;
    const uid = `${product.id}_${Date.now()}`;
    setItems((prev) => {
      const exists = prev.find((i) => i.product_id === product.id);
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
          package: product.wholesale_package || "-",
          price: product.price,
          quantity: 1,
          discount: 0,
        },
      ];
    });

    if (duplicate) {
      setPendingDuplicate({ product });
    } else {
      setLastAddedId(uid);
    }
    setShowProductModal(false);
  }, []);

  const confirmDuplicateAdd = useCallback(() => {
    if (!pendingDuplicate) return;
    const { product } = pendingDuplicate;
    const uid = `${product.id}_${Date.now()}`;
    setItems((prev) => [
      ...prev,
      {
        uid,
        product_id: product.id,
        product_name: product.name,
        manufacturer: product.manufacturer || "-",
        package: product.wholesale_package || "-",
        price: product.price,
        quantity: 1,
        discount: 0,
      },
    ]);
    setLastAddedId(uid);
    setPendingDuplicate(null);
  }, [pendingDuplicate]);

  /* Focus quantity input of last added item */
  useEffect(() => {
    if (lastAddedId !== null) {
      setExpandedItemUid(lastAddedId);
      setTimeout(() => {
        const isMobile = window.innerWidth < 768;
        const attr = isMobile ? "data-mobile-quantity-id" : "data-quantity-id";
        const el = document.querySelector(
          `[${attr}="${lastAddedId}"]`,
        ) as HTMLInputElement;
        if (el) {
          el.focus();
          el.select();
        }
        setLastAddedId(null);
      }, 200);
    }
  }, [lastAddedId]);

  /* =========================================================
     1️⃣1️⃣ Remove Item
     ========================================================= */

  const removeItem = (uid: string) => {
    setItems(items.filter((i) => i.uid !== uid));
  };

  /* =========================================================
     1️⃣2️⃣ Calculations
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
     1️⃣3️⃣ Update Invoice
     ========================================================= */

  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const updateInvoice = async () => {
    if (items.length === 0) {
      toast.error("لا يوجد أصناف");
      return;
    }

    if (!customerName.trim()) {
      toast.error("برجاء إدخال اسم العميل");
      return;
    }

    // التحقق من الرصيد المتاح (للبيع فقط) - مع مراعاة الكميات الأصلية في الفاتورة
    if (movementType === "sale") {
      const overStock = items.filter((item) => {
        const prod = products.find((p: any) => p.id === item.product_id);
        if (!prod) return false;
        // الكمية الأصلية للصنف في الفاتورة (متخصمة أصلاً من الرصيد)
        const origItem = originalItems.find(
          (o) => o.product_id === item.product_id && o.package === item.package,
        );
        const origQty = origItem ? Number(origItem.quantity) : 0;
        const effectiveAvailable = Number(prod.available_quantity) + origQty;
        return Number(item.quantity) > effectiveAvailable;
      });
      if (overStock.length > 0) {
        overStock.forEach((item) => {
          const prod = products.find((p: any) => p.id === item.product_id);
          const origItem = originalItems.find(
            (o) =>
              o.product_id === item.product_id && o.package === item.package,
          );
          const origQty = origItem ? Number(origItem.quantity) : 0;
          const effectiveAvailable =
            Number(prod?.available_quantity ?? 0) + origQty;
          toast.error(
            `الصنف "${item.product_name}" الكمية (${item.quantity}) أكبر من الرصيد المتاح (${effectiveAvailable})`,
          );
        });
        return;
      }
    }

    setSaving(true);
    try {
      await api.put(`/invoices/${id}`, {
        customer_name: customerName,
        customer_phone: customerPhone || null,
        manual_discount: Number(extraDiscount) || 0,
        items,
        paid_amount: Number(paidAmount) || 0,
        previous_balance: Number(previousBalance) || 0,
        apply_items_discount: applyItemsDiscount,
        updated_by: user?.id,
        updated_by_name: user?.username,
      });

      /* -------------------------------------------------------
         Sync cash entry (اليومية) after invoice update
         ------------------------------------------------------- */
      try {
        const paidNum = Number(paidAmount) || 0;

        // Fetch ALL cash-in entries and search by invoice_id or by notes
        const cashRes = await api.get("/cash-in");
        const entries: any[] = cashRes.data?.data || cashRes.data || [];
        const invoiceIdStr = String(id);
        const existing = entries.find(
          (e: any) =>
            (String(e.invoice_id) === invoiceIdStr &&
              e.source_type === "invoice") ||
            (e.notes &&
              e.notes.includes(`#${invoiceIdStr}`) &&
              e.source_type === "invoice"),
        );

        console.log(
          "🔍 Cash entries count:",
          entries.length,
          "Found existing:",
          existing?.id,
          "invoice_id:",
          id,
        );

        if (existing && paidNum > 0) {
          // Backend blocks PUT on invoice entries → DELETE then re-create
          await api.delete(`/cash-in/${existing.id}`);
          const remainingAmount = totalWithPrevious - paidNum;
          const recreateRes = await api.post("/cash/in", {
            transaction_date: invoiceDate,
            customer_name: customerName,
            description: `فاتورة جملة رقم #${id}{{${totalWithPrevious}|${paidNum}|${remainingAmount}}}`,
            amount: totalWithPrevious,
            paid_amount: paidNum,
            remaining_amount: remainingAmount,
            source_type: "invoice",
            invoice_id: Number(id),
          });
          console.log(
            "♻️ DELETE+CREATE cash-in response:",
            JSON.stringify(recreateRes.data),
          );
          toast.info(`تم تحديث قيد اليومية`);
        } else if (existing && paidNum === 0) {
          await api.delete(`/cash-in/${existing.id}`);
          toast.info("تم حذف قيد اليومية");
        } else if (!existing && paidNum > 0) {
          const remainingAmount = totalWithPrevious - paidNum;
          const createRes = await api.post("/cash/in", {
            transaction_date: invoiceDate,
            customer_name: customerName,
            description: `فاتورة جملة رقم #${id}{{${totalWithPrevious}|${paidNum}|${remainingAmount}}}`,
            amount: totalWithPrevious,
            paid_amount: paidNum,
            remaining_amount: remainingAmount,
            source_type: "invoice",
            invoice_id: Number(id),
          });
          console.log(
            "📝 POST cash-in response:",
            JSON.stringify(createRes.data),
          );
          const newEntryId = createRes.data?.cash_in_id || createRes.data?.id;
          toast.info(`تم إنشاء قيد يومية جديد #${newEntryId}`);
        }
      } catch (cashErr: any) {
        console.error(
          "Cash sync error:",
          cashErr.response?.data || cashErr.message,
        );
        toast.warning("تعذّر تحديث قيد اليومية");
      }

      toast.success("تم تعديل الفاتورة بنجاح");
      invalidateCache();
      window.location.reload();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "فشل التعديل");
    } finally {
      setSaving(false);
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

  const filteredProducts = useMemo(() => {
    const filtered = products.filter((p) =>
      multiWordMatch(
        search,
        String(p.id),
        p.name,
        p.description,
        p.barcode,
        p.manufacturer,
      ),
    );

    return filtered.sort((a, b) => {
      if (search.trim()) {
        const scoreA = multiWordScore(
          search,
          a.name,
          String(a.id),
          a.description,
          a.barcode,
          a.manufacturer,
        );
        const scoreB = multiWordScore(
          search,
          b.name,
          String(b.id),
          b.description,
          b.barcode,
          b.manufacturer,
        );
        if (scoreA !== scoreB) return scoreB - scoreA;
      }
      const aInStock = Number(a.available_quantity) > 0 ? 1 : 0;
      const bInStock = Number(b.available_quantity) > 0 ? 1 : 0;
      if (aInStock !== bInStock) return bInStock - aInStock;
      return String(a.name || "").localeCompare(String(b.name || ""), "ar");
    });
  }, [products, search]);

  const MODAL_DISPLAY_LIMIT = 50;
  const displayedProducts = useMemo(
    () => filteredProducts.slice(0, MODAL_DISPLAY_LIMIT),
    [filteredProducts],
  );

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (filteredProducts.length > 0) {
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

  if (loadingInvoice) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-muted-foreground">جاري تحميل الفاتورة...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto px-4" style={{ maxWidth: 950, width: "100%" }}>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-center">
          تعديل فاتورة جملة #{id}
        </h1>

        <Card className="p-6 space-y-6">
          <div className="space-y-6">
            <div>
              <label className="text-sm mb-2 block">نوع الحركة</label>
              <Select value={movementType} disabled>
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
              <Input type="date" value={invoiceDate} disabled />
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
          <>
            <Card className="p-6 hidden md:block">
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
                          {(() => {
                            const prod = products.find(
                              (pr: any) => pr.id === item.product_id,
                            );
                            const avail = prod
                              ? Number(prod.available_quantity)
                              : null;
                            return avail !== null &&
                              Number(item.quantity) > avail ? (
                              <div className="text-[11px] text-red-500 mt-1">
                                الرصيد المتاح: {avail}
                              </div>
                            ) : null;
                          })()}
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
                              Number(item.price) *
                                (Number(item.quantity) || 0) -
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

            {/* Mobile item cards */}
            <div className="md:hidden space-y-3">
              {items.map((item, index) => {
                const itemTotal = (() => {
                  const raw =
                    Number(item.price) * (Number(item.quantity) || 0) -
                    (Number(item.discount) || 0);
                  return item.is_return ? -raw : raw;
                })();
                const isExpanded = expandedItemUid === item.uid;

                if (!isExpanded) {
                  return (
                    <div
                      key={item.uid}
                      className="border rounded-xl p-3 cursor-pointer active:bg-muted/50 transition-colors"
                      onClick={() => setExpandedItemUid(item.uid)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-xs text-muted-foreground font-mono w-5 text-center shrink-0">
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">
                              {item.product_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.package} × {item.quantity}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-semibold text-sm">
                            {itemTotal} ج.م
                          </span>
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={item.uid}
                    className="border rounded-xl p-4 space-y-3 shadow-sm ring-1 ring-primary/20"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">
                          {item.product_name} - {item.manufacturer}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.package} — كود: {item.product_id}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 h-8 w-8"
                        onClick={() => setExpandedItemUid(null)}
                      >
                        <ChevronDown className="h-4 w-4 rotate-180" />
                      </Button>
                    </div>

                    {/* Price */}
                    <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                      <span className="text-xs text-muted-foreground">
                        السعر
                      </span>
                      <span className="font-medium">{item.price} ج.م</span>
                    </div>

                    {/* Quantity + Discount */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          الكمية
                        </label>
                        <Input
                          type="number"
                          data-mobile-quantity-id={item.uid}
                          className="text-center"
                          value={item.quantity}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const el = document.querySelector(
                                `[data-mobile-discount-id="${item.uid}"]`,
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
                        {(() => {
                          const prod = products.find(
                            (pr: any) => pr.id === item.product_id,
                          );
                          const avail = prod
                            ? Number(prod.available_quantity)
                            : null;
                          return avail !== null &&
                            Number(item.quantity) > avail ? (
                            <div className="text-[11px] text-red-500">
                              الرصيد: {avail}
                            </div>
                          ) : null;
                        })()}
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          الخصم
                        </label>
                        <Input
                          type="number"
                          data-mobile-discount-id={item.uid}
                          className="text-center"
                          value={item.discount || 0}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              setExpandedItemUid(null);
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
                                          ? 0
                                          : Number(e.target.value),
                                    }
                                  : i,
                              ),
                            )
                          }
                        />
                      </div>
                    </div>

                    {/* Total */}
                    <div className="flex items-center justify-between border-t pt-2">
                      <span className="text-sm text-muted-foreground">
                        الإجمالي
                      </span>
                      <span className="font-bold text-lg">{itemTotal} ج.م</span>
                    </div>

                    {/* Footer: Return + Delete */}
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-sm">
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
                        مرتجع
                      </label>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            const prod = products.find(
                              (p) => p.id === item.product_id,
                            );
                            if (prod) {
                              setEditProduct(prod);
                            }
                          }}
                        >
                          <Pencil className="h-4 w-4 text-blue-600" />
                        </Button>
                        {confirmDeleteId === item.uid ? (
                          <Button
                            variant="destructive"
                            size="sm"
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
                            size="icon"
                            className="h-8 w-8"
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
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
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
              onClick={updateInvoice}
              className="w-full"
              size="lg"
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" /> جارٍ
                  التحديث...
                </>
              ) : (
                "تحديث الفاتورة"
              )}
            </Button>
            <Button
              variant="outline"
              className="w-full mt-2"
              size="lg"
              onClick={() => setPreviewOpen(true)}
            >
              معاينة قبل الطباعة
            </Button>
          </Card>
        )}

        {/* ================= Preview Modal ================= */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent
            dir="rtl"
            className="sm:max-w-4xl h-[85vh] p-0 flex flex-col overflow-hidden"
          >
            <DialogHeader className="p-4 pb-2 shrink-0">
              <DialogTitle>معاينة الفاتورة</DialogTitle>
            </DialogHeader>
            <iframe
              src={`/invoices/${id}/print?preview=1`}
              className="flex-1 w-full border-0"
              style={{ minHeight: 0 }}
            />
            <div className="flex gap-3 p-4 pt-2 border-t shrink-0">
              <Button
                className="flex-1"
                onClick={() => {
                  window.open(`/invoices/${id}/print`, "_blank");
                  setPreviewOpen(false);
                }}
              >
                طباعة
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setPreviewOpen(false)}
              >
                إغلاق
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
              <div className="flex items-center gap-2">
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
                  className="flex-1"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={async () => {
                    setRefreshingProducts(true);
                    try {
                      await refreshProducts();
                    } finally {
                      setRefreshingProducts(false);
                    }
                  }}
                  disabled={refreshingProducts}
                  title="تحديث الأصناف"
                  className="shrink-0"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${refreshingProducts ? "animate-spin" : ""}`}
                  />
                </Button>
              </div>
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
                <>
                  {displayedProducts.map((product, index) => {
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
                          <div className="font-medium">
                            {highlightText(product.name, search)}
                          </div>
                          {outOfStock && (
                            <span className="text-[10px] bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full font-medium">
                              نفذ
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                          <span>
                            المصنع:{" "}
                            {highlightText(product.manufacturer || "-", search)}
                          </span>
                          <span>
                            العبوة: {product.wholesale_package || "-"}
                          </span>
                          <span>السعر: {product.price}</span>
                          <span>الرصيد: {product.available_quantity}</span>
                        </div>
                      </div>
                    );
                  })}
                  {filteredProducts.length > MODAL_DISPLAY_LIMIT && (
                    <div className="text-center text-xs text-muted-foreground py-3">
                      يتم عرض {MODAL_DISPLAY_LIMIT} من {filteredProducts.length}{" "}
                      صنف — ابحث لتضييق النتائج
                    </div>
                  )}
                </>
              )}
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
