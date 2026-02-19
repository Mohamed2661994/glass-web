"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/services/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";

interface TransferItem {
  id: number;
  product_id: number;
  product_name: string;
  from_quantity: number;
  to_quantity: number;
  from_warehouse: string;
  to_warehouse: string;
  status: string;
}

interface Transfer {
  id: number;
  branch_id: number;
  note: string;
  status: string;
  created_at: string;
  items: TransferItem[];
}

export default function TransferDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [cancellingItem, setCancellingItem] = useState<number | null>(null);
  const [cancellingAll, setCancellingAll] = useState(false);
  const [showCancelAll, setShowCancelAll] = useState(false);

  const INITIAL_SHOW = 5;

  /* ========== Load ========== */
  const loadTransfer = useCallback(async () => {
    try {
      const { data } = await api.get(`/stock-transfers/${id}`);
      setTransfer({
        ...data.transfer,
        items: data.items ?? [],
      });
    } catch {
      toast.error("فشل تحميل بيانات التحويل");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadTransfer();
  }, [loadTransfer]);

  /* ========== Cancel Item ========== */
  const cancelItem = async (itemId: number) => {
    try {
      setCancellingItem(itemId);
      await api.post(`/stock-transfers/items/${itemId}/cancel`);
      toast.success("تم إلغاء الصنف");
      loadTransfer();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || "فشل إلغاء الصنف";
      toast.error(msg);
      console.error("Cancel item error:", err?.response?.data || err);
    } finally {
      setCancellingItem(null);
    }
  };

  /* ========== Cancel All ========== */
  const cancelAll = async () => {
    try {
      setCancellingAll(true);
      await api.post(`/stock-transfers/${id}/cancel`);
      toast.success("تم إلغاء التحويل بالكامل");
      setShowCancelAll(false);
      loadTransfer();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || "فشل إلغاء التحويل";
      toast.error(msg);
      console.error("Cancel all error:", err?.response?.data || err);
    } finally {
      setCancellingAll(false);
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

  if (!transfer) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        التحويل غير موجود
      </div>
    );
  }

  const isCancelled = transfer.status === "cancelled";
  const visibleItems = expanded
    ? transfer.items
    : transfer.items.slice(0, INITIAL_SHOW);
  const hasMore = transfer.items.length > INITIAL_SHOW;

  return (
    <div dir="rtl" className="max-w-2xl mx-auto space-y-4 py-6 px-4">
      {/* ===== Header ===== */}
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">تحويل #{transfer.id}</h1>
            <Badge variant={isCancelled ? "destructive" : "default"}>
              {isCancelled ? "ملغي" : "مكتمل"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {new Date(transfer.created_at).toLocaleDateString("ar-EG", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          {transfer.note && (
            <p className="text-sm text-muted-foreground">
              ملاحظة: {transfer.note}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            عدد الأصناف: {transfer.items.length}
          </p>
        </CardContent>
      </Card>

      {/* ===== Items ===== */}
      {visibleItems.map((item) => {
        const itemCancelled = item.status === "cancelled";
        return (
          <Card
            key={item.id}
            className={itemCancelled ? "opacity-50 border-red-500" : ""}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                {/* Cancel Button */}
                {!isCancelled && !itemCancelled && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 text-xs shrink-0"
                    disabled={cancellingItem === item.id}
                    onClick={() => cancelItem(item.id)}
                  >
                    {cancellingItem === item.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      "إلغاء"
                    )}
                  </Button>
                )}
                {itemCancelled && (
                  <Badge variant="destructive" className="text-[10px] shrink-0">
                    ملغي
                  </Badge>
                )}

                {/* Info */}
                <div className="flex-1 text-right min-w-0">
                  <div className="font-bold text-sm truncate">
                    {item.product_name}
                  </div>
                  <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                    <span>
                      {item.from_warehouse}: {item.from_quantity}
                    </span>
                    <span>
                      {item.to_warehouse}: {item.to_quantity}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Expand/Collapse */}
      {hasMore && (
        <Button
          variant="ghost"
          className="w-full text-muted-foreground text-sm"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <>
              عرض أقل <ChevronUp className="h-4 w-4 mr-1" />
            </>
          ) : (
            <>
              عرض الكل ({transfer.items.length} صنف){" "}
              <ChevronDown className="h-4 w-4 mr-1" />
            </>
          )}
        </Button>
      )}

      {/* ===== Danger Zone ===== */}
      {!isCancelled && (
        <Card className="border-red-500">
          <CardContent className="p-4 flex items-center justify-between">
            <Button
              variant="destructive"
              onClick={() => setShowCancelAll(true)}
            >
              إلغاء التحويل بالكامل
            </Button>
            <div className="flex items-center gap-2 text-red-500 text-sm">
              <AlertTriangle className="h-4 w-4" />
              منطقة الخطر
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== Cancel All Modal ===== */}
      <Dialog open={showCancelAll} onOpenChange={setShowCancelAll}>
        <DialogContent dir="rtl" className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle>تأكيد إلغاء التحويل</DialogTitle>
          </DialogHeader>
          <p className="py-4 text-muted-foreground">
            هل أنت متأكد من إلغاء التحويل بالكامل؟ سيتم إعادة المخزون.
          </p>
          <div className="flex gap-3">
            <Button
              variant="destructive"
              className="flex-1"
              onClick={cancelAll}
              disabled={cancellingAll}
            >
              {cancellingAll ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "تأكيد الإلغاء"
              )}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowCancelAll(false)}
            >
              رجوع
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
