"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import api from "@/services/api";

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
  const [printBold, setPrintBold] = useState(false);
  const [printColor, setPrintColor] = useState("#000000");
  const [copies, setCopies] = useState(1);
  const [isPrinting, setIsPrinting] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("appSettings");
      if (raw) {
        const s = JSON.parse(raw);
        if (s.printBold !== undefined) setPrintBold(s.printBold);
        if (s.printColor) setPrintColor(s.printColor);
      }
    } catch {}
  }, []);

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

  /* ──── طباعة عبر iframe مخفي ──── */
  const handlePrint = useCallback(() => {
    if (!invoiceRef.current || isPrinting) return;
    setIsPrinting(true);

    const html = invoiceRef.current.innerHTML;
    const printCSS = `
      <style>
        body { margin: 0; padding: 0; background: white; font-family: Tahoma, Arial; direction: rtl; }
        * { color: ${printColor} !important; }
        .invoice-wrap {
          width: 100%; margin: 0; padding: 8mm; box-sizing: border-box;
          direction: rtl; ${printBold ? "font-weight: bold;" : ""}
          color: ${printColor} !important;
        }
        .invoice-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
        .invoice-info { font-size: 10px; line-height: 1.4; text-align: right; min-width: 170px; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        th { background: #f3f3f3; font-weight: bold; border-bottom: 2px solid ${printColor}; }
        td { border-bottom: 1px solid #ddd; }
        th, td { padding: 3px 4px; text-align: center; }
        .totals-section {
          margin-top: 4px; padding-top: 4px;
          border-top: 2px solid ${printColor};
          width: 55%; margin-left: 0; margin-right: auto;
          font-size: 11px; line-height: 1.5; text-align: left;
        }
        .totals-remaining { font-size: 13px; }
        hr { border: none; border-top: 2px solid #000; margin-bottom: 10px; }
        @page { size: A5 portrait; margin: 8mm; }
        table { page-break-inside: auto; break-inside: auto; }
        tr { page-break-inside: avoid; break-inside: avoid; }
        thead { display: table-header-group; }
        tfoot { display: table-row-group; }
        .totals-section { break-inside: avoid; }
      </style>
    `;

    // Build pages for copies
    let pagesHtml = "";
    for (let c = 0; c < copies; c++) {
      pagesHtml += `<div class="invoice-wrap" ${c > 0 ? 'style="page-break-before: always;"' : ""}>${html}</div>`;
    }

    const fullHtml = `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8">${printCSS}</head><body>${pagesHtml}</body></html>`;

    const iframe = iframeRef.current;
    if (!iframe) { setIsPrinting(false); return; }

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) { setIsPrinting(false); return; }

    doc.open();
    doc.write(fullHtml);
    doc.close();

    // Wait for images to load then print
    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.print();
        } catch {
          window.print();
        }
        setIsPrinting(false);
      }, 300);
    };

    // Fallback timeout
    setTimeout(() => {
      try { iframe.contentWindow?.print(); } catch {}
      setIsPrinting(false);
    }, 2000);
  }, [copies, isPrinting, printBold, printColor]);

  /* ──── Auto-print if setting enabled ──── */
  useEffect(() => {
    if (invoice && !loading && !isPreview) {
      try {
        const raw = localStorage.getItem("appSettings");
        if (raw) {
          const s = JSON.parse(raw);
          if (s.autoPrint === false) return;
        }
      } catch {}
      setTimeout(() => handlePrint(), 600);
    }
  }, [invoice, loading, isPreview, handlePrint]);

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
/* ===== الخلفية ===== */
body { background: #f0f0f0; font-family: Tahoma, Arial; margin: 0; }

/* ===== شريط التحكم ===== */
.print-toolbar {
  position: fixed;
  top: 0; left: 0; right: 0;
  z-index: 1000;
  background: #1e293b;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 10px 20px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.25);
  direction: rtl;
  flex-wrap: wrap;
}

.print-toolbar label {
  color: #94a3b8;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.print-toolbar input[type="number"] {
  width: 56px;
  padding: 5px 8px;
  border-radius: 6px;
  border: 1px solid #475569;
  background: #334155;
  color: #fff;
  font-size: 14px;
  text-align: center;
  outline: none;
}
.print-toolbar input[type="number"]:focus {
  border-color: #60a5fa;
  box-shadow: 0 0 0 2px rgba(96,165,250,0.3);
}

.toolbar-btn {
  padding: 8px 28px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  border: none;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  gap: 6px;
}
.toolbar-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.toolbar-btn.primary {
  background: #3b82f6;
  color: #fff;
}
.toolbar-btn.primary:hover:not(:disabled) {
  background: #2563eb;
}
.toolbar-btn.secondary {
  background: #475569;
  color: #fff;
}
.toolbar-btn.secondary:hover {
  background: #64748b;
}

.toolbar-separator {
  width: 1px;
  height: 28px;
  background: #475569;
}

/* ===== منطقة المعاينة ===== */
.preview-area {
  padding-top: 70px;
  padding-bottom: 30px;
  display: flex;
  justify-content: center;
}

.invoice-wrap {
  width: 148mm;
  background: white;
  color: ${printColor} !important;
  padding: 10mm;
  box-shadow: 0 4px 24px rgba(0,0,0,0.12);
  box-sizing: border-box;
  direction: rtl;
  border-radius: 2px;
  ${printBold ? "font-weight: bold;" : ""}
}

.invoice-wrap * { color: ${printColor} !important; }

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
  border-bottom: 2px solid ${printColor};
}

