"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import axios from "@/services/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { shareInvoiceWhatsApp, type WhatsAppInvoice } from "@/lib/export-utils";

interface InvoiceItem {
  product_id: number;
  product_name: string;
  package: string;
  price: number;
  quantity: number;
  discount: number;
  total: number;
  manufacturer: string;
  is_return?: boolean;
}

export default function InvoiceDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const [invoice, setInvoice] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sharing, setSharing] = useState(false);

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
      <div className="p-4 md:p-6 space-y-6" dir="rtl">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-40" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
        <div className="flex gap-3">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
    );
  if (!invoice) return <div className="p-6">الفاتورة غير موجودة</div>;

  const items: InvoiceItem[] = invoice.items || [];
  const isWholesale = invoice.invoice_type === "wholesale";

  const calcUnitPrice = (it: InvoiceItem) =>
    isWholesale || invoice.apply_items_discount
      ? Number(it.price) - Number(it.discount || 0)
      : Number(it.price);

  const calcItemTotal = (it: InvoiceItem) =>
    calcUnitPrice(it) * Number(it.quantity || 0);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto" dir="rtl">
      <h1 className="text-xl md:text-2xl font-bold">
        تفاصيل الفاتورة #{invoice.id}
        {invoice.is_return && (
          <Badge className="bg-orange-500 mr-3 text-sm">مرتجع</Badge>
        )}
      </h1>

      {/* Invoice Info */}
      <Card>
        <CardContent className="p-4 space-y-2">
          {invoice.movement_type === "purchase" ? (
            <>
              {invoice.supplier_name && (
                <p>
                  <strong>المورد:</strong> {invoice.supplier_name}
                </p>
              )}
              {invoice.supplier_phone && (
                <p>
                  <strong>هاتف المورد:</strong> {invoice.supplier_phone}
                </p>
              )}
            </>
          ) : (
            <>
              <p>
                <strong>العميل:</strong> {invoice.customer_name || "نقدي"}
              </p>
              {invoice.customer_phone && (
                <p>
                  <strong>هاتف العميل:</strong> {invoice.customer_phone}
                </p>
              )}
            </>
          )}
          <p>
            <strong>الإجمالي:</strong> {Number(invoice.total).toFixed(2)}
          </p>
          <p>
            <strong>المدفوع:</strong> {Number(invoice.paid_amount).toFixed(2)}
          </p>
          <p>
            <strong>المتبقي:</strong>{" "}
            {Number(invoice.remaining_amount).toFixed(2)}
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

      {/* Invoice Items */}
      {items.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h2 className="text-lg font-semibold">الأصناف ({items.length})</h2>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-2 text-right">#</th>
                    <th className="p-2 text-right">الصنف</th>
                    <th className="p-2 text-right">العبوة</th>
                    <th className="p-2 text-right">السعر</th>
                    {(isWholesale || invoice.apply_items_discount) && (
                      <th className="p-2 text-right">الخصم</th>
                    )}
                    <th className="p-2 text-right">صافي السعر</th>
                    <th className="p-2 text-right">الكمية</th>
                    <th className="p-2 text-right">الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => {
                    const unitPrice = calcUnitPrice(item);
                    const itemTotal = calcItemTotal(item);
                    return (
                      <tr
                        key={idx}
                        className={`border-b hover:bg-muted/50 ${item.is_return ? "bg-orange-50 dark:bg-orange-950/20" : ""}`}
                      >
                        <td className="p-2">{idx + 1}</td>
                        <td className="p-2">
                          {item.product_name}
                          {item.is_return && (
                            <Badge className="bg-orange-500 mr-2 text-[10px] px-1 py-0">
                              مرتجع
                            </Badge>
                          )}
                        </td>
                        <td className="p-2 text-muted-foreground">
                          {item.package || "-"}
                        </td>
                        <td className="p-2">{Number(item.price).toFixed(2)}</td>
                        {(isWholesale || invoice.apply_items_discount) && (
                          <td className="p-2 text-red-500">
                            {Number(item.discount || 0).toFixed(2)}
                          </td>
                        )}
                        <td className="p-2">{unitPrice.toFixed(2)}</td>
                        <td className="p-2">{item.quantity}</td>
                        <td className="p-2 font-semibold">
                          {item.is_return ? "-" : ""}
                          {Math.abs(itemTotal).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-2">
              {items.map((item, idx) => {
                const unitPrice = calcUnitPrice(item);
                const itemTotal = calcItemTotal(item);
                return (
                  <div
                    key={idx}
                    className={`border rounded-lg p-3 space-y-1 ${item.is_return ? "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">
                        {idx + 1}. {item.product_name}
                      </span>
                      {item.is_return && (
                        <Badge className="bg-orange-500 text-[10px] px-1.5 py-0">
                          مرتجع
                        </Badge>
                      )}
                    </div>
                    {item.package && (
                      <p className="text-xs text-muted-foreground">
                        العبوة: {item.package}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {unitPrice.toFixed(2)} × {item.quantity}
                      </span>
                      <span className="font-semibold">
                        {item.is_return ? "-" : ""}
                        {Math.abs(itemTotal).toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3 flex-wrap">
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
        <Button variant="outline" onClick={() => setPreviewOpen(true)}>
          معاينة
        </Button>
        <Button
          onClick={() => window.open(`/invoices/${invoice.id}/print`, "_blank")}
        >
          طباعة
        </Button>

        {/* WhatsApp Share */}
        {(invoice.customer_phone || invoice.supplier_phone) && (
          <Button
            variant="outline"
            className="gap-2 text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-950/20"
            disabled={sharing}
            onClick={async () => {
              setSharing(true);
              try {
                const result = await shareInvoiceWhatsApp({
                  id: invoice.id,
                  customer_name: invoice.customer_name,
                  customer_phone: invoice.customer_phone,
                  supplier_name: invoice.supplier_name,
                  supplier_phone: invoice.supplier_phone,
                  movement_type: invoice.movement_type,
                  invoice_date: invoice.invoice_date,
                  total: invoice.total,
                  paid_amount: invoice.paid_amount,
                  remaining_amount: invoice.remaining_amount,
                  extra_discount: invoice.extra_discount,
                  manual_discount: invoice.manual_discount,
                  items: items.map((it) => ({
                    product_name: it.product_name,
                    package: it.package,
                    price: it.price,
                    quantity: it.quantity,
                    discount: it.discount,
                    total: it.total,
                    is_return: it.is_return,
                  })),
                } as WhatsAppInvoice);
                if (result === "shared") {
                  toast.success("تم المشاركة بنجاح");
                } else if (result === "whatsapp_opened") {
                  toast.success(
                    "تم تنزيل PDF الفاتورة — ارفقها في المحادثة",
                    { duration: 6000 },
                  );
                }
              } catch {
                toast.error("فشل إرسال الفاتورة");
              } finally {
                setSharing(false);
              }
            }}
          >
            {sharing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            )}
            إرسال عبر واتساب
          </Button>
        )}
      </div>

      {/* Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent
          dir="rtl"
          className="sm:max-w-4xl h-[90vh] p-0 flex flex-col overflow-hidden gap-0"
        >
          <iframe
            src={`/invoices/${invoice?.id}/print?preview=1`}
            className="flex-1 w-full border-0"
            style={{ minHeight: 0 }}
          />
          <div className="flex gap-2 p-3 border-t shrink-0 bg-white dark:bg-neutral-950">
            <Button
              className="flex-1"
              onClick={() => {
                window.open(`/invoices/${invoice?.id}/print`, "_blank");
                setPreviewOpen(false);
              }}
            >
              طباعة
            </Button>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
