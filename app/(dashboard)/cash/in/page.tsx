"use client";

import { useState } from "react";
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
import { toast } from "sonner";
import api from "@/services/api";

export default function CashInPage() {
  const [sourceName, setSourceName] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [entryType, setEntryType] = useState<"manual" | "customer_payment">(
    "manual",
  );
  const [date, setDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [cashInNumber, setCashInNumber] = useState<number | null>(null);

  const finalDescription =
    description || (entryType === "customer_payment" ? "سند دفع" : "وارد نقدي");

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
      const { data } = await api.post("/cash/in", {
        transaction_date: date,
        customer_name: sourceName,
        description: finalDescription,
        amount: Number(amount),
        source_type: entryType,
      });

      setConfirmOpen(false);
      setCashInNumber(data.cash_in_id);
      setSuccessOpen(true);

      setSourceName("");
      setAmount("");
      setDescription("");
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

      <Card>
        <CardContent className="p-6 space-y-5">
          {/* الاسم */}
          <div>
            <Label>
              {entryType === "customer_payment" ? "اسم العميل" : "الاسم"}
            </Label>
            <Input
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              placeholder="اسم القيد"
              className="mt-2"
            />
          </div>

          {/* نوع القيد */}
          <div>
            <Label>نوع القيد</Label>
            <div className="flex gap-3 mt-3">
              <Button
                type="button"
                variant={entryType === "manual" ? "default" : "outline"}
                className={`flex-1 ${entryType === "manual" ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                onClick={() => setEntryType("manual")}
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
            </div>
          </div>

          {/* المبلغ */}
          <div>
            <Label>المبلغ</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="mt-2 text-center font-semibold"
            />
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

          {/* البيان */}
          <div>
            <Label>البيان</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="سبب الوارد"
              className="mt-2 min-h-[80px]"
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
    </div>
  );
}
