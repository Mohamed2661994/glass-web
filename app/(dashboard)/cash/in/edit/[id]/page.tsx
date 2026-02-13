"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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

export default function EditCashInPage() {
  const { id } = useParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sourceName, setSourceName] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/cash-in/${id}`);
        const item = res.data.data;

        if (!item || item.source_type !== "manual") {
          toast.error("لا يمكن تعديل هذا القيد");
          router.back();
          return;
        }

        setSourceName(item.customer_name || "");
        setAmount(String(item.amount));
        setDescription(item.notes || item.description || "");
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
      await api.put(`/cash-in/${id}`, {
        customer_name: sourceName,
        description,
        amount: Number(amount),
        transaction_date: date,
      });
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
      <h1 className="text-xl font-bold text-center mb-6">تعديل وارد الخزنة</h1>

      <Card>
        <CardContent className="p-5 space-y-4">
          <div>
            <Label>الاسم</Label>
            <Input
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label>المبلغ</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 text-center font-semibold"
            />
          </div>

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
            <Label>البيان</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 min-h-[80px]"
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
