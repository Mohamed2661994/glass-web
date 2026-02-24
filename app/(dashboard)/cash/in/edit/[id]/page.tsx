"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import api from "@/services/api";
import { useParams, useRouter } from "next/navigation";

const sourceLabel = (s: string) => {
  switch (s) {
    case "manual":
      return "وارد عادي";
    case "invoice":
      return "فاتورة";
    case "customer_payment":
      return "سند دفع";
    default:
      return s;
  }
};

export default function EditCashInPage() {
  const { id } = useParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sourceType, setSourceType] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [amount, setAmount] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/cash-in/${id}`);
        const item = res.data.data;

        if (!item) {
          toast.error("لا يمكن تعديل هذا القيد");
          router.back();
          return;
        }

        setSourceType(item.source_type || "manual");
        setSourceName(item.customer_name || "");
        setAmount(String(item.amount || 0));
        setPaidAmount(String(item.paid_amount || 0));
        // Clean metadata from notes
        const rawNotes = item.notes || item.description || "";
        setDescription(rawNotes.replace(/\{\{[-\d.|]+\}\}/, "").trim());
        if (item.transaction_date) {
          setDate(item.transaction_date.substring(0, 10));
        }
      } catch {
        toast.error("فشل تحميل البيانات");
        router.back();
      } finally {
        setLoading(false);
      }
    })();
  }, [id, router]);

  const submitEdit = async () => {
    try {
      setSaving(true);
      if (sourceType === "invoice") {
        // For invoices, only update the date
        await api.put(`/cash-in/${id}`, { transaction_date: date });
      } else {
        const payload: any = {
          customer_name: sourceName,
          description,
          transaction_date: date,
          source_type: sourceType,
        };
        if (sourceType === "manual") {
          payload.amount = Number(amount);
        } else {
          payload.paid_amount = Number(paidAmount);
          payload.amount = Number(amount);
          payload.remaining_amount = Number(amount) - Number(paidAmount);
        }
        // Backend doesn't support PUT → DELETE then re-create
        await api.delete(`/cash-in/${id}`);
        await api.post("/cash/in", payload);
      }
      toast.success("تم حفظ التعديل");
      router.back();
    } catch {
      toast.error("حصل خطأ أثناء الحفظ");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-md mx-auto p-4 space-y-4" dir="rtl">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardContent className="p-5 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4" dir="rtl">
      <h1 className="text-xl font-bold text-center mb-6">
        {sourceType === "invoice" ? "تعديل تاريخ الفاتورة" : "تعديل وارد الخزنة"}
      </h1>

      {sourceType === "invoice" && (
        <p className="text-center text-sm text-muted-foreground mb-4">
          يمكن تعديل التاريخ فقط للفواتير
        </p>
      )}

      <Card>
        <CardContent className="p-5 space-y-4">
          {/* نوع القيد */}
          {sourceType && (
            <div className="flex justify-center">
              <Badge variant="secondary" className="text-sm">
                {sourceLabel(sourceType)}
              </Badge>
            </div>
          )}

          <div>
            <Label>الاسم</Label>
            <Input
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              className="mt-1"
              disabled={sourceType === "invoice"}
            />
          </div>

          {sourceType === "manual" ? (
            <div>
              <Label>المبلغ</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 text-center font-semibold"
                onFocus={(e) => e.target.select()}
              />
            </div>
          ) : (
            <>
              <div>
                <Label>إجمالي الفاتورة</Label>
                <Input
                  type="number"
                  value={amount}
                  className="mt-1 text-center font-semibold"
                  disabled
                />
              </div>
              <div>
                <Label>المدفوع</Label>
                <Input
                  type="number"
                  value={paidAmount}
                  className="mt-1 text-center font-semibold text-green-600"
                  disabled
                />
              </div>
              <div className="text-center text-sm">
                <span className="text-muted-foreground">المتبقي: </span>
                <span
                  className={`font-bold ${Number(amount) - Number(paidAmount) > 0 ? "text-red-500" : "text-green-600"}`}
                >
                  {(Number(amount) - Number(paidAmount)).toLocaleString()} ج.م
                </span>
              </div>
            </>
          )}

          <div>
            <Label>تاريخ العملية</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label>ملاحظات</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 min-h-[80px]"
              disabled={sourceType === "invoice"}
            />
          </div>

          <Button
            className="w-full bg-green-600 hover:bg-green-700"
            onClick={() => setConfirmOpen(true)}
          >
            حفظ التعديل
          </Button>
        </CardContent>
      </Card>

      {/* Confirm */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تأكيد التعديل</DialogTitle>
          </DialogHeader>
          <p className="text-center text-muted-foreground">
            هل أنت متأكد من حفظ التعديلات؟
          </p>
          <DialogFooter className="flex gap-2 sm:justify-center">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={submitEdit}
              disabled={saving}
              className="bg-green-600 hover:bg-green-700"
            >
              {saving ? "جارٍ الحفظ..." : "تأكيد"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
