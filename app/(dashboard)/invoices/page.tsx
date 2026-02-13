"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Eye, Pencil, Trash2, Printer } from "lucide-react";
import axios from "@/services/api";
import { useRouter } from "next/navigation";

interface Invoice {
  id: number;
  invoice_type: "retail" | "wholesale";
  movement_type: "sale" | "purchase";
  customer_name: string;
  total: number;
  paid_amount: number;
  remaining_amount: number;
  payment_status: "paid" | "partial" | "unpaid";
  created_at: string;
}

export default function InvoicesPage() {
  const [data, setData] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const [invoiceType, setInvoiceType] = useState<string>("all");
  const [movementType, setMovementType] = useState<string>("all");
  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);
  const limit = 10;

  const fetchInvoices = async () => {
    try {
      setLoading(true);

      const params: any = {
        limit,
        offset: (page - 1) * limit,
      };

      if (invoiceType !== "all") params.invoice_type = invoiceType;
      if (movementType !== "all") params.movement_type = movementType;
      if (search) params.customer_name = search;

      const res = await axios.get("/invoices", { params });

      setData(res.data);
    } catch (err) {
      toast.error("فشل تحميل الفواتير");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [page, invoiceType, movementType]);

  const getStatusBadge = (status: string) => {
    if (status === "paid")
      return <Badge className="bg-green-600">مدفوعة</Badge>;
    if (status === "partial")
      return <Badge className="bg-yellow-500">جزئية</Badge>;
    return <Badge variant="destructive">غير مدفوعة</Badge>;
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف الفاتورة؟")) return;

    try {
      await axios.delete(`/invoices/${id}`);
      toast.success("تم حذف الفاتورة");
      fetchInvoices();
    } catch {
      toast.error("فشل حذف الفاتورة");
    }
  };

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold">الفواتير</h1>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-4 items-center">
          <Input
            placeholder="بحث باسم العميل..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onBlur={() => fetchInvoices()}
            className="w-64"
          />

          <Select value={invoiceType} onValueChange={setInvoiceType}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="نوع الفاتورة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="retail">قطاعي</SelectItem>
              <SelectItem value="wholesale">جملة</SelectItem>
            </SelectContent>
          </Select>

          <Select value={movementType} onValueChange={setMovementType}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="حركة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="sale">بيع</SelectItem>
              <SelectItem value="purchase">شراء</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="p-3 text-right">رقم</th>
                <th className="p-3 text-right">النوع</th>
                <th className="p-3 text-right">الحركة</th>
                <th className="p-3 text-right">العميل</th>
                <th className="p-3 text-right">الإجمالي</th>
                <th className="p-3 text-right">المتبقي</th>
                <th className="p-3 text-right">الحالة</th>
                <th className="p-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center">
                    جاري التحميل...
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center">
                    لا توجد فواتير
                  </td>
                </tr>
              ) : (
                data.map((invoice) => (
                  <tr key={invoice.id} className="border-b hover:bg-muted/50">
                    <td className="p-3">{invoice.id}</td>
                    <td className="p-3">
                      {invoice.invoice_type === "retail" ? "قطاعي" : "جملة"}
                    </td>
                    <td className="p-3">
                      {invoice.movement_type === "sale" ? "بيع" : "شراء"}
                    </td>
                    <td className="p-3">{invoice.customer_name || "نقدي"}</td>
                    <td className="p-3">{Number(invoice.total).toFixed(2)}</td>
                    <td className="p-3">
                      {Number(invoice.remaining_amount).toFixed(2)}
                    </td>
                    <td className="p-3">
                      {getStatusBadge(invoice.payment_status)}
                    </td>
                    <td className="p-3 flex gap-2 justify-center">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => router.push(`/invoices/${invoice.id}`)}
                      >
                        <Eye size={16} />
                      </Button>

                      <Button size="icon" variant="outline">
                        <Pencil size={16} />
                      </Button>

                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => handleDelete(invoice.id)}
                      >
                        <Trash2 size={16} />
                      </Button>

                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() =>
                          window.open(`/invoices/${invoice.id}/print`, "_blank")
                        }
                      >
                        <Printer size={16} />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          disabled={page === 1}
          onClick={() => setPage((p) => p - 1)}
        >
          السابق
        </Button>

        <span>صفحة {page}</span>

        <Button
          variant="outline"
          disabled={data.length < limit}
          onClick={() => setPage((p) => p + 1)}
        >
          التالي
        </Button>
      </div>
    </div>
  );
}
