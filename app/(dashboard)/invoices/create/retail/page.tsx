"use client";

/* =========================================================
   Imports
   ========================================================= */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "@/services/api";
import { Trash2, Camera, X, Loader2 } from "lucide-react";
import { BarcodeDetector } from "barcode-detector";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/* =========================================================
   Main Component
   ========================================================= */

export default function CreateRetailInvoicePage() {
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
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Package picker
  const [packagePickerProduct, setPackagePickerProduct] = useState<any>(null);
  const [packagePickerSource, setPackagePickerSource] = useState<
    "barcode" | "manual"
  >("barcode");
  const [packagePickerStock, setPackagePickerStock] = useState<Record<
    number,
    number
  > | null>(null);

  // Variant package picker
  const [variantsMap, setVariantsMap] = useState<Record<number, any[]>>({});

  /* =========================================================
     3.5 Barcode State
     ========================================================= */

  const [barcode, setBarcode] = useState("");
  const barcodeRef = useRef<HTMLInputElement>(null);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setShowCameraScanner(false);
  }, []);

  const startCamera = useCallback(async () => {
    // Check secure context (HTTPS required)
    if (!window.isSecureContext) {
      toast.error("الكاميرا تحتاج HTTPS — الموقع لازم يكون على رابط آمن");
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error("المتصفح لا يدعم الوصول للكاميرا");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
      });
      streamRef.current = stream;
      setShowCameraScanner(true);

      // Wait for video element to mount
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();

          const detector = new BarcodeDetector({
            formats: [
              "ean_13",
              "ean_8",
              "code_128",
              "code_39",
              "qr_code",
              "upc_a",
              "upc_e",
            ],
          });

          scanIntervalRef.current = setInterval(async () => {
            if (!videoRef.current || videoRef.current.readyState !== 4) return;
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length > 0) {
                const code = barcodes[0].rawValue;
                if (code) {
                  stopCamera();
                  handleBarcodeScan(code);
                }
              }
            } catch {
              /* ignore */
            }
          }, 300);
        }
      }, 100);
    } catch (err: any) {
      if (err?.name === "NotAllowedError") {
        toast.error(
          "تم رفض إذن الكاميرا — افتح إعدادات المتصفح واسمح بالكاميرا",
        );
      } else if (err?.name === "NotFoundError") {
        toast.error("لم يتم العثور على كاميرا في الجهاز");
      } else {
        toast.error(`خطأ في الكاميرا: ${err?.message || "غير معروف"}`);
      }
    }
  }, [stopCamera]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
      if (streamRef.current)
        streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  /* =========================================================
     4️⃣ Invoice Payment States
     ========================================================= */

  const [extraDiscount, setExtraDiscount] = useState("0");
  const [paidAmount, setPaidAmount] = useState("0");
  const [applyItemsDiscount, setApplyItemsDiscount] = useState(true);

  /* =========================================================
     5️⃣ Fetch Products From Backend
     ========================================================= */

  const fetchProducts = async () => {
    try {
      setLoadingProducts(true);

      const res = await api.get("/products", {
        params: {
          branch_id: 1,
          invoice_type: "retail",
          movement_type: movementType,
        },
      });

      const prods = res.data || [];
      setProducts(prods);

      // جلب الأكواد الفرعية لكل الأصناف
      if (prods.length > 0) {
        try {
          const ids = prods.map((p: any) => p.id).join(",");
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
      toast.error("فشل تحميل الأصناف");
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [movementType]);

  // Fetch stock when package picker opens
  useEffect(() => {
    if (!packagePickerProduct) return;
    setPackagePickerStock(null);
    api
      .get("/stock/quantity-all", {
        params: { product_id: packagePickerProduct.id, branch_id: 1 },
      })
      .then((res) => setPackagePickerStock(res.data || {}))
      .catch(() => setPackagePickerStock({}));
  }, [packagePickerProduct]);

  /* =========================================================
     5.5 Barcode Scan
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

      // لو الباركود جاي من كود فرعي → نضيف بالعبوة والسعر بتاعه مباشرة
      if (product.is_variant) {
        finalizeAddItem(
          { ...product, price: product.price },
          product.retail_package || "-",
          "barcode",
        );
        return;
      }

      // لو عنده أكواد فرعية → نعرض اختيار العبوة
      const variants = variantsMap[product.id];
      if (variants && variants.length > 0) {
        setPackagePickerProduct(product);
        setPackagePickerSource("barcode");
        return;
      }

      const pkg = product.retail_package || "-";
      const qtyPart = pkg.split(" ")[0] || "";

      if (qtyPart.includes(",")) {
        // Multiple package options — show picker
        setPackagePickerProduct(product);
        setPackagePickerSource("barcode");
      } else {
        // Single package — add directly
        finalizeAddItem(product, pkg, "barcode");
      }
    } catch {
      toast.error("الصنف غير موجود");
    } finally {
      setBarcode("");
    }
  };

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

    // Set discount preference from customer record
    if (
      customer.apply_items_discount !== undefined &&
      customer.apply_items_discount !== null
    ) {
      setApplyItemsDiscount(customer.apply_items_discount);
    }
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
        params: { invoice_type: "retail" },
      });

      setPreviousBalance(String(res.data.balance || 0));
    } catch {
      setPreviousBalance("0");
    }
  };

  /* =========================================================
     9️⃣ Add Item To Invoice
     ========================================================= */

  const finalizeAddItem = (
    product: any,
    chosenPackage: string,
    source: "barcode" | "manual",
  ) => {
    setItems((prev) => {
      const exists = prev.find(
        (i) => i.product_id === product.id && i.package === chosenPackage,
      );
      if (exists) {
        if (source === "barcode") {
          return prev.map((i) =>
            i.product_id === product.id && i.package === chosenPackage
              ? { ...i, quantity: (Number(i.quantity) || 0) + 1 }
              : i,
          );
        }
        toast.warning("الصنف مضاف بالفعل");
        return prev;
      }

      const vid = product.variant_id || 0;
      return [
        ...prev,
        {
          uid: `${product.id}_${vid}`,
          product_id: product.id,
          product_name: product.name,
          manufacturer: product.manufacturer || "-",
          package: chosenPackage,
          price: product.price,
          quantity: 1,
          discount: product.discount_amount || 0,
          variant_id: vid,
        },
      ];
    });

    if (source === "barcode") {
      toast.success(`تم إضافة: ${product.name}`);
      new Audio("/sounds/beep-7.mp3").play().catch(() => {});
      setTimeout(() => barcodeRef.current?.focus(), 100);
    } else {
      setLastAddedId(`${product.id}_${product.variant_id || 0}`);
      setShowProductModal(false);
    }
  };

  const addItem = useCallback(
    (product: any) => {
      // لو الصنف عنده أكواد فرعية → نعرض اختيار العبوة
      const variants = variantsMap[product.id];
      if (variants && variants.length > 0) {
        setPackagePickerProduct(product);
        setPackagePickerSource("manual");
        return;
      }

      const pkg = product.retail_package || "-";
      const qtyPart = pkg.split(" ")[0] || "";

      if (qtyPart.includes(",")) {
        setPackagePickerProduct(product);
        setPackagePickerSource("manual");
        return;
      }

      finalizeAddItem(product, pkg, "manual");
    },
    [variantsMap],
  );

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
    setItems(items.filter((i) => i.uid !== uid));
  };

  /* =========================================================
     1️⃣1️⃣ Calculations
     ========================================================= */

  const totalBeforeDiscount = useMemo(() => {
    return items.reduce(
      (sum, item) =>
        sum +
        (Number(item.price) * (Number(item.quantity) || 0) -
          (applyItemsDiscount
            ? (Number(item.discount) || 0) * (Number(item.quantity) || 0)
            : 0)),
      0,
    );
  }, [items, applyItemsDiscount]);

  const finalTotal = useMemo(() => {
    const total = totalBeforeDiscount - (Number(extraDiscount) || 0);
    return total < 0 ? 0 : total;
  }, [totalBeforeDiscount, extraDiscount]);

  const totalWithPrevious = finalTotal + Number(previousBalance || 0);

  const remaining = totalWithPrevious - (Number(paidAmount) || 0);

  /* =========================================================
     1️⃣2️⃣ Save Invoice
     ========================================================= */

  const [saving, setSaving] = useState(false);

  const saveInvoice = async () => {
    if (items.length === 0) {
      toast.error("لا يوجد أصناف");
      return;
    }

    setSaving(true);
    try {
      const itemsDiscount = applyItemsDiscount
        ? items.reduce(
            (sum, item) =>
              sum + (Number(item.discount) || 0) * (Number(item.quantity) || 0),
            0,
          )
        : 0;

      const res = await api.post("/invoices/retail", {
        branch_id: 1,
        invoice_type: "retail",
        movement_type: movementType,
        invoice_date: invoiceDate,
        customer_id: customerId,
        customer_name: customerName || "نقدي",
        customer_phone: customerPhone || null,
        total_before_discount: totalBeforeDiscount,
        items_discount: itemsDiscount,
        extra_discount: Number(extraDiscount) || 0,
        final_total: finalTotal,
        items,
        paid_amount: Number(paidAmount) || 0,
        previous_balance: Number(previousBalance) || 0,
        apply_items_discount: applyItemsDiscount,
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
      setApplyItemsDiscount(true);
      setPaidAmount("0");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "فشل الحفظ");
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
        <h1 className="text-2xl font-bold text-center">إنشاء فاتورة قطاعي</h1>

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
                placeholder="نقدي"
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

        {/* ===== Barcode Scanner ===== */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <label className="text-sm whitespace-nowrap font-medium">
              باركود
            </label>
            <Input
              ref={barcodeRef}
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
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={startCamera}
              title="سكان بالكاميرا"
              className="md:hidden"
            >
              <Camera className="h-5 w-5" />
            </Button>
          </div>

          {/* Camera Scanner */}
          {showCameraScanner && (
            <div className="mt-3 relative rounded-lg overflow-hidden border">
              <video
                ref={videoRef}
                className="w-full h-52 object-cover bg-black"
                playsInline
                muted
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-3/4 h-16 border-2 border-green-400 rounded-lg" />
              </div>
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-2 left-2 h-8 w-8"
                onClick={stopCamera}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
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
                      </td>
                      <td className="p-3 text-center">
                        <span className="font-medium">
                          {item.discount || 0}
                        </span>
                      </td>
                      <td className="p-3 text-center font-semibold">
                        {Number(item.price) * (Number(item.quantity) || 0) -
                          (applyItemsDiscount
                            ? (Number(item.discount) || 0) *
                              (Number(item.quantity) || 0)
                            : 0)}
                      </td>
                      <td className="p-3 text-center">
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
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground text-sm">
                إجمالي الأصناف
              </span>
              <span className="text-xl font-semibold">
                {totalBeforeDiscount} ج.م
              </span>
            </div>

            {/* خصم إضافي */}
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm text-muted-foreground whitespace-nowrap">
                خصم إضافي
              </label>
              <Input
                data-field="extra-discount"
                type="number"
                className="text-center max-w-[160px]"
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
            </div>

            {/* حساب سابق */}
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm text-muted-foreground whitespace-nowrap">
                حساب سابق
              </label>
              <Input
                data-field="previous-balance"
                type="number"
                className="text-center max-w-[160px]"
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
            </div>

            {/* الإجمالي النهائي */}
            <div className="flex items-center justify-between py-2 border-b">
              <span className="font-bold text-green-600 text-sm">
                الإجمالي النهائي
              </span>
              <span className="text-xl font-bold text-green-600">
                {totalWithPrevious} ج.م
              </span>
            </div>

            {/* المدفوع */}
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm text-muted-foreground whitespace-nowrap">
                المدفوع
              </label>
              <Input
                data-field="paid-amount"
                type="number"
                className="text-center max-w-[160px]"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
              />
            </div>

            {/* المتبقي */}
            <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <span className="font-bold text-destructive text-sm">
                المتبقي
              </span>
              <span className="text-2xl font-bold text-destructive">
                {remaining} ج.م
              </span>
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

        {/* ===== مودل اختيار العبوة ===== */}
        <Dialog
          open={!!packagePickerProduct}
          onOpenChange={(open) => {
            if (!open) {
              setPackagePickerProduct(null);
              setPackagePickerStock(null);
            }
          }}
        >
          <DialogContent dir="rtl" className="max-w-sm">
            <DialogHeader>
              <DialogTitle>اختار العبوة</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              {packagePickerProduct?.name}
            </p>
            <div className="flex flex-col gap-2 mt-2">
              {/* العبوة الأساسية (comma-separated أو عادية) */}
              {packagePickerProduct &&
                (() => {
                  const pkg = (
                    packagePickerProduct.retail_package || ""
                  ).trim();
                  const spaceIdx = pkg.indexOf(" ");
                  const qtyPart =
                    spaceIdx > -1 ? pkg.substring(0, spaceIdx) : pkg;
                  const type =
                    spaceIdx > -1 ? pkg.substring(spaceIdx + 1).trim() : "";
                  const qtys = qtyPart.split(",").filter(Boolean);
                  return qtys.map((q: string) => (
                    <Button
                      key={q}
                      variant="outline"
                      className="w-full text-base py-6"
                      onClick={() => {
                        finalizeAddItem(
                          packagePickerProduct,
                          type ? `${q.trim()} ${type}` : q.trim(),
                          packagePickerSource,
                        );
                        setPackagePickerProduct(null);
                      }}
                    >
                      {q.trim()} {type}
                      <span className="text-xs text-muted-foreground mr-2">
                        — {packagePickerProduct.price} ج
                      </span>
                      {packagePickerStock !== null && (
                        <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-semibold mr-2">
                          الرصيد: {packagePickerStock[0] ?? 0}
                        </span>
                      )}
                    </Button>
                  ));
                })()}

              {/* العبوات الفرعية (variants) */}
              {packagePickerProduct &&
                variantsMap[packagePickerProduct.id]?.map((v: any) => (
                  <Button
                    key={v.id}
                    variant="outline"
                    className="w-full text-base py-6"
                    onClick={() => {
                      finalizeAddItem(
                        {
                          ...packagePickerProduct,
                          price:
                            movementType === "sale"
                              ? Number(v.retail_price)
                              : Number(v.retail_purchase_price),
                          variant_id: v.id,
                        },
                        v.retail_package || "-",
                        packagePickerSource,
                      );
                      setPackagePickerProduct(null);
                    }}
                  >
                    {v.retail_package || "-"}
                    <span className="text-xs text-muted-foreground mr-2">
                      —{" "}
                      {movementType === "sale"
                        ? v.retail_price
                        : v.retail_purchase_price}{" "}
                      ج{v.label && ` (${v.label})`}
                    </span>
                    {packagePickerStock !== null && (
                      <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-semibold mr-2">
                        الرصيد: {packagePickerStock[v.id] ?? 0}
                      </span>
                    )}
                  </Button>
                ))}
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
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{product.name}</div>
                      {variantsMap[product.id]?.length > 0 && (
                        <span className="text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full">
                          {variantsMap[product.id].length + 1} عبوات
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                      <span>المصنع: {product.manufacturer || "-"}</span>
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
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
