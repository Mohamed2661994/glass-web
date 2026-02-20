"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/services/api";
import { broadcastUpdate } from "@/lib/broadcast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, AlertTriangle } from "lucide-react";

interface PreviewItem {
  product_id: number;
  variant_id?: number;
  product_name?: string;
  manufacturer?: string;
  package_name?: string;
  quantity: number;
  from_quantity: number;
  to_quantity: number;
  final_price: number;
  from?: string;
  to?: string;
  status: "ok" | "rejected";
  reason?: string;
}

export default function StockTransferPreviewPage() {
  const router = useRouter();
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [totalAmount, setTotalAmount] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [transferNumber, setTransferNumber] = useState<number | null>(null);
  const [payload, setPayload] = useState<any>(null);

  /* ========== Load Preview ========== */
  useEffect(() => {
    const raw = sessionStorage.getItem("transfer_payload");
    const rawItems = sessionStorage.getItem("transfer_items");
    if (!raw) {
      toast.error("لا توجد بيانات تحويل");
      router.push("/stock-transfer");
      return;
    }

    const parsedPayload = JSON.parse(raw);
    setPayload(parsedPayload);
    setTotalAmount(parsedPayload.total_amount ?? 0);

    (async () => {
      try {
        const res = await api.post(
          "/stock/wholesale-to-retail/preview",
          parsedPayload,
        );

        const merged = res.data.map((row: any) => {
          const localItem = parsedPayload.items.find(
            (i: any) =>
              i.product_id === row.product_id &&
              (i.variant_id || 0) === (row.variant_id || 0),
          );
          return {
            ...row,
            quantity: localItem?.quantity ?? 0,
            from_quantity: row.from_quantity ?? 0,
            to_quantity: row.to_quantity ?? 0,
            final_price: localItem?.final_price ?? 0,
            manufacturer: row.manufacturer ?? "",
          };
        });

        setItems(merged);
      } catch {
        toast.error("فشل تحميل معاينة التحويل");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ========== Execute ========== */
  const executeTransfer = async () => {
    if (!payload) return;
    try {
      setSubmitting(true);
      const res = await api.post("/stock/wholesale-to-retail/execute", payload);
      setTransferNumber(res.data?.transfer_id ?? null);
      setShowSuccess(true);

      // إرسال إشعار تحديث لباقي الصفحات
      broadcastUpdate("transfer_created");

      // Clean up
      sessionStorage.removeItem("transfer_payload");
      sessionStorage.removeItem("transfer_items");
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "فشل التحويل");
    } finally {
      setSubmitting(false);
    }
  };

  /* ========== Render ========== */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="max-w-2xl mx-auto space-y-3 py-6 px-4">
      <h1 className="text-2xl font-bold text-center mb-6">معاينة التحويل</h1>

      {/* ===== Items ===== */}
      {items.map((item, idx) => {
        const noStock = item.from_quantity <= 0;
        const isOk = item.status === "ok";

        return (
          <Card
            key={idx}
            className={
              noStock
                ? "border-red-500 bg-red-50 dark:bg-red-950/30"
                : "bg-blue-950/80 dark:bg-blue-950/60 border-blue-900"
            }
          >
            <CardContent className="p-0">
              {noStock && (
                <div className="flex items-center justify-center gap-2 py-2 text-red-500 text-xs font-bold">
                  <AlertTriangle className="h-3 w-3" />
                  {item.reason || "رصيد غير كافٍ بالمخزن"}
                </div>
              )}

              {isOk ? (
                <div className="overflow-hidden rounded-lg">
                  {/* Header */}
                  <div className="grid grid-cols-4 bg-gray-600 text-white text-xs font-bold text-center">
                    <div className="col-span-1 py-2">اسم الصنف</div>
                    <div className="col-span-1 py-2">من المخزن</div>
                    <div className="col-span-1 py-2">إلى المعرض</div>
                    <div className="col-span-1 py-2">الإجمالي</div>
                  </div>
                  {/* Row */}
                  <div className="grid grid-cols-4 text-white text-sm text-center">
                    <div className="py-3 font-bold text-right pr-3">
                      {item.product_name} - {item.manufacturer}
                      {item.package_name && (
                        <div className="text-xs text-blue-200 mt-0.5">
                          {item.package_name}
                        </div>
                      )}
                    </div>
                    <div className="py-3 font-semibold">
                      {item.from_quantity}
                    </div>
                    <div className="py-3 font-semibold">{item.to_quantity}</div>
                    <div className="py-3 font-semibold">
                      {Math.round(item.final_price ?? 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 text-red-300 font-semibold text-right">
                  سبب الرفض: {item.reason}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* ===== Total ===== */}
      <Card className="bg-blue-900/40 dark:bg-blue-900/30 border-blue-800">
        <CardContent className="p-4 text-left font-bold text-base">
          الإجمالي: {Math.round(totalAmount).toLocaleString()} جنيه
        </CardContent>
      </Card>

      {/* ===== Confirm ===== */}
      <Button
        className="w-full text-base py-6"
        onClick={executeTransfer}
        disabled={submitting}
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin ml-2" />
            جاري التحويل...
          </>
        ) : (
          "تأكيد التحويل"
        )}
      </Button>

      {/* ===== Success Modal ===== */}
      <Dialog open={showSuccess} onOpenChange={() => {}}>
        <DialogContent dir="rtl" className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle>تم التحويل بنجاح ✅</DialogTitle>
          </DialogHeader>
          <p className="text-lg py-2">
            رقم التحويل:{" "}
            <span className="font-bold text-primary">{transferNumber}</span>
          </p>
          <p className="text-sm text-muted-foreground mb-2">
            هل تريد طباعة التحويل؟
          </p>
          <div className="flex gap-3">
            <Button
              className="flex-1"
              onClick={() => {
                // Store print data
                sessionStorage.setItem(
                  "transfer_print",
                  JSON.stringify({
                    transfer_number: transferNumber,
                    items,
                    total_amount: totalAmount,
                  }),
                );
                window.open("/stock-transfer/print", "_blank");
                window.location.href = "/stock-transfer";
              }}
            >
              طباعة
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                window.location.href = "/stock-transfer";
              }}
            >
              إلغاء
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
