"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "@/services/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function InvoiceDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchInvoice = async () => {
    try {
      const res = await axios.get(`/invoices/${id}/edit`);
      setInvoice(res.data);
    } catch (err) {
      toast.error("فشل تحميل الفاتورة");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchInvoice();
  }, [id]);

  if (loading)
    return (
      <div className="p-6 space-y-6" dir="rtl">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-40" />
          </CardContent>
        </Card>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
    );
  if (!invoice) return <div className="p-6">الفاتورة غير موجودة</div>;

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold">
        تفاصيل الفاتورة #{invoice.id}
        {invoice.is_return && (
          <Badge className="bg-orange-500 mr-3 text-sm">مرتجع</Badge>
        )}
      </h1>

      <Card>
        <CardContent className="p-4 space-y-2">
          <p>
            <strong>العميل:</strong> {invoice.customer_name || "نقدي"}
          </p>
          <p>
            <strong>الإجمالي:</strong> {invoice.total}
          </p>
          <p>
            <strong>المدفوع:</strong> {invoice.paid_amount}
          </p>
          <p>
            <strong>المتبقي:</strong> {invoice.remaining_amount}
          </p>
          {invoice.created_by_name && (
            <p>
              <strong>أنشأها:</strong> {invoice.created_by_name}
            </p>
          )}
          {invoice.updated_by_name && (
            <p>
              <strong>آخر تعديل:</strong> {invoice.updated_by_name}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() =>
            router.push(
              `/invoices/${invoice.id}/edit/${invoice.invoice_type === "retail" ? "retail" : "wholesale"}`,
            )
          }
        >
          تعديل الفاتورة
        </Button>
        <Button
          onClick={() => window.open(`/invoices/${invoice.id}/print`, "_blank")}
        >
          طباعة
        </Button>
      </div>
    </div>
  );
}
