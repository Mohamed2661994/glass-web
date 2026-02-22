"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import api from "@/services/api";

const ROWS_PER_PAGE = 20;

const chunkItems = <T,>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

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

interface InvoiceData {
  id: number;
  invoice_type: "retail" | "wholesale";
  movement_type: "sale" | "purchase";
  invoice_date: string;
  customer_name: string;
  customer_phone: string;
  subtotal: number;
  items_discount: number;
  extra_discount: number;
  manual_discount: number;
  discount_total: number;
  total: number;
  previous_balance: number;
  paid_amount: number;
  remaining_amount: number;
  payment_status: string;
  apply_items_discount: boolean;
  items: InvoiceItem[];
}

export default function InvoicePrintPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <p>جاري التحميل...</p>
        </div>
      }
    >
      <InvoicePrintPage />
    </Suspense>
  );
}

function InvoicePrintPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const isPreview = searchParams.get("preview") === "1";
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const res = await api.get(`/invoices/${id}/edit`);
        setInvoice(res.data);
      } catch {
        setError("فشل تحميل الفاتورة");
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchInvoice();
  }, [id]);

  useEffect(() => {
    if (invoice && !loading && !isPreview) {
      setTimeout(() => window.print(), 500);
    }
  }, [invoice, loading, isPreview]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>جاري التحميل...</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>{error || "الفاتورة غير موجودة"}</p>
      </div>
    );
  }

  /* ──────────── حسابات ──────────── */

  const items = invoice.items || [];
  const pages = chunkItems(items, ROWS_PER_PAGE);
  const totalPages = pages.length;

  const isWholesale = invoice.invoice_type === "wholesale";

  const calcUnitPrice = (it: InvoiceItem) =>
    isWholesale || invoice.apply_items_discount
      ? Number(it.price) - Number(it.discount || 0)
      : Number(it.price);

  const calcItemTotal = (it: InvoiceItem) =>
    calcUnitPrice(it) * Number(it.quantity || 0);

  const itemsSubtotal = items.reduce(
    (sum, it) =>
      it.is_return
        ? sum - Math.abs(calcItemTotal(it))
        : sum + calcItemTotal(it),
    0,
  );

  const extraDiscount = Number(
    invoice.manual_discount ?? invoice.extra_discount ?? 0,
  );
  const previousBalance = Number(invoice.previous_balance) || 0;
  const paidAmount = Number(invoice.paid_amount) || 0;

  const invoiceTotal = itemsSubtotal;
  const totalWithPrevious = invoiceTotal + previousBalance;
  const netTotal = totalWithPrevious - extraDiscount;
  const remaining = netTotal - paidAmount;

  const totalQty = items.reduce(
    (sum, it) => (it.is_return ? sum : sum + Number(it.quantity || 0)),
    0,
  );

  const formatPackage = (it: InvoiceItem) => {
    const raw = it.package ?? "";
    if (!raw) return "-";
    let text = String(raw).replace("كرتونة", "").trim();
    let match = text.match(/^([^\d]+)\s*(\d+)$/);
    if (match) return `${match[2]} ${match[1].trim()}`;
    match = text.match(/^(\d+)\s*([^\d]+)$/);
    if (match) return `${match[1]} ${match[2].trim()}`;
    return text;
  };

  const formattedDate = invoice.invoice_date
    ? new Date(invoice.invoice_date).toLocaleDateString("ar-EG")
    : "-";

  return (
    <>
      {/* eslint-disable-next-line react/no-unknown-property */}
      <style>{`
/* ===== عرض عادي (على الشاشة) ===== */
body { background: #e5e5e5; font-family: Tahoma, Arial; }

.no-print { text-align: center; margin: 16px; }
.no-print button {
  padding: 8px 24px;
  margin: 0 6px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  border: 1px solid #ccc;
  background: #fff;
}
.no-print button.primary { background: #000; color: #fff; border: none; }

.spread {
  display: flex;
  gap: 20px;
  justify-content: center;
  align-items: flex-start;
  margin: 20px;
}

.page {
  width: 148mm;
  min-height: 210mm;
  background: white;
  color: #000 !important;
  padding: 10mm;
  box-shadow: 0 0 15px rgba(0,0,0,0.15);
  box-sizing: border-box;
  direction: rtl;
}

.page * { color: #000 !important; }

.invoice-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.invoice-info {
  font-size: 10px;
  line-height: 1.4;
  text-align: right;
  min-width: 170px;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 10px;
}

th {
  background: #f3f3f3;
  font-weight: bold;
  border-bottom: 2px solid #000;
}

td { border-bottom: 1px solid #ddd; }

th, td { padding: 3px 4px; text-align: center; }

/* ===== إعدادات الورق ===== */
@page { size: A5 portrait; margin: 0; }

/* ===== الطباعة ===== */
@media print {
  body * { visibility: hidden; }

  .spread, .spread * { visibility: visible; }

  body { margin: 0; padding: 0; background: white; }

  .no-print { display: none !important; }

  .spread {
    display: block !important;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    margin: 0;
    padding: 0;
    gap: 0 !important;
  }

  .page {
    display: block;
    width: 148mm;
    height: 210mm;
    margin: 0 auto;
    box-shadow: none;
    page-break-after: always;
    break-after: page;
    overflow: visible;
  }

  .page:first-child { page-break-before: auto; break-before: auto; }
  .page:last-child  { page-break-after: auto;  break-after: auto;  }

  table { page-break-inside: auto; break-inside: auto; }
  tr    { page-break-inside: avoid; break-inside: avoid; }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
}
      `}</style>

      {/* ===== أزرار الطباعة ===== */}
      <div className="no-print">
        <button className="primary" onClick={() => window.print()}>
          طباعة
        </button>
        <button onClick={() => window.close()}>إغلاق</button>
      </div>

      {/* ===== الصفحات ===== */}
      <div className="spread">
        {pages.map((pageItems, pageIndex) => {
          const isLastPage = pageIndex === totalPages - 1;

          return (
            <div className="page" key={pageIndex}>
              {/* ✅ HEADER – أول صفحة فقط */}
              {pageIndex === 0 && (
                <>
                  <div className="invoice-header">
                    {/* بيانات الفاتورة يمين */}
                    <div className="invoice-info">
                      <div>
                        <b>رقم الفاتورة:</b> {invoice.id}
                      </div>
                      <div>
                        <b>التاريخ:</b> {formattedDate}
                      </div>
                      <div>
                        <b>العميل:</b> {invoice.customer_name || "نقدي"}
                      </div>
                      {invoice.customer_phone && (
                        <div>
                          <b>تليفون:</b> {invoice.customer_phone}
                        </div>
                      )}
                    </div>

                    {/* اللوجو شمال */}
                    <img
                      src="/logo-dark.png"
                      alt="Logo"
                      style={{ width: 65 }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>

                  <hr
                    style={{
                      border: "none",
                      borderTop: "2px solid #000",
                      marginBottom: 10,
                    }}
                  />
                </>
              )}

              {/* ===== جدول الأصناف ===== */}
              <table>
                <thead>
                  <tr>
                    <th>م</th>
                    <th>الصنف</th>
                    <th>العبوة</th>
                    <th>الكمية</th>
                    <th>السعر</th>
                    <th>الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((it, i) => {
                    const displayQty = it.is_return
                      ? -Math.abs(it.quantity)
                      : it.quantity;
                    const displayTotal = it.is_return
                      ? -Math.abs(Math.round(calcItemTotal(it)))
                      : Math.round(calcItemTotal(it));

                    return (
                      <tr
                        key={i}
                        style={
                          it.is_return
                            ? { color: "red !important", background: "#fff5f5" }
                            : undefined
                        }
                      >
                        <td>{pageIndex * ROWS_PER_PAGE + i + 1}</td>
                        <td>
                          {it.product_name}
                          {it.manufacturer ? ` - ${it.manufacturer}` : ""}
                          {it.is_return && (
                            <span
                              style={{
                                color: "red",
                                fontSize: 10,
                                marginRight: 4,
                              }}
                            >
                              (مرتجع)
                            </span>
                          )}
                        </td>
                        <td>{formatPackage(it)}</td>
                        <td style={it.is_return ? { color: "red" } : undefined}>
                          {displayQty}
                        </td>
                        <td>{Math.round(calcUnitPrice(it))}</td>
                        <td style={it.is_return ? { color: "red" } : undefined}>
                          {displayTotal}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {isLastPage && (
                  <tfoot>
                    <tr style={{ fontWeight: "bold", background: "#fafafa" }}>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td>{totalQty}</td>
                      <td></td>
                      <td>{Math.round(itemsSubtotal)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>

              {/* ===== التوتالز – آخر صفحة فقط ===== */}
              {isLastPage && (
                <div
                  style={{
                    marginTop: 4,
                    paddingTop: 4,
                    borderTop: "2px solid #000",
                    width: "55%",
                    marginLeft: 0,
                    marginRight: "auto",
                    fontSize: 11,
                    lineHeight: 1.5,
                    textAlign: "left",
                  }}
                >
                  {previousBalance !== 0 && (
                    <div>حساب سابق: {previousBalance.toFixed(2)}</div>
                  )}

                  {extraDiscount > 0 && (
                    <div>خصم : {extraDiscount.toFixed(2)}</div>
                  )}

                  <div>
                    <b>الصافي: {netTotal.toFixed(2)}</b>
                  </div>

                  {paidAmount !== 0 && (
                    <div>المدفوع: {paidAmount.toFixed(2)}</div>
                  )}

                  {remaining !== 0 && (
                    <div style={{ fontSize: 13 }}>
                      <b>المتبقي: {remaining.toFixed(2)}</b>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
