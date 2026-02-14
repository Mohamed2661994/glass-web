"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "@/services/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

  if (loading) return <div className="p-6">جاري التحميل...</div>;
  if (!invoice) return <div className="p-6">الفاتورة غير موجودة</div>;

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold">تفاصيل الفاتورة #{invoice.id}</h1>

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
