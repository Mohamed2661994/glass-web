"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { noSpaces, normalizeArabic } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { List, Pencil, Trash2 } from "lucide-react";
import api from "@/services/api";

const DISCOUNT_DIFF_MARKER = "{{discount_diff}}";

export default function CashInPageWrapper() {
  return (
    <Suspense>
      <CashInPage />
    </Suspense>
  );
}

function CashInPage() {
  const [sourceName, setSourceName] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [entryType, setEntryType] = useState<
    "manual" | "customer_payment" | "discount_diff"
  >("manual");
  const [date, setDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [cashInNumber, setCashInNumber] = useState<number | null>(null);
  const [customerDebt, setCustomerDebt] = useState<number | null>(null);
  const [debtLoading, setDebtLoading] = useState(false);

  /* ========== Transactions Modal State ========== */
  interface CashInItem {
    id: number;
    customer_name: string;
    amount: number;
    paid_amount: number;
    remaining_amount: number;
    notes: string | null;
    description: string | null;
    transaction_date: string;
    cash_in_number: number;
    source_type: string;
  }
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<CashInItem[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalSearch, setModalSearch] = useState("");
  const [deleteItem, setDeleteItem] = useState<CashInItem | null>(null);

  const isDiscountDiff = (notes?: string | null) =>
    (notes || "").includes(DISCOUNT_DIFF_MARKER);

  /** Parse {{total|paid|remaining}} from notes */
  const parseMetadata = (notes?: string | null) => {
    const m = notes?.match(/\{\{(-?[\d.]+)\|(-?[\d.]+)\|(-?[\d.]+)\}\}/);
    if (!m) return null;
    return { total: Number(m[1]), paid: Number(m[2]), remaining: Number(m[3]) };
  };

  const cleanNotes = (notes?: string | null) =>
    notes?.replace(/\{\{[-\d.|]+\}\}/, "").trim() || null;

  const openModal = useCallback(async () => {
    setModalSearch(sourceName.trim());
    setModalOpen(true);
    setModalLoading(true);
    try {
      const { data } = await api.get("/cash-in");
      setModalData(data.data || data || []);
    } catch {
      toast.error("فشل تحميل الحركات");
    } finally {
      setModalLoading(false);
    }
  }, [sourceName]);

  const filteredModal = useMemo(() => {
    const q = normalizeArabic(noSpaces(modalSearch).toLowerCase());
    return modalData.filter((item) => {
      const rawNotes = item.notes || item.description || "";
      if (isDiscountDiff(rawNotes)) return false;
      if (!modalSearch.trim()) return true;
      return (
        normalizeArabic(
          noSpaces(item.customer_name || "").toLowerCase(),
        ).includes(q) ||
        String(item.cash_in_number)?.includes(q) ||
        (rawNotes &&
          normalizeArabic(noSpaces(rawNotes).toLowerCase()).includes(q))
      );
    });
  }, [modalData, modalSearch]);

  const handleModalDelete = async () => {
    if (!deleteItem) return;
    try {
      await api.delete(`/cash-in/${deleteItem.id}`);
      toast.success("تم الحذف");
      setDeleteItem(null);
      setModalData((prev) => prev.filter((i) => i.id !== deleteItem.id));
    } catch {
      toast.error("فشل الحذف");
    }
  };

  const formatDate = (s: string) => {
    const d = s.substring(0, 10).split("-");
    return `${d[2]}/${d[1]}/${d[0]}`;
  };

  /* ========== Customer Autocomplete ========== */
  const [customerSuggestions, setCustomerSuggestions] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);

  const searchCustomers = async (query: string) => {
    if (query.length < 2) {
      setCustomerSuggestions([]);
      setShowDropdown(false);
      return;
    }
    try {
      const res = await api.get("/customers/search", {
        params: { name: query },
      });
      setCustomerSuggestions(res.data || []);
      setShowDropdown((res.data || []).length > 0);
      setHighlightedIdx(-1);
    } catch {}
  };

  const fetchCustomerDebt = async (name: string) => {
    try {
      setDebtLoading(true);
      const res = await api.get("/reports/customer-debt-details", {
        params: { customer_name: name },
      });
      const rows: any[] = Array.isArray(res.data) ? res.data : [];
      if (rows.length === 0) {
        setCustomerDebt(0);
        return;
      }
      // حساب الرصيد الافتتاحي من أول فاتورة
      const firstInvoice = rows.find((r: any) => r.record_type === "invoice");
      let openingBalance = 0;
      if (firstInvoice) {
        const embedded =
          Number(firstInvoice.remaining_amount) -
          (Number(firstInvoice.total) - Number(firstInvoice.paid_amount));
        openingBalance = embedded > 0 ? embedded : 0;
      }
      const totalInvoices = rows
        .filter((r: any) => r.record_type === "invoice")
        .reduce((s: number, r: any) => s + Number(r.total), 0);
      const totalPaid = rows.reduce(
        (s: number, r: any) => s + Number(r.paid_amount),
        0,
      );
      setCustomerDebt(totalInvoices + openingBalance - totalPaid);
    } catch {
      setCustomerDebt(null);
    } finally {
      setDebtLoading(false);
    }
  };

  const selectCustomer = (c: any) => {
    setSourceName(c.name);
    setShowDropdown(false);
    setCustomerSuggestions([]);
    fetchCustomerDebt(c.name);
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const baseDescription =
    description ||
    (entryType === "customer_payment"
      ? "سند دفع"
      : entryType === "discount_diff"
        ? "فرقات خصم"
        : "وارد نقدي");
  const finalDescription =
    entryType === "discount_diff"
      ? `${baseDescription.replace(DISCOUNT_DIFF_MARKER, "").trim()} ${DISCOUNT_DIFF_MARKER}`.trim()
      : baseDescription;

  const handleSave = () => {
    if (!sourceName.trim()) {
      toast.error("برجاء إدخال الاسم");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      toast.error("برجاء إدخال مبلغ صحيح");
      return;
    }
    setConfirmOpen(true);
  };

  const submitCashIn = async () => {
    try {
      setLoading(true);
      const sourceType = entryType === "manual" ? "manual" : "customer_payment";
      const { data } = await api.post("/cash/in", {
        transaction_date: date,
        customer_name: sourceName,
        description: finalDescription,
        amount: Number(amount),
        source_type: sourceType,
      });

      setConfirmOpen(false);
      setCashInNumber(data.cash_in_id);
      setSuccessOpen(true);

      setSourceName("");
      setAmount("");
      setDescription("");
      setCustomerDebt(null);
      setDate(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      });
    } catch (err: any) {
      toast.error(err.response?.data?.error || "فشل تسجيل الوارد");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4" dir="rtl">
      <h1 className="text-xl font-bold text-center mb-1">وارد الخزنة</h1>
      <p className="text-sm text-muted-foreground text-center mb-6">
        تسجيل حركة وارد على الخزنة
      </p>

      {/* زرار عرض الحركات */}
      <Button
        variant="outline"
        className="w-full mb-4 gap-2"
        onClick={openModal}
      >
        <List className="h-4 w-4" />
        عرض جميع الحركات
      </Button>

      <Card className="overflow-hidden">
        <CardContent className="p-6 space-y-5">
          {/* الاسم */}
          <div>
            <Label>
              {entryType === "customer_payment" || entryType === "discount_diff"
                ? "اسم العميل"
                : "الاسم"}
            </Label>
            {entryType === "customer_payment" ||
            entryType === "discount_diff" ? (
              <div className="relative mt-2" ref={dropdownRef}>
                <Input
                  value={sourceName}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSourceName(v);
                    if (timerRef.current) clearTimeout(timerRef.current);
                    timerRef.current = setTimeout(
                      () => searchCustomers(v),
                      300,
                    );
                  }}
                  onKeyDown={(e) => {
                    if (showDropdown && e.key === "ArrowDown") {
                      e.preventDefault();
                      setHighlightedIdx((p) =>
                        p < customerSuggestions.length - 1 ? p + 1 : 0,
                      );
                    } else if (showDropdown && e.key === "ArrowUp") {
                      e.preventDefault();
                      setHighlightedIdx((p) =>
                        p > 0 ? p - 1 : customerSuggestions.length - 1,
                      );
                    } else if (
                      e.key === "Enter" &&
                      showDropdown &&
                      highlightedIdx >= 0
                    ) {
                      e.preventDefault();
                      selectCustomer(customerSuggestions[highlightedIdx]);
                      setTimeout(() => amountRef.current?.focus(), 50);
                    } else if (e.key === "Enter") {
                      e.preventDefault();
                      amountRef.current?.focus();
                    } else if (e.key === "Escape") {
                      setShowDropdown(false);
                    }
                  }}
                  placeholder="ابحث باسم العميل..."
                  className=""
                />
                {showDropdown && customerSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-auto">
                    {customerSuggestions.map((c, i) => (
                      <div
                        key={c.id}
                        className={`px-3 py-2 cursor-pointer text-sm ${
                          i === highlightedIdx
                            ? "bg-blue-100 dark:bg-blue-900"
                            : "hover:bg-muted"
                        }`}
                        onMouseDown={() => selectCustomer(c)}
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
            ) : (
              <Input
                ref={nameRef}
                value={sourceName}
                onChange={(e) => setSourceName(e.target.value)}
                placeholder="اسم القيد"
                className="mt-2"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    amountRef.current?.focus();
                  }
                }}
              />
            )}
          </div>

          {/* نوع القيد */}
          <div>
            <Label>نوع القيد</Label>
            <div className="flex gap-3 mt-3">
              <Button
                type="button"
                variant={entryType === "manual" ? "default" : "outline"}
                className={`flex-1 ${entryType === "manual" ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                onClick={() => {
                  setEntryType("manual");
                  setCustomerDebt(null);
                }}
              >
                وارد عادي
              </Button>
              <Button
                type="button"
                variant={
                  entryType === "customer_payment" ? "default" : "outline"
                }
                className={`flex-1 ${entryType === "customer_payment" ? "bg-green-600 hover:bg-green-700" : ""}`}
                onClick={() => setEntryType("customer_payment")}
              >
                سند دفع عميل
              </Button>
              <Button
                type="button"
                variant={entryType === "discount_diff" ? "default" : "outline"}
                className={`flex-1 ${entryType === "discount_diff" ? "bg-amber-600 hover:bg-amber-700" : ""}`}
                onClick={() => setEntryType("discount_diff")}
              >
                فرقات خصم
              </Button>
            </div>
          </div>

          {/* المبلغ */}
          <div>
            <Label>المبلغ</Label>
            <Input
              ref={amountRef}
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="mt-2 text-center font-semibold"
              onFocus={(e) => e.target.select()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  descriptionRef.current?.focus();
                }
              }}
            />
          </div>

          {/* المديونية والمتبقي */}
          {(entryType === "customer_payment" ||
            entryType === "discount_diff") &&
            customerDebt !== null &&
            customerDebt > 0 && (
              <Card className="border-dashed bg-muted/30">
                <CardContent className="p-3 space-y-1.5 text-sm text-center">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      المديونية الحالية
                    </span>
                    <span className="font-bold text-red-500">
                      {customerDebt.toLocaleString()} ج.م
                    </span>
                  </div>
                  {Number(amount) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        المتبقي بعد الدفع
                      </span>
                      <span
                        className={`font-black text-lg ${customerDebt - Number(amount) > 0 ? "text-red-500" : "text-green-600"}`}
                      >
                        {(customerDebt - Number(amount)).toLocaleString()} ج.م
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          {(entryType === "customer_payment" ||
            entryType === "discount_diff") &&
            debtLoading && (
              <p className="text-xs text-muted-foreground text-center">
                جاري تحميل المديونية...
              </p>
            )}
          {(entryType === "customer_payment" ||
            entryType === "discount_diff") &&
            customerDebt !== null &&
            customerDebt === 0 &&
            sourceName.trim() && (
              <p className="text-xs text-green-600 text-center font-medium">
                ✓ لا توجد مديونية على هذا العميل
              </p>
            )}

          {/* التاريخ */}
          <div>
            <Label>تاريخ العملية</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-2"
            />
          </div>

          {/* البيان */}
          <div>
            <Label>البيان</Label>
            <Textarea
              ref={descriptionRef}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="سبب الوارد"
              className="mt-2 min-h-[80px]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSave();
                }
              }}
            />
          </div>

          {/* حفظ */}
          <Button
            className="w-full bg-green-600 hover:bg-green-700"
            onClick={handleSave}
            disabled={loading}
          >
            حفظ الوارد
          </Button>
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تأكيد الحفظ</DialogTitle>
          </DialogHeader>
          <p className="text-center text-muted-foreground">
            هل أنت متأكد من تسجيل هذا الوارد؟
          </p>
          <DialogFooter className="flex gap-2 sm:justify-center">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={submitCashIn} disabled={loading}>
              {loading ? "جارٍ الحفظ..." : "تأكيد"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-green-600 text-center">
              ✅ تم بنجاح
            </DialogTitle>
          </DialogHeader>
          <p className="text-center text-muted-foreground">
            تم تسجيل القيد برقم ({cashInNumber})
          </p>
          <Button onClick={() => setSuccessOpen(false)} className="w-full">
            تم
          </Button>
        </DialogContent>
      </Dialog>

      {/* Transactions Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent
          dir="rtl"
          className="sm:max-w-5xl max-h-[85vh] overflow-hidden flex flex-col"
        >
          <DialogHeader>
            <DialogTitle>جميع حركات الوارد</DialogTitle>
          </DialogHeader>

          <Input
            placeholder="🔍 بحث بالاسم أو رقم القيد..."
            value={modalSearch}
            onChange={(e) => setModalSearch(e.target.value)}
            className="mb-3"
          />

          <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {modalLoading ? (
              <div className="space-y-3 p-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded" />
                ))}
              </div>
            ) : filteredModal.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                لا يوجد حركات
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">رقم القيد</TableHead>
                    <TableHead className="text-right">الاسم</TableHead>
                    <TableHead className="text-right">النوع</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                    <TableHead className="text-right">المدفوع</TableHead>
                    <TableHead className="text-right">المتبقي</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">ملاحظات</TableHead>
                    <TableHead className="text-right">إجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredModal.map((item) => {
                    const meta = parseMetadata(item.notes || item.description);
                    const displayAmount = meta
                      ? meta.total
                      : Number(item.amount);
                    const displayPaid = meta
                      ? meta.paid
                      : Number(item.paid_amount);
                    const displayRemaining = meta
                      ? meta.remaining
                      : Number(item.remaining_amount);
                    const notes =
                      item.source_type !== "invoice"
                        ? cleanNotes(item.notes || item.description) || "—"
                        : "—";

                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs">
                          {item.cash_in_number}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {item.customer_name}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              item.source_type === "manual"
                                ? "default"
                                : item.source_type === "customer_payment"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {item.source_type === "manual"
                              ? "وارد عادي"
                              : item.source_type === "customer_payment"
                                ? "سند دفع"
                                : "فاتورة"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-bold">
                          {Math.round(displayAmount).toLocaleString()} ج
                        </TableCell>
                        <TableCell className="text-green-600 font-bold">
                          {Math.round(displayPaid).toLocaleString()} ج
                        </TableCell>
                        <TableCell
                          className={`font-bold ${displayRemaining > 0 ? "text-red-500" : displayRemaining < 0 ? "text-blue-500" : "text-muted-foreground"}`}
                        >
                          {Math.round(displayRemaining).toLocaleString()} ج
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatDate(item.transaction_date)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                          {notes}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setDeleteItem(item)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="text-xs text-muted-foreground text-center pt-2 border-t space-y-1">
            <div>
              إجمالي: {filteredModal.length} حركة — المدفوع:{" "}
              <span className="text-green-600 font-bold">
                {Math.round(
                  filteredModal.reduce((s, i) => {
                    const meta = parseMetadata(i.notes || i.description);
                    return (
                      s + (meta ? meta.paid : Number(i.paid_amount || i.amount))
                    );
                  }, 0),
                ).toLocaleString()}{" "}
                ج
              </span>
            </div>
            {(() => {
              const invoices = filteredModal.filter(
                (i) => i.source_type === "invoice",
              );
              if (invoices.length === 0) return null;
              const totalInvoices = invoices.reduce((s, i) => {
                const meta = parseMetadata(i.notes || i.description);
                return s + (meta ? meta.total : Number(i.amount || 0));
              }, 0);
              // المدفوع = فواتير + سندات دفع
              const totalPaid = filteredModal.reduce((s, i) => {
                if (
                  i.source_type === "invoice" ||
                  i.source_type === "customer_payment"
                ) {
                  const meta = parseMetadata(i.notes || i.description);
                  return (
                    s + (meta ? meta.paid : Number(i.paid_amount || i.amount))
                  );
                }
                return s;
              }, 0);
              const remaining = totalInvoices - totalPaid;
              return (
                <div className="text-sm pt-1">
                  <span>
                    إجمالي الفواتير:{" "}
                    <b>{Math.round(totalInvoices).toLocaleString()} ج</b>
                  </span>
                  {" — "}
                  <span>
                    المدفوع:{" "}
                    <b className="text-green-600">
                      {Math.round(totalPaid).toLocaleString()} ج
                    </b>
                  </span>
                  {" — "}
                  <span>
                    المتبقي:{" "}
                    <b
                      className={
                        remaining > 0 ? "text-red-500" : "text-green-600"
                      }
                    >
                      {Math.round(remaining).toLocaleString()} ج
                    </b>
                  </span>
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل تريد حذف قيد الوارد &quot;{deleteItem?.customer_name}&quot;؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleModalDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
