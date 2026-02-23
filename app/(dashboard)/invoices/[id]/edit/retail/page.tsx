"use client";

/* =========================================================
   Imports
   ========================================================= */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/services/api";
import { broadcastUpdate } from "@/lib/broadcast";
import {
  Trash2,
  Loader2,
  Pencil,
  RefreshCw,
  ChevronDown,
  ArrowLeftRight,
  Eye,
} from "lucide-react";
import { QuickTransferModal } from "@/components/quick-transfer-modal";
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

export default function EditRetailInvoicePage() {
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

  /* Supplier fields (purchase only) */
  const [supplierName, setSupplierName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierSuggestions, setSupplierSuggestions] = useState<any[]>([]);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [highlightedSupplierIndex, setHighlightedSupplierIndex] = useState(-1);
  const supplierDropdownRef = useRef<HTMLDivElement>(null);

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
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [search, setSearch] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [refreshingProducts, setRefreshingProducts] = useState(false);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingItemUid, setEditingItemUid] = useState<string | null>(null);
  const [expandedItemUid, setExpandedItemUid] = useState<string | null>(null);
  const [pendingDuplicate, setPendingDuplicate] = useState<{
    product: any;
    source: "barcode" | "manual";
  } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  /* =========================================================
     3.5 Barcode State
     ========================================================= */

  const [barcode, setBarcode] = useState("");
  const barcodeRef = useRef<HTMLInputElement>(null);

  /* =========================================================
     4️⃣ Invoice Payment States
     ========================================================= */

  const [extraDiscount, setExtraDiscount] = useState("0");
  const [paidAmount, setPaidAmount] = useState("0");
  const [applyItemsDiscount, setApplyItemsDiscount] = useState(true);

  /* =========================================================
     5️⃣ Fetch Invoice Data
     ========================================================= */

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        setLoadingInvoice(true);
        const res = await api.get(`/invoices/${id}/edit`);
        const inv = res.data;

        if (inv.invoice_type !== "retail") {
          toast.error("هذه فاتورة جملة وليست قطاعي");
          router.push("/invoices");
          return;
        }

        setMovementType(inv.movement_type);
        setInvoiceDate(
          inv.invoice_date ? inv.invoice_date.substring(0, 10) : "",
        );
        setCustomerName(inv.customer_name || "");
        setCustomerPhone(inv.customer_phone || "");
        setSupplierName(inv.supplier_name || "");
        setSupplierPhone(inv.supplier_phone || "");
        setPreviousBalance(String(inv.previous_balance || 0));
        setExtraDiscount(String(inv.extra_discount || 0));
        setPaidAmount(String(inv.paid_amount || 0));
        setApplyItemsDiscount(inv.apply_items_discount ?? true);

        const loadedItems = (inv.items || []).map((item: any, idx: number) => ({
          uid: `${item.product_id}_${idx}_${Date.now()}`,
          product_id: item.product_id,
          product_name: item.product_name,
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
    refreshSilently: refreshProductsSilently,
    invalidateCache,
  } = useCachedProducts({
    endpoint: "/products",
    params: {
      branch_id: 1,
      invoice_type: "retail",
      movement_type: movementType,
    },
    cacheKey: `retail_${movementType}`,
  });

  /* =========================================================
     6.5 Barcode Scan
     ========================================================= */

  const handleBarcodeScan = async (code: string) => {
    if (!code.trim()) return;

    try {
      const res = await api.get(`/products/by-barcode/${code}`, {
        params: {
          invoice_type: "retail",
          movement_type: movementType,
        },
      });

      const product = res.data;

      // باركود → لو موجود نزود الكمية مباشرة
      const uid = `${product.id}_${Date.now()}`;
      setItems((prev) => {
        const exists = prev.find((i) => i.product_id === product.id);
        if (exists) {
          return prev.map((i) =>
            i.product_id === product.id
              ? { ...i, quantity: (Number(i.quantity) || 0) + 1 }
              : i,
          );
        }

        return [
          ...prev,
          {
            uid,
            product_id: product.id,
            product_name: product.name,
            manufacturer: product.manufacturer || "-",
            package: product.retail_package || "-",
            price: product.price,
            quantity: 1,
            discount: product.discount_amount || 0,
          },
        ];
      });

      toast.success(`تم إضافة: ${product.name}`);
      new Audio("/sounds/beep-7.mp3").play().catch(() => {});
      setTimeout(() => barcodeRef.current?.focus(), 100);
    } catch {
      toast.error("الصنف غير موجود");
    } finally {
      setBarcode("");
    }
  };

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

    if (
      customer.apply_items_discount !== undefined &&
      customer.apply_items_discount !== null
    ) {
      setApplyItemsDiscount(customer.apply_items_discount);
    }
  };

  /* Supplier search & select */
  const searchSuppliers = async (q: string) => {
    if (q.trim().length < 2) {
      setSupplierSuggestions([]);
      setShowSupplierDropdown(false);
      return;
    }
    try {
      const { data } = await api.get("/suppliers/search", {
        params: { q: q.trim() },
      });
      setSupplierSuggestions(Array.isArray(data) ? data : []);
      setShowSupplierDropdown(data.length > 0);
      setHighlightedSupplierIndex(-1);
    } catch {
      setSupplierSuggestions([]);
      setShowSupplierDropdown(false);
    }
  };
  const selectSupplier = (s: any) => {
    setSupplierName(s.name);
    setSupplierPhone(s.phone || "");
    setShowSupplierDropdown(false);
    setSupplierSuggestions([]);
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
        supplierDropdownRef.current &&
        !supplierDropdownRef.current.contains(e.target as Node)
      ) {
        setShowSupplierDropdown(false);
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
        params: { invoice_type: "retail" },
      });

      const bal = res.data?.balance;
      setPreviousBalance(String(bal != null ? bal : 0));
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
          package: product.retail_package || "-",
          price: product.price,
          quantity: 1,
          discount: product.discount_amount || 0,
        },
      ];
    });

    if (duplicate) {
      setPendingDuplicate({ product, source: "manual" });
    } else {
      setLastAddedId(uid);
    }
    setShowProductModal(false);
  }, []);

  const confirmDuplicateAdd = useCallback(() => {
    if (!pendingDuplicate) return;
    const { product, source } = pendingDuplicate;
    const uid = `${product.id}_${Date.now()}`;
    setItems((prev) => [
      ...prev,
      {
        uid,
        product_id: product.id,
        product_name: product.name,
        manufacturer: product.manufacturer || "-",
        package: product.retail_package || "-",
        price: product.price,
        quantity: 1,
        discount: product.discount_amount || 0,
      },
    ]);

    if (source === "barcode") {
      toast.success(`تم إضافة: ${product.name}`);
      new Audio("/sounds/beep-7.mp3").play().catch(() => {});
      setTimeout(() => barcodeRef.current?.focus(), 100);
    } else {
      setLastAddedId(uid);
    }
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
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          setTimeout(() => {
            el.focus();
            el.select();
          }, 300);
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
        (applyItemsDiscount
          ? (Number(item.discount) || 0) * (Number(item.quantity) || 0)
          : 0);
      return sum + (item.is_return ? -raw : raw);
    }, 0);
  }, [items, applyItemsDiscount]);

  const finalTotal = useMemo(() => {
    return totalBeforeDiscount - (Number(extraDiscount) || 0);
  }, [totalBeforeDiscount, extraDiscount]);

  const totalWithPrevious =
    Math.round((finalTotal + Number(previousBalance || 0)) * 100) / 100;

  const remaining =
    Math.round((totalWithPrevious - (Number(paidAmount) || 0)) * 100) / 100;

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

    // التحقق من الرصيد المتاح (للبيع فقط) - مع مراعاة الكميات الأصلية في الفاتورة
    if (movementType === "sale") {
      const overStock = items.filter((item) => {
        const prod = products.find((p: any) => p.id === item.product_id);
        if (!prod) return false;
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
      await api.put(`/invoices/retail/${id}`, {
        customer_name: customerName || "نقدي",
        customer_phone: customerPhone || null,
        total_before_discount: totalBeforeDiscount,
        extra_discount: Number(extraDiscount) || 0,
        final_total: finalTotal,
        items,
        paid_amount: Number(paidAmount) || 0,
        previous_balance: Number(previousBalance) ?? 0,
        apply_items_discount: applyItemsDiscount,
        updated_by: user?.id,
        updated_by_name: user?.username,
        ...(movementType === "purchase" && supplierName
          ? {
              supplier_name: supplierName,
              supplier_phone: supplierPhone || null,
            }
          : {}),
      });

      // Backend handles cash_in sync in the PUT transaction

      toast.success("تم تعديل الفاتورة بنجاح");
      broadcastUpdate("invoice_updated");
      invalidateCache();
      window.location.reload();
    } catch (err: any) {
      console.error(
        "❌ Invoice update error:",
        err.response?.status,
        err.response?.data,
        err.message,
      );
      const msg =
        err.response?.data?.error ||
        (err.code === "ECONNABORTED"
          ? "انتهت مهلة الاتصال بالسيرفر"
          : err.message || "فشل التعديل");
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  /* =========================================================
     Refresh products when search modal opens
     ========================================================= */
  useEffect(() => {
    if (showProductModal) {
      refreshProductsSilently();
    }
  }, [showProductModal]);

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
          تعديل فاتورة قطاعي #{id}
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
                inputMode="tel"
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>
          </div>
        </Card>

        {movementType === "purchase" && (
          <Card className="p-4">
            <h3 className="font-semibold mb-3 text-sm">بيانات المورد</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative" ref={supplierDropdownRef}>
                <label className="text-sm mb-2 block">اسم المورد</label>
                <Input
                  value={supplierName}
                  placeholder="اكتب اسم المورد..."
                  onChange={(e) => {
                    const v = e.target.value;
                    setSupplierName(v);
                    if (v.trim().length >= 2) {
                      searchSuppliers(v);
                    } else {
                      setSupplierSuggestions([]);
                      setShowSupplierDropdown(false);
                    }
                  }}
                  onFocus={() => {
                    if (supplierSuggestions.length > 0)
                      setShowSupplierDropdown(true);
                  }}
                  onKeyDown={(e) => {
                    if (
                      !showSupplierDropdown ||
                      supplierSuggestions.length === 0
                    )
                      return;
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setHighlightedSupplierIndex((prev) =>
                        prev < supplierSuggestions.length - 1 ? prev + 1 : 0,
                      );
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setHighlightedSupplierIndex((prev) =>
                        prev > 0 ? prev - 1 : supplierSuggestions.length - 1,
                      );
                    } else if (
                      e.key === "Enter" &&
                      highlightedSupplierIndex >= 0
                    ) {
                      e.preventDefault();
                      selectSupplier(
                        supplierSuggestions[highlightedSupplierIndex],
                      );
                      setHighlightedSupplierIndex(-1);
                    } else if (e.key === "Escape") {
                      setShowSupplierDropdown(false);
                      setHighlightedSupplierIndex(-1);
                    }
                  }}
                />
                {showSupplierDropdown && supplierSuggestions.length > 0 && (
                  <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {supplierSuggestions.map((s: any, idx: number) => (
                      <div
                        key={s.id}
                        className={`px-3 py-2 cursor-pointer text-sm ${idx === highlightedSupplierIndex ? "bg-muted" : "hover:bg-muted"}`}
                        onClick={() => selectSupplier(s)}
                      >
                        <span className="font-medium">{s.name}</span>
                        {s.phone && (
                          <span className="text-muted-foreground mr-2">
                            ({s.phone})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-sm mb-2 block">رقم هاتف المورد</label>
                <Input
                  value={supplierPhone}
                  inputMode="tel"
                  placeholder="رقم هاتف المورد..."
                  onChange={(e) => setSupplierPhone(e.target.value)}
                />
              </div>
            </div>
          </Card>
        )}

        {/* ===== Barcode Scanner ===== */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <label className="text-sm whitespace-nowrap font-medium">
              باركود
            </label>
            <Input
              ref={barcodeRef}
              inputMode="numeric"
              placeholder="امسح الباركود أو اكتبه..."
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (barcode.trim()) {
                    handleBarcodeScan(barcode);
                  } else if (items.length > 0) {
                    const lastItem = items[items.length - 1];
                    const el = document.querySelector(
                      `[data-quantity-id="${lastItem.uid}"]`,
                    ) as HTMLInputElement;
                    if (el) {
                      el.focus();
                      el.select();
                    }
                  }
                }
              }}
              className="flex-1"
            />
          </div>
        </Card>

        <div className="flex gap-2">
          <Button onClick={() => setShowProductModal(true)} className="flex-1">
            + إضافة صنف
          </Button>
          {user?.branch_id === 1 && (
            <Button
              variant="outline"
              className="gap-1.5 shrink-0"
              onClick={() => setShowTransferModal(true)}
            >
              <ArrowLeftRight className="h-4 w-4" />
              تحويل للمعرض
            </Button>
          )}
        </div>

        {items.length > 0 && (
          <>
            <Card className="p-6 hidden md:block">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-3 text-center w-10">#</th>
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
                    {items.map((item, index) => (
                      <tr key={item.uid} className="border-b">
                        <td className="p-3 text-center text-muted-foreground">
                          {index + 1}
                        </td>
                        <td className="p-3">
                          <div>
                            {item.product_name} - {item.manufacturer}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.package}
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          {editingItemUid === item.uid ? (
                            <Input
                              type="number"
                              autoFocus
                              data-price-id={item.uid}
                              className="w-24 mx-auto text-center"
                              value={item.price}
                              onFocus={(e) => e.target.select()}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  const discountInput = document.querySelector(
                                    `input[data-discount-id="${item.uid}"]`,
                                  ) as HTMLInputElement | null;
                                  discountInput?.focus();
                                  discountInput?.select();
                                }
                              }}
                              onChange={(e) =>
                                setItems((prev) =>
                                  prev.map((i) =>
                                    i.uid === item.uid
                                      ? {
                                          ...i,
                                          price:
                                            e.target.value === ""
                                              ? ""
                                              : Number(e.target.value),
                                        }
                                      : i,
                                  ),
                                )
                              }
                            />
                          ) : (
                            item.price
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <Input
                            type="number"
                            data-quantity-id={item.uid}
                            className="w-20 mx-auto text-center"
                            value={item.quantity}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                barcodeRef.current?.focus();
                                barcodeRef.current?.select();
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
                          {editingItemUid === item.uid ? (
                            <Input
                              type="number"
                              data-discount-id={item.uid}
                              className="w-20 mx-auto text-center"
                              value={item.discount || 0}
                              onFocus={(e) => e.target.select()}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  setEditingItemUid(null);
                                  barcodeRef.current?.focus();
                                  barcodeRef.current?.select();
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
                          ) : (
                            <span className="font-medium">
                              {item.discount || 0}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center font-semibold">
                          {(() => {
                            const raw =
                              Number(item.price) *
                                (Number(item.quantity) || 0) -
                              (applyItemsDiscount
                                ? (Number(item.discount) || 0) *
                                  (Number(item.quantity) || 0)
                                : 0);
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
                              onClick={() =>
                                setEditingItemUid((prev) =>
                                  prev === item.uid ? null : item.uid,
                                )
                              }
                            >
                              <Pencil
                                className={`size-4 ${editingItemUid === item.uid ? "text-green-600" : "text-blue-600"}`}
                              />
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
                    (applyItemsDiscount
                      ? (Number(item.discount) || 0) *
                        (Number(item.quantity) || 0)
                      : 0);
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
                          {item.package}
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
                      {editingItemUid === item.uid ? (
                        <Input
                          type="number"
                          autoFocus
                          className="w-28 text-center h-8"
                          value={item.price}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              setEditingItemUid(null);
                              const el = document.querySelector(
                                `[data-mobile-quantity-id="${item.uid}"]`,
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
                                      price:
                                        e.target.value === ""
                                          ? ""
                                          : Number(e.target.value),
                                    }
                                  : i,
                              ),
                            )
                          }
                        />
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="font-medium">{item.price} ج.م</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() =>
                              setEditingItemUid((prev) =>
                                prev === item.uid ? null : item.uid,
                              )
                            }
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
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
                );
              })}
            </div>
          </>
        )}

        {items.length > 0 && (
          <Card className="p-6 space-y-4">
            {/* تطبيق خصم الأصناف */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="apply-discount"
                checked={applyItemsDiscount}
                onCheckedChange={(v) => setApplyItemsDiscount(!!v)}
              />
              <label
                htmlFor="apply-discount"
                className="text-sm cursor-pointer"
              >
                خصم الأصناف
              </label>
            </div>

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
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs w-fit"
                onClick={() => setPaidAmount(String(totalWithPrevious))}
                title="دفع المتبقي بالكامل"
              >
                دفع الكل
              </Button>
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
          </Card>
        )}

        {items.length > 0 && (
          <div className="sticky bottom-0 z-30 bg-background border-t shadow-[0_-2px_10px_rgba(0,0,0,0.1)] p-3 -mx-4 px-4">
            <div className="flex gap-2 w-full">
              <Button
                onClick={updateInvoice}
                className="flex-1"
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
                variant="secondary"
                size="lg"
                onClick={() => setPreviewOpen(true)}
              >
                <Eye className="h-4 w-4 ml-1" />
                معاينة
              </Button>
            </div>
          </div>
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
            className="max-w-xl p-0 flex flex-col max-md:top-[1rem] max-md:translate-y-0"
            style={{ height: 420, maxHeight: "min(75vh, 75dvh)" }}
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
                          <span>العبوة: {product.retail_package || "-"}</span>
                          <span>السعر: {product.price}</span>
                          {product.discount_amount > 0 && (
                            <span className="text-destructive">
                              خصم: {product.discount_amount}
                            </span>
                          )}
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
        {/* Quick Transfer Modal */}
        <QuickTransferModal
          open={showTransferModal}
          onOpenChange={setShowTransferModal}
          onTransferComplete={() => {
            refreshProducts();
          }}
        />
      </div>
    </div>
  );
}
