"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Globe, Pencil, Printer, Trash2 } from "lucide-react";
import { toast } from "sonner";
import api from "@/services/api";
import { useAuth } from "@/app/context/auth-context";
import { useRealtime } from "@/hooks/use-realtime";
import { broadcastUpdate, onUpdate } from "@/lib/broadcast";
import { hasPermission } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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

type InvoiceTypeFilter = "all" | "retail" | "wholesale";

interface OnlineInvoice {
  id: number;
  invoice_type: "retail" | "wholesale";
  movement_type: "sale" | "purchase";
  customer_name: string;
  total: number;
  paid_amount: number;
  remaining_amount: number;
  payment_status: "paid" | "partial" | "unpaid";
  invoice_date: string;
  created_at: string;
  created_by_name?: string;
  invoice_source?: string | null;
  external_order_id?: string | null;
}

const toNumber = (value: unknown) => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
};

export default function OnlineInvoicesPage() {
  const router = useRouter();
  const { user, authReady } = useAuth();
  const canEditInvoice = authReady && hasPermission(user, "invoice_edit");
  const canDeleteInvoice = authReady && hasPermission(user, "invoice_delete");

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<OnlineInvoice[]>([]);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [invoiceType, setInvoiceType] = useState<InvoiceTypeFilter>("all");
  const [search, setSearch] = useState("");
  const [invoiceIdSearch, setInvoiceIdSearch] = useState("");
  const [externalOrderIdSearch, setExternalOrderIdSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const limit = 15;

  const fetchInvoices = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string | number | boolean> = {
        online_only: true,
        limit,
        offset: (page - 1) * limit,
      };

      if (invoiceType !== "all") {
        params.invoice_type = invoiceType;
      }
      if (search.trim()) {
        params.customer_name = search.trim();
      }
      if (invoiceIdSearch.trim()) {
        params.invoice_id = invoiceIdSearch.trim();
      }
      if (externalOrderIdSearch.trim()) {
        params.external_order_id = externalOrderIdSearch.trim();
      }
      if (dateFrom) {
        params.date_from = dateFrom;
      }
      if (dateTo) {
        params.date_to = dateTo;
      }

      const res = await api.get("/invoices", { params });
      const invoices: OnlineInvoice[] = Array.isArray(res.data)
        ? res.data
        : (res.data.data ?? []);
      setData(invoices);
    } catch {
      toast.error("فشل تحميل فواتير الأونلاين");
    } finally {
      setLoading(false);
    }
  }, [
    dateFrom,
    dateTo,
    externalOrderIdSearch,
    invoiceIdSearch,
    invoiceType,
    page,
    search,
  ]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  useRealtime("data:invoices", fetchInvoices);

  useEffect(() => {
    const cleanup = onUpdate(
      ["invoice_created", "invoice_updated", "invoice_deleted"],
      fetchInvoices,
    );
    return cleanup;
  }, [fetchInvoices]);

  const clearFilters = () => {
    setInvoiceType("all");
    setSearch("");
    setInvoiceIdSearch("");
    setExternalOrderIdSearch("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
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
      await api.delete(`/invoices/${invoiceToDelete}`);
      toast.success("تم حذف الفاتورة الأونلاين");
      broadcastUpdate("invoice_deleted");
      fetchInvoices();
    } catch {
      toast.error("فشل حذف الفاتورة الأونلاين");
    } finally {
      setDeleting(null);
      setInvoiceToDelete(null);
    }
  };

  const getStatusBadge = (status: OnlineInvoice["payment_status"]) => {
    if (status === "paid") {
      return <Badge className="bg-green-600">مدفوعة</Badge>;
    }
    if (status === "partial") {
      return <Badge className="bg-yellow-500">جزئية</Badge>;
    }
    return <Badge variant="destructive">غير مدفوعة</Badge>;
  };

  const hasActiveFilters = Boolean(
    search ||
    invoiceIdSearch ||
    externalOrderIdSearch ||
    dateFrom ||
    dateTo ||
    invoiceType !== "all",
  );

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto" dir="rtl">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600">
          <Globe className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold">فواتير الأونلاين</h1>
          <p className="text-sm text-muted-foreground">
            شاشة منفصلة للطلبات القادمة من الموقع الخارجي
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <Input
              placeholder="بحث باسم العميل"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <Input
              placeholder="رقم الفاتورة"
              type="number"
              value={invoiceIdSearch}
              onChange={(e) => {
                setInvoiceIdSearch(e.target.value);
                setPage(1);
              }}
            />
            <Input
              placeholder="رقم الطلب الخارجي"
              value={externalOrderIdSearch}
              onChange={(e) => {
                setExternalOrderIdSearch(e.target.value);
                setPage(1);
              }}
            />
            <Select
              value={invoiceType}
              onValueChange={(value: InvoiceTypeFilter) => {
                setInvoiceType(value);
                setPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="نوع الفاتورة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأنواع</SelectItem>
                <SelectItem value="retail">قطاعي</SelectItem>
                <SelectItem value="wholesale">جملة</SelectItem>
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
              />
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

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              مسح الفلاتر
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="hidden md:block">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="p-3 text-right">رقم</th>
                <th className="p-3 text-right">الطلب الخارجي</th>
                <th className="p-3 text-right">النوع</th>
                <th className="p-3 text-right">العميل</th>
                <th className="p-3 text-right">الإجمالي</th>
                <th className="p-3 text-right">المدفوع</th>
                <th className="p-3 text-right">المتبقي</th>
                <th className="p-3 text-right">المصدر</th>
                <th className="p-3 text-right">الحالة</th>
                <th className="p-3 text-right">التاريخ</th>
                <th className="p-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <tr key={index} className="border-b">
                    {Array.from({ length: 11 }).map((__, cellIndex) => (
                      <td key={cellIndex} className="p-3">
                        <Skeleton className="h-4 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="p-8 text-center text-muted-foreground"
                  >
                    لا توجد فواتير أونلاين
                  </td>
                </tr>
              ) : (
                data.map((invoice) => (
                  <tr key={invoice.id} className="border-b hover:bg-muted/50">
                    <td className="p-3 font-semibold">#{invoice.id}</td>
                    <td className="p-3">{invoice.external_order_id || "—"}</td>
                    <td className="p-3">
                      <Badge variant="outline">
                        {invoice.invoice_type === "retail" ? "قطاعي" : "جملة"}
                      </Badge>
                    </td>
                    <td className="p-3">{invoice.customer_name || "نقدي"}</td>
                    <td className="p-3">
                      {toNumber(invoice.total).toFixed(2)}
                    </td>
                    <td className="p-3 text-green-600">
                      {toNumber(invoice.paid_amount).toFixed(2)}
                    </td>
                    <td className="p-3">
                      {toNumber(invoice.remaining_amount).toFixed(2)}
                    </td>
                    <td className="p-3">
                      <Badge className="bg-sky-600">
                        {invoice.invoice_source || "online"}
                      </Badge>
                    </td>
                    <td className="p-3">
                      {getStatusBadge(invoice.payment_status)}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {new Date(
                        invoice.invoice_date || invoice.created_at,
                      ).toLocaleDateString("ar-EG")}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-2">
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => router.push(`/invoices/${invoice.id}`)}
                        >
                          <Eye size={16} />
                        </Button>
                        {canEditInvoice && (
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
                        )}
                        {canDeleteInvoice && (
                          <Button
                            size="icon"
                            variant="outline"
                            disabled={deleting === invoice.id}
                            onClick={() => confirmDelete(invoice.id)}
                          >
                            <Trash2 size={16} />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() =>
                            window.open(
                              `/invoices/${invoice.id}/print`,
                              "_blank",
                            )
                          }
                        >
                          <Printer size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <div className="md:hidden space-y-3">
        {loading ? (
          Array.from({ length: 5 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))
        ) : data.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              لا توجد فواتير أونلاين
            </CardContent>
          </Card>
        ) : (
          data.map((invoice) => (
            <Card key={invoice.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex items-center justify-between p-3 border-b border-border/50">
                  <div>
                    <p className="font-bold">#{invoice.id}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {invoice.external_order_id || "بدون رقم طلب خارجي"}
                    </p>
                  </div>
                  {getStatusBadge(invoice.payment_status)}
                </div>

                <div className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {invoice.customer_name || "نقدي"}
                    </span>
                    <Badge variant="outline">
                      {invoice.invoice_type === "retail" ? "قطاعي" : "جملة"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">المصدر</span>
                    <Badge className="bg-sky-600">
                      {invoice.invoice_source || "online"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center pt-1">
                    <div>
                      <p className="text-[10px] text-muted-foreground">
                        الإجمالي
                      </p>
                      <p className="font-bold text-sm">
                        {toNumber(invoice.total).toFixed(0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">مدفوع</p>
                      <p className="font-bold text-sm text-green-600">
                        {toNumber(invoice.paid_amount).toFixed(0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">متبقي</p>
                      <p className="font-bold text-sm">
                        {toNumber(invoice.remaining_amount).toFixed(0)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border/50 px-2 py-2 bg-muted/30">
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(
                      invoice.invoice_date || invoice.created_at,
                    ).toLocaleDateString("ar-EG")}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => router.push(`/invoices/${invoice.id}`)}
                    >
                      <Eye size={14} />
                    </Button>
                    {canEditInvoice && (
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
                    )}
                    {canDeleteInvoice && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={deleting === invoice.id}
                        onClick={() => confirmDelete(invoice.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
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

      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          disabled={page === 1}
          onClick={() => setPage((prev) => prev - 1)}
        >
          السابق
        </Button>
        <span>صفحة {page}</span>
        <Button
          variant="outline"
          disabled={data.length < limit}
          onClick={() => setPage((prev) => prev + 1)}
        >
          التالي
        </Button>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد من حذف الفاتورة؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف الفاتورة الأونلاين رقم {invoiceToDelete} نهائياً وسيتم مسح القيد المرتبط بها من اليومية. لا يمكن التراجع عن هذا الإجراء.
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
