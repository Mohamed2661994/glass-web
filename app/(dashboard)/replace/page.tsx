"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import api from "@/services/api";
import { highlightText } from "@/lib/highlight-text";
import { multiWordMatch } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";
import { useRealtime } from "@/hooks/use-realtime";
import { Skeleton } from "@/components/ui/skeleton";

interface Product {
  id: number;
  name: string;
  manufacturer?: string;
  wholesale_package?: string;
}

/* ========== Product Dropdown (outside component to avoid re-mount) ========== */
function ProductDropdown({
  refEl,
  search,
  setSearch,
  showDropdown,
  setShowDropdown,
  selectedName,
  onSelect,
  placeholder,
  products,
}: {
  refEl: React.RefObject<HTMLDivElement | null>;
  search: string;
  setSearch: (v: string) => void;
  showDropdown: boolean;
  setShowDropdown: (v: boolean) => void;
  selectedName: string;
  onSelect: (p: Product) => void;
  placeholder: string;
  products: Product[];
}) {
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = products.filter((p) =>
    multiWordMatch(search, String(p.id), p.name, p.manufacturer),
  );

  // Reset focused index when filtered list changes
  useEffect(() => {
    setFocusedIndex(-1);
  }, [search]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!showDropdown || filtered.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(focusedIndex + 1, filtered.length - 1);
        setFocusedIndex(next);
        const el = listRef.current?.querySelector(
          `[data-index='${next}']`,
        ) as HTMLElement;
        el?.scrollIntoView({ block: "nearest" });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = Math.max(focusedIndex - 1, 0);
        setFocusedIndex(prev);
        const el = listRef.current?.querySelector(
          `[data-index='${prev}']`,
        ) as HTMLElement;
        el?.scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter" && focusedIndex >= 0) {
        e.preventDefault();
        onSelect(filtered[focusedIndex]);
      } else if (e.key === "Escape") {
        setShowDropdown(false);
        setFocusedIndex(-1);
      }
    },
    [showDropdown, filtered, focusedIndex, onSelect, setShowDropdown],
  );

  return (
    <div ref={refEl} className="relative">
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={showDropdown ? search : selectedName || ""}
          onChange={(e) => {
            setSearch(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          onKeyDown={handleKeyDown}
          className="pr-9"
        />
      </div>

      {showDropdown && (
        <div
          ref={listRef}
          className="absolute top-full mt-1 left-0 right-0 z-50 bg-popover border rounded-lg shadow-lg max-h-60 overflow-y-auto"
        >
          {filtered.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground text-center">
              لا توجد نتائج
            </div>
          ) : (
            filtered.map((p, index) => (
              <button
                key={p.id}
                data-index={index}
                className={`w-full text-right px-3 py-2 transition-colors border-b last:border-b-0 ${
                  focusedIndex === index
                    ? "bg-muted"
                    : "hover:bg-muted"
                }`}
                onClick={() => onSelect(p)}
              >
                <div className="font-medium text-sm">
                  {highlightText(p.name, search)}
                </div>
                {(p.manufacturer || p.wholesale_package) && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {highlightText(p.manufacturer, search)}
                    {p.manufacturer && p.wholesale_package ? " | " : ""}
                    {p.wholesale_package}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function ReplacePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Out (الصنف المكسور)
  const [outProductId, setOutProductId] = useState<number | null>(null);
  const [outProductName, setOutProductName] = useState("");
  const [outSearch, setOutSearch] = useState("");
  const [outQty, setOutQty] = useState("");
  const [outLiveQty, setOutLiveQty] = useState<number | null>(null);
  const [showOutDropdown, setShowOutDropdown] = useState(false);
  const outRef = useRef<HTMLDivElement>(null);

  // In (الصنف البديل)
  const [inProductId, setInProductId] = useState<number | null>(null);
  const [inProductName, setInProductName] = useState("");
  const [inSearch, setInSearch] = useState("");
  const [inQty, setInQty] = useState("");
  const [inLiveQty, setInLiveQty] = useState<number | null>(null);
  const [showInDropdown, setShowInDropdown] = useState(false);
  const inRef = useRef<HTMLDivElement>(null);

  // Note & confirm
  const [note, setNote] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  /* ========== Load Products ========== */
  const loadProducts = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/products/for-replace", {
        params: { branch_id: 2 },
      });
      setProducts(Array.isArray(data) ? data : []);
    } catch {
      toast.error("فشل تحميل الأصناف");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  useRealtime(["data:products", "data:stock"], loadProducts);

  /* ========== Live Quantity ========== */
  const fetchLiveQty = async (
    productId: number,
    setter: (v: number | null) => void,
  ) => {
    try {
      const { data } = await api.get("/stock/quantity", {
        params: { product_id: productId, branch_id: 2 },
      });
      setter(data.quantity);
    } catch {
      setter(null);
    }
  };

  /* ========== Select Product ========== */
  const selectOutProduct = (p: Product) => {
    setOutProductId(p.id);
    setOutProductName(p.name);
    setOutSearch("");
    setShowOutDropdown(false);
    fetchLiveQty(p.id, setOutLiveQty);
  };

  const selectInProduct = (p: Product) => {
    setInProductId(p.id);
    setInProductName(p.name);
    setInSearch("");
    setShowInDropdown(false);
    fetchLiveQty(p.id, setInLiveQty);
  };

  /* ========== Close dropdowns on outside click ========== */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (outRef.current && !outRef.current.contains(e.target as Node))
        setShowOutDropdown(false);
      if (inRef.current && !inRef.current.contains(e.target as Node))
        setShowInDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ========== Validation & Submit ========== */
  const validate = () => {
    if (!outProductId || !inProductId) {
      toast.error("من فضلك اختر الصنفين");
      return false;
    }
    if (!outQty || !inQty) {
      toast.error("من فضلك أدخل الكميات");
      return false;
    }
    if (Number(outQty) <= 0 || Number(inQty) <= 0) {
      toast.error("الكمية يجب أن تكون أكبر من صفر");
      return false;
    }
    if (outLiveQty !== null && Number(outQty) > outLiveQty) {
      toast.error(`الكمية أكبر من الرصيد (${outLiveQty})`);
      return false;
    }
    return true;
  };

  const handleReplace = async () => {
    try {
      setSubmitting(true);
      const { data } = await api.post("/stock/replace", {
        branch_id: 2,
        out_product_id: outProductId,
        out_quantity: Number(outQty),
        in_product_id: inProductId,
        in_quantity: Number(inQty),
        note,
      });

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      toast.success("تم الاستبدال بنجاح");
      await loadProducts();

      // Reset
      setOutProductId(null);
      setOutProductName("");
      setOutQty("");
      setOutLiveQty(null);
      setInProductId(null);
      setInProductName("");
      setInQty("");
      setInLiveQty(null);
      setNote("");
    } catch {
      toast.error("فشل الاتصال بالسيرفر");
    } finally {
      setSubmitting(false);
    }
  };

  /* ========== Render ========== */
  if (loading) {
    return (
      <div dir="rtl" className="max-w-xl mx-auto space-y-4 py-6 px-4">
        <Skeleton className="h-8 w-40 mx-auto mb-6" />
        <Card>
          <CardContent className="p-5 space-y-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 space-y-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
        <Skeleton className="h-10 w-full rounded-md" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="max-w-xl mx-auto space-y-4 py-6 px-4">
      <h1 className="text-2xl font-bold text-center mb-6">استبدال مصنع</h1>

      {/* ===== الصنف المكسور ===== */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <Label className="text-base font-semibold">الصنف المكسور</Label>

          <ProductDropdown
            refEl={outRef}
            search={outSearch}
            setSearch={setOutSearch}
            showDropdown={showOutDropdown}
            setShowDropdown={setShowOutDropdown}
            selectedName={outProductName}
            onSelect={selectOutProduct}
            placeholder="ابحث عن الصنف..."
            products={products}
          />

          {outLiveQty !== null && (
            <p className="text-sm text-muted-foreground">
              الرصيد الحالي:{" "}
              <span className="font-bold text-foreground">{outLiveQty}</span>
            </p>
          )}

          <Input
            type="number"
            placeholder="الكمية"
            value={outQty}
            onChange={(e) => setOutQty(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* ===== الصنف البديل ===== */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <Label className="text-base font-semibold">الصنف البديل</Label>

          <ProductDropdown
            refEl={inRef}
            search={inSearch}
            setSearch={setInSearch}
            showDropdown={showInDropdown}
            setShowDropdown={setShowInDropdown}
            selectedName={inProductName}
            onSelect={selectInProduct}
            placeholder="ابحث عن الصنف..."
            products={products}
          />

          {inLiveQty !== null && (
            <p className="text-sm text-muted-foreground">
              الرصيد الحالي:{" "}
              <span className="font-bold text-foreground">{inLiveQty}</span>
            </p>
          )}

          <Input
            type="number"
            placeholder="الكمية"
            value={inQty}
            onChange={(e) => setInQty(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* ===== ملاحظة ===== */}
      <Card>
        <CardContent className="p-5 space-y-3">
          <Label className="text-base font-semibold">ملاحظة</Label>
          <Textarea
            placeholder="ملاحظة (اختياري)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
          />
        </CardContent>
      </Card>

      {/* ===== زر التنفيذ ===== */}
      <Button
        className="w-full text-base py-6"
        onClick={() => {
          if (validate()) setShowConfirm(true);
        }}
        disabled={submitting}
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin ml-2" />
            جاري التنفيذ...
          </>
        ) : (
          "تنفيذ الاستبدال"
        )}
      </Button>

      {/* ===== مودال التأكيد ===== */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>تأكيد الاستبدال</DialogTitle>
          </DialogHeader>
          <p className="text-center text-sm text-muted-foreground leading-7 py-2">
            هل أنت متأكد من استبدال{" "}
            <span className="font-bold text-foreground">{outProductName}</span>{" "}
            بكمية <span className="font-bold text-foreground">{outQty}</span>{" "}
            بالصنف{" "}
            <span className="font-bold text-foreground">{inProductName}</span>{" "}
            بكمية <span className="font-bold text-foreground">{inQty}</span>؟
          </p>
          <div className="flex gap-3">
            <Button
              className="flex-1"
              onClick={() => {
                setShowConfirm(false);
                handleReplace();
              }}
            >
              تأكيد
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowConfirm(false)}
            >
              إلغاء
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
