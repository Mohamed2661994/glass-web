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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const [invoiceIdSearch, setInvoiceIdSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<number | null>(null);

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
      if (invoiceIdSearch) params.invoice_id = invoiceIdSearch;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

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
  }, [
    page,
    invoiceType,
    movementType,
    debouncedSearch,
    invoiceIdSearch,
    dateFrom,
    dateTo,
  ]);

  const getStatusBadge = (status: string) => {
    if (status === "paid")
      return <Badge className="bg-green-600">مدفوعة</Badge>;
    if (status === "partial")
      return <Badge className="bg-yellow-500">جزئية</Badge>;
    return <Badge variant="destructive">غير مدفوعة</Badge>;
  };

  const confirmDelete = (id: number) => {
    setInvoiceToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!invoiceToDelete || deleting) return;

    try {
      setDeleting(invoiceToDelete);
      setDeleteDialogOpen(false);
      await axios.delete(`/invoices/${invoiceToDelete}`);
      toast.success("تم حذف الفاتورة");
      fetchInvoices();
    } catch {
      toast.error("فشل حذف الفاتورة");
    } finally {
      setDeleting(null);
      setInvoiceToDelete(null);
    }
  };

  return (
    <div
      className="p-4 md:p-6 space-y-4 md:space-y-6 max-w-5xl mx-auto"
      dir="rtl"
    >
      <h1 className="text-xl md:text-2xl font-bold">
        فواتير {invoiceType === "retail" ? "القطاعي" : "الجملة"}
      </h1>

      {/* Filters */}
      <Card>
        <CardContent className="p-3 md:p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:gap-3">
            <Input
              placeholder="بحث باسم العميل..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="col-span-2 md:w-52"
            />

            <Input
              placeholder="رقم الفاتورة"
              type="number"
              value={invoiceIdSearch}
              onChange={(e) => {
                setInvoiceIdSearch(e.target.value);
                setPage(1);
              }}
              className="md:w-36"
            />

            <Select
              value={movementType}
              onValueChange={(v) => {
                setMovementType(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="md:w-36">
                <SelectValue placeholder="حركة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="sale">بيع</SelectItem>
                <SelectItem value="purchase">شراء</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                من
              </span>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground whitespace-nowrap">
                إلى
              </span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>

          {(dateFrom ||
            dateTo ||
            invoiceIdSearch ||
            search ||
            movementType !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full md:w-auto"
              onClick={() => {
                setSearch("");
                setInvoiceIdSearch("");
                setDateFrom("");
                setDateTo("");
                setMovementType("all");
                setPage(1);
              }}
            >
              مسح الفلاتر
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Desktop Table */}
      <Card className="hidden md:block">
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
                  <td
                    colSpan={10}
                    className="p-6 text-center text-muted-foreground"
                  >
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
                        onClick={() => confirmDelete(invoice.id)}
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

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-3 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ))
        ) : data.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              لا توجد فواتير
            </CardContent>
          </Card>
        ) : (
          data.map((invoice) => (
            <Card
              key={invoice.id}
              className="overflow-hidden"
              onClick={() => router.push(`/invoices/${invoice.id}`)}
            >
              <CardContent className="p-0">
                {/* Top row: ID + status + movement */}
                <div className="flex items-center justify-between p-3 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold">#{invoice.id}</span>
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0"
                    >
                      {invoice.movement_type === "sale" ? "بيع" : "شراء"}
                    </Badge>
                    {invoice.is_return && (
                      <Badge className="bg-orange-500 text-[10px] px-1.5 py-0">
                        مرتجع
                      </Badge>
                    )}
                  </div>
                  {getStatusBadge(invoice.payment_status)}
                </div>

                {/* Customer name */}
                <div className="px-3 pb-2">
                  <p className="text-sm font-medium">
                    {invoice.customer_name || "نقدي"}
                  </p>
                  {invoice.created_by_name && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      بواسطة: {invoice.created_by_name}
                    </p>
                  )}
                </div>

                {/* Financial grid */}
                <div className="grid grid-cols-4 text-center border-t border-border/50">
                  <div className="p-2 border-l border-border/50">
                    <p className="text-[9px] text-muted-foreground">الإجمالي</p>
                    <p className="text-xs font-bold">
                      {Number(invoice.subtotal).toFixed(0)}
                    </p>
                  </div>
                  <div className="p-2 border-l border-border/50">
                    <p className="text-[9px] text-muted-foreground">سابق</p>
                    <p className="text-xs font-medium">
                      {Number(invoice.previous_balance || 0).toFixed(0)}
                    </p>
                  </div>
                  <div className="p-2 border-l border-border/50">
                    <p className="text-[9px] text-muted-foreground">مدفوع</p>
                    <p className="text-xs font-medium text-green-600 dark:text-green-400">
                      {Number(invoice.paid_amount).toFixed(0)}
                    </p>
                  </div>
                  <div className="p-2">
                    <p className="text-[9px] text-muted-foreground">باقي</p>
                    <p
                      className={`text-xs font-bold ${
                        Number(invoice.remaining_amount) > 0
                          ? "text-red-500"
                          : ""
                      }`}
                    >
                      {Number(invoice.remaining_amount).toFixed(0)}
                    </p>
                  </div>
                </div>

                {/* Actions row */}
                <div
                  className="flex items-center justify-between border-t border-border/50 px-2 py-1.5 bg-muted/30"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(invoice.created_at).toLocaleDateString("ar-EG", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => router.push(`/invoices/${invoice.id}`)}
                    >
                      <Eye size={14} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() =>
                        router.push(
                          `/invoices/${invoice.id}/edit/${invoice.invoice_type}`,
                        )
                      }
                    >
                      <Pencil size={14} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      disabled={deleting === invoice.id}
                      onClick={() => confirmDelete(invoice.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() =>
                        window.open(`/invoices/${invoice.id}/print`, "_blank")
                      }
                    >
                      <Printer size={14} />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد من حذف الفاتورة؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف الفاتورة رقم {invoiceToDelete} نهائياً ولا يمكن التراجع
              عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
