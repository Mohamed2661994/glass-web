"use client";

import { useEffect, useRef, useState } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import axios from "@/services/api";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/auth-context";

interface Invoice {
  id: number;
  invoice_type: "retail" | "wholesale";
  movement_type: "sale" | "purchase";
  is_return?: boolean;
  customer_name: string;
  subtotal: number;
  total: number;
  previous_balance: number;
  paid_amount: number;
  remaining_amount: number;
  payment_status: "paid" | "partial" | "unpaid";
  created_at: string;
  created_by?: number;
  created_by_name?: string;
  updated_by?: number;
  updated_by_name?: string;
}

export default function InvoicesPage() {
  const [data, setData] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  // branch_id 1 = retail, branch_id 2 = wholesale
  const invoiceType =
    user?.branch_id === 1
      ? "retail"
      : user?.branch_id === 2
        ? "wholesale"
        : null;
  const [movementType, setMovementType] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const [page, setPage] = useState(1);
  const limit = 10;

  // Debounce search input
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [search]);

  const fetchInvoices = async () => {
    if (!invoiceType) return;
    try {
      setLoading(true);

      const params: any = {
        limit,
        offset: (page - 1) * limit,
        invoice_type: invoiceType,
      };

      if (movementType !== "all") params.movement_type = movementType;
      if (debouncedSearch) params.customer_name = debouncedSearch;

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
  }, [page, invoiceType, movementType, debouncedSearch]);

  const getStatusBadge = (status: string) => {
    if (status === "paid")
      return <Badge className="bg-green-600">مدفوعة</Badge>;
    if (status === "partial")
      return <Badge className="bg-yellow-500">جزئية</Badge>;
    return <Badge variant="destructive">غير مدفوعة</Badge>;
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف الفاتورة؟")) return;
    if (deleting) return;

    try {
      setDeleting(id);
      await axios.delete(`/invoices/${id}`);
      toast.success("تم حذف الفاتورة");
      fetchInvoices();
    } catch {
      toast.error("فشل حذف الفاتورة");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto" dir="rtl">
      <h1 className="text-2xl font-bold">
        فواتير {invoiceType === "retail" ? "القطاعي" : "الجملة"}
      </h1>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex flex-wrap gap-4 items-center">
          <Input
            placeholder="بحث باسم العميل..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-64"
          />

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
                <th className="p-3 text-right">الحركة</th>
                <th className="p-3 text-right">العميل</th>
                <th className="p-3 text-right">إجمالي الأصناف</th>
                <th className="p-3 text-right">حساب سابق</th>
                <th className="p-3 text-right">المدفوع</th>
                <th className="p-3 text-right">الباقي</th>
                <th className="p-3 text-right">الحالة</th>
                <th className="p-3 text-right">بواسطة</th>
                <th className="p-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b">
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j} className="p-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-6 text-center">
                    لا توجد فواتير
                  </td>
                </tr>
              ) : (
                data.map((invoice) => (
                  <tr key={invoice.id} className="border-b hover:bg-muted/50">
                    <td className="p-3">{invoice.id}</td>
                    <td className="p-3">
                      <span>
                        {invoice.movement_type === "sale" ? "بيع" : "شراء"}
                      </span>
                      {invoice.is_return && (
                        <Badge className="bg-orange-500 mr-2 text-xs">
                          مرتجع
                        </Badge>
                      )}
                    </td>
                    <td className="p-3">{invoice.customer_name || "نقدي"}</td>
                    <td className="p-3">
                      {Number(invoice.subtotal).toFixed(2)}
                    </td>
                    <td className="p-3">
                      {Number(invoice.previous_balance || 0).toFixed(2)}
                    </td>
                    <td className="p-3">
                      {Number(invoice.paid_amount).toFixed(2)}
                    </td>
                    <td className="p-3">
                      {Number(invoice.remaining_amount).toFixed(2)}
                    </td>
                    <td className="p-3">
                      {getStatusBadge(invoice.payment_status)}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {invoice.created_by_name || "—"}
                    </td>
                    <td className="p-3 flex gap-2 justify-center">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => router.push(`/invoices/${invoice.id}`)}
                      >
                        <Eye size={16} />
                      </Button>

                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() =>
                          router.push(
                            `/invoices/${invoice.id}/edit/${invoice.invoice_type}`,
                          )
                        }
                      >
                        <Pencil size={16} />
                      </Button>

                      <Button
                        size="icon"
                        variant="outline"
                        disabled={deleting === invoice.id}
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
