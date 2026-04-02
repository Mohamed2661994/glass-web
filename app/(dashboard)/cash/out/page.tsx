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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/context/auth-context";
import { hasPermission } from "@/lib/permissions";

type CashOutEntryType = "expense" | "purchase" | "supplier_payment";

function normalizeCacheText(value: string) {
  return normalizeArabic(noSpaces(value).toLowerCase());
}

export default function CashOutPageWrapper() {
  return (
    <Suspense>
      <CashOutPage />
    </Suspense>
  );
}

function CashOutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, authReady } = useAuth();
  const editId = searchParams.get("edit");
  const isEdit = !!editId;
  const canEditCashOut = authReady && hasPermission(user, "cash_out_edit");
  const canDeleteCashOut = authReady && hasPermission(user, "cash_out_delete");

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [entryType, setEntryType] = useState<CashOutEntryType>("expense");
  const [cashOutNameHistory, setCashOutNameHistory] = useState<
    { name: string; entryType: CashOutEntryType }[]
  >([]);
  const [showNameDropdown, setShowNameDropdown] = useState(false);

  /* ========== Field Refs for Enter Navigation ========== */
  const nameRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);

  /* ========== Supplier Autocomplete State ========== */
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [supplierResults, setSupplierResults] = useState<
    { id: number; name: string }[]
  >([]);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [supplierSearching, setSupplierSearching] = useState(false);
  const [supplierBalance, setSupplierBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [date, setDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [loading, setLoading] = useState(false);
  const [permissionNumber, setPermissionNumber] = useState<string | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);

  /* ========== Transactions Modal State ========== */
  interface CashOutItem {
    id: number;
    name: string;
    amount: number;
    notes: string | null;
    transaction_date: string;
    permission_number: string;
    entry_type: CashOutEntryType;
    supplier_id?: number;
    supplier_name?: string;
  }
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<CashOutItem[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalSearch, setModalSearch] = useState("");
  const [deleteItem, setDeleteItem] = useState<CashOutItem | null>(null);

  const filteredNameSuggestions = useMemo(() => {
    if (entryType === "supplier_payment") {
      return [] as string[];
    }

    const normalizedValue = normalizeCacheText(name);
    if (!normalizedValue) {
      return [] as string[];
    }

    const seenNames = new Set<string>();

    return cashOutNameHistory
      .filter((item) => item.entryType === entryType)
      .map((item) => item.name.trim())
      .filter(Boolean)
      .filter((itemName) => normalizeCacheText(itemName).includes(normalizedValue))
      .filter((itemName) => {
        const key = normalizeCacheText(itemName);
        if (seenNames.has(key)) {
          return false;
        }
        seenNames.add(key);
        return true;
      })
      .slice(0, 8);
  }, [cashOutNameHistory, entryType, name]);

  const openModal = useCallback(async () => {
    setModalOpen(true);
    setModalLoading(true);
    try {
      const { data } = await api.get("/cash/out");
      setModalData(data.data || data || []);
    } catch {
      toast.error("فشل تحميل الحركات");
    } finally {
      setModalLoading(false);
    }
  }, []);

  const filteredModal = useMemo(() => {
    if (!modalSearch.trim()) return modalData;
    const q = normalizeArabic(noSpaces(modalSearch).toLowerCase());
    return modalData.filter(
      (item) =>
        normalizeArabic(noSpaces(item.name).toLowerCase()).includes(q) ||
        item.permission_number?.toLowerCase().includes(q) ||
        (item.notes &&
          normalizeArabic(noSpaces(item.notes).toLowerCase()).includes(q)),
    );
  }, [modalData, modalSearch]);

  const handleModalDelete = async () => {
    if (!deleteItem) return;
    try {
      await api.delete(`/cash/out/${deleteItem.id}`);
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

  /* ========== Supplier Search ========== */
  const fetchSupplierBalance = useCallback(async (supplierName: string) => {
    try {
      setBalanceLoading(true);
      const res = await api.get("/reports/supplier-balances", {
        params: { supplier_name: supplierName },
      });
      const rows: any[] = Array.isArray(res.data) ? res.data : [];
      if (rows.length > 0) {
        setSupplierBalance(Number(rows[0].balance_due) || 0);
      } else {
        setSupplierBalance(0);
      }
    } catch {
      setSupplierBalance(null);
    } finally {
      setBalanceLoading(false);
    }
  }, []);

  useEffect(() => {
    if (entryType !== "supplier_payment" || !supplierSearch.trim()) {
      setSupplierResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSupplierSearching(true);
        const { data } = await api.get("/suppliers/search", {
          params: { name: supplierSearch },
        });
        setSupplierResults(data || []);
        setShowSupplierDropdown(true);
      } catch {
        // ignore
      } finally {
        setSupplierSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [supplierSearch, entryType]);

  useEffect(() => {
    if (isEdit) {
      return;
    }

    (async () => {
      try {
        const { data } = await api.get("/cash/out");
        const items: CashOutItem[] = data.data || data || [];
        setCashOutNameHistory(
          items
            .filter((item) => item.entry_type !== "supplier_payment")
            .sort((a, b) => b.id - a.id)
            .map((item) => ({
              name: item.name,
              entryType: item.entry_type,
            })),
        );
      } catch {
        // ignore
      }
    })();
  }, [isEdit]);

  /* load edit data */
  useEffect(() => {
    if (!user || !authReady) return;

    if (isEdit && !canEditCashOut) {
      toast.error("ليس لديك صلاحية تعديل المنصرف");
      router.replace("/cash/out");
      return;
    }

    if (!editId) return;

    (async () => {
      try {
        const { data } = await api.get(`/cash/out/${editId}`);
        setName(data.name);
        setAmount(String(data.amount));
        setNotes(data.notes || "");
        setEntryType(data.entry_type || "expense");
        setPermissionNumber(data.permission_number);
        if (data.supplier_id) {
          setSupplierId(data.supplier_id);
          setSupplierSearch(data.supplier_name || data.name);
          fetchSupplierBalance(data.supplier_name || data.name);
        }
        if (data.transaction_date) {
          setDate(data.transaction_date.substring(0, 10));
        }
      } catch {
        toast.error("فشل تحميل بيانات المنصرف");
      }
    })();
  }, [
    authReady,
    canEditCashOut,
    editId,
    fetchSupplierBalance,
    isEdit,
    router,
    user,
  ]);

  const handleSave = async () => {
    if (entryType === "supplier_payment") {
      if (!supplierId) {
        toast.error("من فضلك اختر المورد");
        return;
      }
      if (!amount) {
        toast.error("من فضلك أدخل المبلغ");
        return;
      }
    } else if (!name.trim() || !amount) {
      toast.error("من فضلك أدخل الاسم والمبلغ");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: entryType === "supplier_payment" ? supplierSearch : name,
        amount: Number(amount),
        notes,
        date,
        entry_type: entryType,
        supplier_id: entryType === "supplier_payment" ? supplierId : null,
      };

      const { data } = isEdit
        ? await api.put(`/cash/out/${editId}`, payload)
        : await api.post("/cash/out", payload);

      setPermissionNumber(data.permission_number);
      setSuccessOpen(true);

      if (entryType !== "supplier_payment") {
        setCashOutNameHistory((prev) => [
          { name, entryType },
          ...prev.filter(
            (item) =>
              !(
                item.entryType === entryType &&
                normalizeCacheText(item.name) === normalizeCacheText(name)
              ),
          ),
        ]);
      }

      if (!isEdit) {
        setName("");
        setAmount("");
        setNotes("");
        setSupplierId(null);
        setSupplierSearch("");
        setSupplierBalance(null);
        setShowNameDropdown(false);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "فشل حفظ إذن الصرف");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4" dir="rtl">
      <h1 className="text-xl font-bold text-center mb-1">
        {isEdit ? "تعديل المنصرف" : "صرف نقدي"}
      </h1>
      <p className="text-sm text-muted-foreground text-center mb-6">
        تسجيل حركة منصرف على الخزنة
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
          {/* رقم الإذن */}
          <div>
            <Label>رقم الإذن</Label>
            <Input
              value={
                isEdit && permissionNumber
                  ? permissionNumber
                  : "— سيتم توليده تلقائيًا —"
              }
              disabled
              className="mt-2"
            />
          </div>

          {/* الاسم / اسم المورد */}
          <div className="relative">
            <Label>
              {entryType === "supplier_payment" ? "اسم المورد" : "الاسم"}
            </Label>
            {entryType === "supplier_payment" ? (
              <>
                <div className="relative mt-2">
                  <Input
                    value={supplierSearch}
                    onChange={(e) => {
                      setSupplierSearch(e.target.value);
                      setSupplierId(null);
                      setSupplierBalance(null);
                      setShowSupplierDropdown(true);
                    }}
                    onFocus={() =>
                      supplierResults.length > 0 &&
                      setShowSupplierDropdown(true)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        amountRef.current?.focus();
                      }
                    }}
                    placeholder="ابحث عن المورد..."
                    className={supplierId ? "border-green-500 pr-8" : ""}
                  />
                  {supplierSearching && (
                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                      <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  {supplierId && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 text-green-500 text-xs">
                      ✓
                    </div>
                  )}
                </div>
                {showSupplierDropdown &&
                  supplierResults.length > 0 &&
                  !supplierId && (
                    <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
                      {supplierResults.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          className="w-full text-right px-3 py-2 hover:bg-muted text-sm transition-colors"
                          onClick={() => {
                            setSupplierId(s.id);
                            setSupplierSearch(s.name);
                            setShowSupplierDropdown(false);
                            fetchSupplierBalance(s.name);
                          }}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  )}
              </>
            ) : (
              <>
                <Input
                  ref={nameRef}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setShowNameDropdown(true);
                  }}
                  onFocus={() =>
                    filteredNameSuggestions.length > 0 &&
                    setShowNameDropdown(true)
                  }
                  placeholder="مثال: كهرباء – مصروفات"
                  className="mt-2"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      amountRef.current?.focus();
                    }
                  }}
                />
                {showNameDropdown && filteredNameSuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {filteredNameSuggestions.map((itemName) => (
                      <button
                        key={`${entryType}:${itemName}`}
                        type="button"
                        className="w-full text-right px-3 py-2 hover:bg-muted text-sm transition-colors"
                        onClick={() => {
                          setName(itemName);
                          setShowNameDropdown(false);
                          amountRef.current?.focus();
                        }}
                      >
                        {itemName}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* نوع القيد */}
          <div>
            <Label>نوع القيد</Label>
            <RadioGroup
              value={entryType}
              onValueChange={(v) => {
                setEntryType(v as CashOutEntryType);
                setShowNameDropdown(false);
                if (v !== "supplier_payment") {
                  setSupplierId(null);
                  setSupplierSearch("");
                  setSupplierBalance(null);
                }
              }}
              className="flex flex-wrap gap-4 mt-3"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="expense" id="expense" />
                <Label htmlFor="expense" className="cursor-pointer">
                  مصروفات
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="purchase" id="purchase" />
                <Label htmlFor="purchase" className="cursor-pointer">
                  مشتريات
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem
                  value="supplier_payment"
                  id="supplier_payment"
                />
                <Label htmlFor="supplier_payment" className="cursor-pointer">
                  دفعة مورد
                </Label>
              </div>
            </RadioGroup>
          </div>

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

          {/* المبلغ */}
          {entryType === "supplier_payment" && balanceLoading && (
            <p className="text-xs text-muted-foreground text-center">
              جاري تحميل حساب المورد...
            </p>
          )}
          {entryType === "supplier_payment" &&
            supplierBalance !== null &&
            supplierId && (
              <Card className="border-dashed bg-muted/30">
                <CardContent className="p-3 space-y-1.5 text-sm text-center">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">حساب المورد</span>
                    <span
                      className={`font-bold ${
                        supplierBalance > 0
                          ? "text-red-500"
                          : supplierBalance < 0
                            ? "text-green-600"
                            : ""
                      }`}
                    >
                      {supplierBalance.toLocaleString()} ج.م
                    </span>
                  </div>
                  {Number(amount) > 0 && supplierBalance > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        المتبقي بعد الدفع
                      </span>
                      <span
                        className={`font-black text-lg ${
                          supplierBalance - Number(amount) > 0
                            ? "text-red-500"
                            : "text-green-600"
                        }`}
                      >
                        {(supplierBalance - Number(amount)).toLocaleString()}{" "}
                        ج.م
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          {entryType === "supplier_payment" &&
            supplierBalance !== null &&
            supplierBalance === 0 &&
            supplierId && (
              <p className="text-xs text-green-600 text-center font-medium">
                ✓ لا يوجد رصيد مستحق على هذا المورد
              </p>
            )}
          <div>
            <Label>المبلغ</Label>
            <Input
              ref={amountRef}
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) =>
                setAmount(e.target.value.replace(/[^0-9.]/g, ""))
              }
              placeholder="0.00"
              className="mt-2"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  notesRef.current?.focus();
                }
              }}
            />
          </div>

          {/* ملاحظات */}
          <div>
            <Label>ملاحظات (اختياري)</Label>
            <Textarea
              ref={notesRef}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي تفاصيل إضافية"
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
            className="w-full"
            variant={isEdit ? "default" : "destructive"}
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? "جارٍ الحفظ..." : isEdit ? "حفظ التعديل" : "حفظ المنصرف"}
          </Button>
        </CardContent>
      </Card>

      {/* Success Dialog */}
      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-green-600 text-center">
              ✅ تم الحفظ
            </DialogTitle>
          </DialogHeader>
          <p className="text-center text-sm">تم حفظ إذن الصرف بنجاح</p>
          {permissionNumber && (
            <p className="text-center font-semibold text-blue-500">
              رقم الإذن: {permissionNumber}
            </p>
          )}
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
            <DialogTitle>جميع حركات المنصرف</DialogTitle>
          </DialogHeader>

          <Input
            placeholder="🔍 بحث بالاسم أو رقم الإذن..."
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
                    <TableHead className="text-right">رقم الإذن</TableHead>
                    <TableHead className="text-right">الاسم</TableHead>
                    <TableHead className="text-right">النوع</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">ملاحظات</TableHead>
                    <TableHead className="text-right">إجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredModal.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">
                        {item.permission_number}
                      </TableCell>
                      <TableCell className="font-semibold">
                        {item.name}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.entry_type === "expense"
                              ? "destructive"
                              : item.entry_type === "supplier_payment"
                                ? "secondary"
                                : "default"
                          }
                        >
                          {item.entry_type === "expense"
                            ? "مصروفات"
                            : item.entry_type === "supplier_payment"
                              ? "دفعة مورد"
                              : "مشتريات"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-red-500 font-bold">
                        {Math.round(item.amount).toLocaleString()} ج
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatDate(item.transaction_date)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                        {item.notes || "—"}
                      </TableCell>
                      <TableCell>
                        {canEditCashOut || canDeleteCashOut ? (
                          <div className="flex gap-1">
                            {canEditCashOut && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => {
                                  setModalOpen(false);
                                  router.push(`/cash/out?edit=${item.id}`);
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5 text-blue-500" />
                              </Button>
                            )}
                            {canDeleteCashOut && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setDeleteItem(item)}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-red-500" />
                              </Button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="text-xs text-muted-foreground text-center pt-2 border-t">
            إجمالي: {filteredModal.length} حركة — المجموع:{" "}
            <span className="text-red-500 font-bold">
              {Math.round(
                filteredModal.reduce((s, i) => s + Number(i.amount), 0),
              ).toLocaleString()}{" "}
              ج
            </span>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل تريد حذف المنصرف &quot;{deleteItem?.name}&quot;؟
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
