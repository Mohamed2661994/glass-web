"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/services/api";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Loader2, Printer, Eye } from "lucide-react";

/* ========== Types ========== */
type Invoice = {
  record_type: "invoice" | "payment";
  invoice_id: number;
  invoice_date: string;
  total: number;
  paid_amount: number;
  remaining_amount: number;
};

/* ========== Component ========== */
export default function CustomerDebtDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const customerName = decodeURIComponent(params.name as string);

  const [data, setData] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  /* ========== Invoice Preview Modal ========== */
  const [previewInvoice, setPreviewInvoice] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const openInvoicePreview = async (invoiceId: number) => {
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewInvoice(null);
    try {
      const res = await api.get(`/invoices/${invoiceId}/edit`);
      setPreviewInvoice(res.data);
    } catch {
      setPreviewInvoice(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  /* ========== Fetch ========== */
  const fetchDetails = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/reports/customer-debt-details", {
        params: {
          customer_name: customerName,
          from: fromDate || undefined,
          to: toDate || undefined,
        },
      });
      setData(res.data || []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [customerName, fromDate, toDate]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  /* ========== Totals ========== */
  const totalAll = useMemo(
    () =>
      data
        .filter((i) => i.record_type === "invoice")
        .reduce((s, i) => s + Number(i.total), 0),
    [data],
  );

  const totalPaid = useMemo(
    () => data.reduce((s, i) => s + Number(i.paid_amount), 0),
    [data],
  );

  /* ========== Running Balance (الحساب السابق) ========== */
  const runningBalances = useMemo(() => {
    const balances: number[] = [];
    let balance = 0;
    for (let i = 0; i < data.length; i++) {
      balances.push(balance);
      const row = data[i];
      if (row.record_type === "invoice") {
        // نستخدم total - paid بدل remaining
        // لأن remaining بتشمل الحساب السابق المرحّل
        balance += Number(row.total) - Number(row.paid_amount);
      } else {
        balance -= Number(row.paid_amount);
      }
    }
    return balances;
  }, [data]);

  // صافي المديونية = الرصيد النهائي بعد آخر حركة
  const netDebt = totalAll - totalPaid;

  return (
    <PageContainer size="xl">
      <div dir="rtl" className="space-y-4 py-6">
        <h1 className="text-2xl font-bold text-center">كشف حساب العميل</h1>

        {/* Customer name + Print */}
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-muted-foreground text-sm">اسم العميل</p>
            <p className="text-lg font-bold">{customerName}</p>
            {!loading && data.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  const params = new URLSearchParams();
                  if (fromDate) params.set("from", fromDate);
                  if (toDate) params.set("to", toDate);
                  const qs = params.toString();
                  router.push(
                    `/reports/customer-balances/${encodeURIComponent(customerName)}/print${qs ? `?${qs}` : ""}`,
                  );
                }}
              >
                <Printer className="h-4 w-4 ml-2" />
                طباعة كشف الحساب
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Date filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 justify-center items-end">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">
                  من تاريخ
                </label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-44"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground">
                  إلى تاريخ
                </label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-44"
                />
              </div>
              {(fromDate || toDate) && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setFromDate("");
                    setToDate("");
                  }}
                >
                  مسح
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Table (Desktop) + Cards (Mobile) */}
        {!loading && data.length > 0 && (
          <>
            {/* Desktop Table */}
            <Card className="hidden md:block">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-center">النوع</TableHead>
                        <TableHead className="text-center">رقم</TableHead>
                        <TableHead className="text-center">التاريخ</TableHead>
                        <TableHead className="text-center">
                          الحساب السابق
                        </TableHead>
                        <TableHead className="text-center">الإجمالي</TableHead>
                        <TableHead className="text-center">المدفوع</TableHead>
                        <TableHead className="text-center">الباقي</TableHead>
                        <TableHead className="text-center w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.map((inv, idx) => (
                        <TableRow key={`${inv.record_type}-${inv.invoice_id}`}>
                          <TableCell className="text-center">
                            <Badge
                              variant={
                                inv.record_type === "invoice"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {inv.record_type === "invoice"
                                ? "فاتورة"
                                : "سند دفع"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {inv.invoice_id}
                          </TableCell>
                          <TableCell className="text-center text-xs">
                            {new Date(inv.invoice_date).toLocaleDateString(
                              "ar-EG",
                            )}
                          </TableCell>
                          <TableCell className="text-center font-medium">
                            {runningBalances[idx] === 0
                              ? "—"
                              : runningBalances[idx].toLocaleString()}
                          </TableCell>
                          <TableCell className="text-center">
                            {inv.record_type === "invoice"
                              ? Number(inv.total).toLocaleString()
                              : "—"}
                          </TableCell>
                          <TableCell className="text-center">
                            {Number(inv.paid_amount).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-center">
                            {inv.record_type === "invoice"
                              ? Number(inv.remaining_amount).toLocaleString()
                              : "—"}
                          </TableCell>
                          <TableCell className="text-center">
                            {inv.record_type === "invoice" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="عرض الفاتورة"
                                onClick={() =>
                                  openInvoicePreview(inv.invoice_id)
                                }
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-2">
              {data.map((inv, idx) => (
                <Card
                  key={`m-${inv.record_type}-${inv.invoice_id}`}
                  className="overflow-hidden"
                >
                  <CardContent className="p-3 space-y-2">
                    {/* Row 1: Type + Number + Date + View */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            inv.record_type === "invoice"
                              ? "default"
                              : "secondary"
                          }
                          className="text-xs"
                        >
                          {inv.record_type === "invoice" ? "فاتورة" : "سند دفع"}
                        </Badge>
                        <span className="font-bold text-sm">
                          #{inv.invoice_id}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(inv.invoice_date).toLocaleDateString(
                            "ar-EG",
                          )}
                        </span>
                        {inv.record_type === "invoice" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="عرض الفاتورة"
                            onClick={() => openInvoicePreview(inv.invoice_id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Row 2: Numbers grid */}
                    <div className="grid grid-cols-4 gap-1 text-center text-xs">
                      <div>
                        <p className="text-muted-foreground">الحساب السابق</p>
                        <p className="font-medium">
                          {runningBalances[idx] === 0
                            ? "—"
                            : runningBalances[idx].toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">الإجمالي</p>
                        <p className="font-medium">
                          {inv.record_type === "invoice"
                            ? Number(inv.total).toLocaleString()
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">المدفوع</p>
                        <p className="font-medium text-green-600">
                          {Number(inv.paid_amount).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">الباقي</p>
                        <p className="font-medium text-red-600">
                          {inv.record_type === "invoice"
                            ? Number(inv.remaining_amount).toLocaleString()
                            : "—"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        {/* Empty */}
        {!loading && data.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            لا توجد بيانات لهذا العميل
          </div>
        )}

        {/* Summary */}
        {!loading && data.length > 0 && (
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-4 justify-center text-sm">
                <div className="text-center">
                  <p className="text-muted-foreground">إجمالي الفواتير</p>
                  <p className="font-bold">{totalAll.toLocaleString()}</p>
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground">إجمالي المدفوع</p>
                  <p className="font-bold text-green-600">
                    {totalPaid.toLocaleString()}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-muted-foreground">صافي المديونية</p>
                  <p
                    className={`font-bold text-lg ${
                      netDebt > 0
                        ? "text-red-600"
                        : netDebt < 0
                          ? "text-green-600"
                          : ""
                    }`}
                  >
                    {netDebt.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ========== Invoice Preview Modal ========== */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent
          dir="rtl"
          className="max-w-lg max-h-[85vh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              {previewInvoice ? `فاتورة #${previewInvoice.id}` : "عرض الفاتورة"}
            </DialogTitle>
          </DialogHeader>

          {previewLoading && (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!previewLoading && !previewInvoice && (
            <p className="text-center text-muted-foreground py-6">
              لم يتم العثور على الفاتورة
            </p>
          )}

          {!previewLoading && previewInvoice && (
            <div className="space-y-4 text-sm">
              {/* Header info */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-muted-foreground text-xs">العميل</p>
                  <p className="font-medium">
                    {previewInvoice.customer_name || "نقدي"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">التاريخ</p>
                  <p className="font-medium">
                    {new Date(previewInvoice.invoice_date).toLocaleDateString(
                      "ar-EG",
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">النوع</p>
                  <p className="font-medium">
                    {previewInvoice.invoice_type === "retail"
                      ? "قطاعي"
                      : "جملة"}
                    {previewInvoice.is_return && (
                      <Badge className="bg-orange-500 mr-2 text-xs">
                        مرتجع
                      </Badge>
                    )}
                  </p>
                </div>
                {previewInvoice.customer_phone && (
                  <div>
                    <p className="text-muted-foreground text-xs">الهاتف</p>
                    <p className="font-medium">
                      {previewInvoice.customer_phone}
                    </p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Items table */}
              {previewInvoice.items && previewInvoice.items.length > 0 && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right text-xs">
                          الصنف
                        </TableHead>
                        <TableHead className="text-center text-xs">
                          العبوة
                        </TableHead>
                        <TableHead className="text-center text-xs">
                          الكمية
                        </TableHead>
                        <TableHead className="text-center text-xs">
                          السعر
                        </TableHead>
                        <TableHead className="text-center text-xs">
                          الخصم
                        </TableHead>
                        <TableHead className="text-center text-xs">
                          الإجمالي
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewInvoice.items.map((item: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell className="text-right text-xs">
                            {item.product_name}
                            {item.manufacturer && (
                              <span className="text-muted-foreground">
                                {" "}
                                - {item.manufacturer}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-center text-xs">
                            {item.package}
                          </TableCell>
                          <TableCell className="text-center text-xs">
                            {item.quantity}
                          </TableCell>
                          <TableCell className="text-center text-xs">
                            {Number(item.price).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-center text-xs">
                            {Number(item.discount || 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-center text-xs">
                            {Number(item.total).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <Separator />

              {/* Totals */}
              <div className="space-y-1.5">
                {previewInvoice.subtotal && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      الإجمالي قبل الخصم
                    </span>
                    <span>
                      {Number(previewInvoice.subtotal).toLocaleString()}
                    </span>
                  </div>
                )}
                {Number(previewInvoice.items_discount || 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">خصم الأصناف</span>
                    <span className="text-red-500">
                      -{Number(previewInvoice.items_discount).toLocaleString()}
                    </span>
                  </div>
                )}
                {Number(previewInvoice.extra_discount || 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">خصم إضافي</span>
                    <span className="text-red-500">
                      -{Number(previewInvoice.extra_discount).toLocaleString()}
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base">
                  <span>الإجمالي</span>
                  <span>{Number(previewInvoice.total).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">المدفوع</span>
                  <span className="text-green-600">
                    {Number(previewInvoice.paid_amount).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">المتبقي</span>
                  <span className="text-red-600">
                    {Number(previewInvoice.remaining_amount).toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Created/Updated by */}
              {(previewInvoice.created_by_name ||
                previewInvoice.updated_by_name) && (
                <>
                  <Separator />
                  <div className="text-xs text-muted-foreground space-y-1">
                    {previewInvoice.created_by_name && (
                      <p>أنشأها: {previewInvoice.created_by_name}</p>
                    )}
                    {previewInvoice.updated_by_name && (
                      <p>آخر تعديل: {previewInvoice.updated_by_name}</p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
