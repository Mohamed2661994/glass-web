"use client";

import { Suspense, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import api from "@/services/api";
import { useSearchParams } from "next/navigation";

export default function CashOutPageWrapper() {
  return (
    <Suspense>
      <CashOutPage />
    </Suspense>
  );
}

function CashOutPage() {
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const isEdit = !!editId;

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [entryType, setEntryType] = useState<"expense" | "purchase">("expense");
  const [date, setDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [loading, setLoading] = useState(false);
  const [permissionNumber, setPermissionNumber] = useState<string | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);

  /* load edit data */
  useEffect(() => {
    if (!editId) return;
    (async () => {
      try {
        const { data } = await api.get(`/cash/out/${editId}`);
        setName(data.name);
        setAmount(String(data.amount));
        setNotes(data.notes || "");
        setEntryType(data.entry_type || "expense");
        setPermissionNumber(data.permission_number);
        if (data.transaction_date) {
          setDate(data.transaction_date.substring(0, 10));
        }
      } catch {
        toast.error("فشل تحميل بيانات المنصرف");
      }
    })();
  }, [editId]);

  const handleSave = async () => {
    if (!name.trim() || !amount) {
      toast.error("من فضلك أدخل الاسم والمبلغ");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name,
        amount: Number(amount),
        notes,
        date,
        entry_type: entryType,
      };

      const { data } = isEdit
        ? await api.put(`/cash/out/${editId}`, payload)
        : await api.post("/cash/out", payload);

      setPermissionNumber(data.permission_number);
      setSuccessOpen(true);

      if (!isEdit) {
        setName("");
        setAmount("");
        setNotes("");
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

      <Card>
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

          {/* الاسم */}
          <div>
            <Label>الاسم</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: كهرباء – مصروفات"
              className="mt-2"
            />
          </div>

          {/* نوع القيد */}
          <div>
            <Label>نوع القيد</Label>
            <RadioGroup
              value={entryType}
              onValueChange={(v) => setEntryType(v as "expense" | "purchase")}
              className="flex gap-4 mt-3"
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
          <div>
            <Label>المبلغ</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) =>
                setAmount(e.target.value.replace(/[^0-9.]/g, ""))
              }
              placeholder="0.00"
              className="mt-2"
            />
          </div>

          {/* ملاحظات */}
          <div>
            <Label>ملاحظات (اختياري)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي تفاصيل إضافية"
              className="mt-2 min-h-[80px]"
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
    </div>
  );
}