td { border-bottom: 1px solid #ddd; }

th, td { padding: 3px 4px; text-align: center; }

.totals-section {
  margin-top: 4px;
  padding-top: 4px;
  border-top: 2px solid ${printColor};
  width: 55%;
  margin-left: 0;
  margin-right: auto;
  font-size: 11px;
  line-height: 1.5;
  text-align: left;
}

.totals-remaining { font-size: 13px; }

/* ===== iframe مخفي ===== */
.print-iframe {
  position: fixed;
  top: -9999px;
  left: -9999px;
  width: 0;
  height: 0;
  border: none;
}

/* ===== الطباعة – إخفاء كل شيء ما عدا الفاتورة ===== */
@page { size: A5 portrait; margin: 8mm; }

@media print {
  body { margin: 0; padding: 0; background: white; }
  .print-toolbar { display: none !important; }
  .preview-area { padding-top: 0; padding-bottom: 0; }
  .invoice-wrap {
    width: 100%; margin: 0; padding: 0;
    box-shadow: none; border-radius: 0;
  }
  table { page-break-inside: auto; break-inside: auto; }
  tr    { page-break-inside: avoid; break-inside: avoid; }
  thead { display: table-header-group; }
  tfoot { display: table-row-group; }
  .totals-section { break-inside: avoid; }
}
      `}</style>

      {/* ===== iframe مخفي للطباعة ===== */}
      <iframe ref={iframeRef} className="print-iframe" title="print-frame" />

      {/* ===== شريط التحكم بالطباعة ===== */}
      <div className="print-toolbar">
        <button
          className="toolbar-btn primary"
          onClick={handlePrint}
          disabled={isPrinting}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          {isPrinting ? "جاري الطباعة..." : "طباعة"}
        </button>

        <div className="toolbar-separator" />

        <label>
          عدد النسخ:
          <input
            type="number"
            min={1}
            max={10}
            value={copies}
            onChange={(e) => setCopies(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
          />
        </label>

        <div className="toolbar-separator" />

        <button
          className="toolbar-btn secondary"
          onClick={() => window.history.back()}
        >
          رجوع
        </button>
      </div>

      {/* ===== منطقة المعاينة ===== */}
      <div className="preview-area">
        <div className="invoice-wrap" ref={invoiceRef}>
          {/* ✅ HEADER */}
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
              {items.map((it, i) => {
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
                    <td>{i + 1}</td>
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
          </table>

          {/* ===== التوتالز ===== */}
          <div className="totals-section">
            {previousBalance !== 0 && (
              <div>حساب سابق: {previousBalance.toFixed(2)}</div>
            )}

            {extraDiscount > 0 && <div>خصم : {extraDiscount.toFixed(2)}</div>}

            <div>
              <b>الصافي: {netTotal.toFixed(2)}</b>
            </div>

            {paidAmount !== 0 && <div>المدفوع: {paidAmount.toFixed(2)}</div>}

            {remaining !== 0 && (
              <div className="totals-remaining">
                <b>المتبقي: {remaining.toFixed(2)}</b>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
