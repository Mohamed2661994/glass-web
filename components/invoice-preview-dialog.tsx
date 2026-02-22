"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Printer, X } from "lucide-react";

/* ─────────── Types ─────────── */

export interface PreviewItem {
  product_name: string;
  manufacturer?: string;
  package?: string;
  price: number;
  quantity: number;
  discount?: number;
  is_return?: boolean;
}

export interface InvoicePreviewData {
  invoiceType: "retail" | "wholesale";
  movementType: "sale" | "purchase";
  invoiceDate: string;
  customerName: string;
  customerPhone?: string;
  items: PreviewItem[];
  applyItemsDiscount?: boolean; // retail only
  extraDiscount: number;
  previousBalance: number;
  paidAmount: number;
}

/* ─────────── Helpers ─────────── */

const calcUnitPrice = (
  it: PreviewItem,
  isWholesale: boolean,
  applyItemsDiscount: boolean,
) => {
  if (isWholesale || applyItemsDiscount)
    return Number(it.price) - Number(it.discount || 0);
  return Number(it.price);
};

const calcItemTotal = (
  it: PreviewItem,
  isWholesale: boolean,
  applyItemsDiscount: boolean,
) => {
  if (isWholesale) {
    // wholesale: total = price * qty - discount (total discount)
    return (
      Number(it.price) * Number(it.quantity || 0) - Number(it.discount || 0)
    );
  }
  // retail
  return (
    calcUnitPrice(it, false, applyItemsDiscount) * Number(it.quantity || 0)
  );
};

const formatPackage = (raw: string) => {
  if (!raw) return "-";
  let text = String(raw).replace("كرتونة", "").trim();
  let match = text.match(/^([^\d]+)\s*(\d+)$/);
  if (match) return `${match[2]} ${match[1].trim()}`;
  match = text.match(/^(\d+)\s*([^\d]+)$/);
  if (match) return `${match[1]} ${match[2].trim()}`;
  return text;
};

/* ─────────── Component ─────────── */

export function InvoicePreviewDialog({
  open,
  onOpenChange,
  data,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: InvoicePreviewData;
  onSave?: () => void;
  saving?: boolean;
}) {
  const printRef = useRef<HTMLDivElement>(null);
  const [printBold, setPrintBold] = useState(false);
  const [printColor, setPrintColor] = useState("#000000");

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

  if (!data) return null;

  const isWholesale = data.invoiceType === "wholesale";
  const applyDiscount = data.applyItemsDiscount ?? true;

  const items = data.items || [];

  const itemsSubtotal = items.reduce((sum, it) => {
    const t = calcItemTotal(it, isWholesale, applyDiscount);
    return it.is_return ? sum - Math.abs(t) : sum + t;
  }, 0);

  const extraDiscount = Number(data.extraDiscount) || 0;
  const previousBalance = Number(data.previousBalance) || 0;
  const paidAmount = Number(data.paidAmount) || 0;

  const invoiceTotal = itemsSubtotal;
  const totalWithPrevious = invoiceTotal + previousBalance;
  const netTotal = totalWithPrevious - extraDiscount;
  const remaining = netTotal - paidAmount;

  const totalQty = items.reduce(
    (sum, it) => (it.is_return ? sum : sum + Number(it.quantity || 0)),
    0,
  );

  const formattedDate = data.invoiceDate
    ? new Date(data.invoiceDate).toLocaleDateString("ar-EG")
    : "-";

  /* Print only the preview section */
  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`<!DOCTYPE html>
<html dir="rtl">
<head>
  <meta charset="utf-8" />
  <title>معاينة الفاتورة</title>
  <style>
    body { margin: 0; padding: 0; background: white; font-family: Tahoma, Arial; }
    .invoice-wrap {
      width: 148mm;
      margin: 0 auto;
      padding: 10mm;
      box-sizing: border-box;
      direction: rtl;
      color: ${printColor};
      ${printBold ? 'font-weight: bold;' : ''}
    }
    .invoice-wrap * { color: ${printColor}; }
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
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th { background: #f3f3f3; font-weight: bold; border-bottom: 2px solid ${printColor}; }
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
    .draft-badge {
      text-align: center;
      padding: 4px 8px;
      margin-bottom: 8px;
      border: 2px dashed #999;
      font-size: 12px;
      color: #999;
    }
    @page { size: A5 portrait; margin: 8mm; }
    @media print {
      .invoice-wrap { width: 100%; margin: 0; padding: 0; }
      table { page-break-inside: auto; break-inside: auto; }
      tr { page-break-inside: avoid; break-inside: avoid; }
      thead { display: table-header-group; }
      .totals-section { break-inside: avoid; }
    }
  </style>
</head>
<body>
  ${content.innerHTML}
  <script>window.onload=function(){window.print();}<\/script>
</body>
</html>`);
    printWindow.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="sm:max-w-4xl h-[90vh] p-0 flex flex-col overflow-hidden"
      >
        <DialogHeader className="p-4 pb-2 shrink-0 border-b">
          <DialogTitle className="flex items-center gap-2">
            معاينة الفاتورة
            <span className="text-xs font-normal text-muted-foreground border border-dashed rounded px-2 py-0.5">
              مسودة — لم يتم الحفظ بعد
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* ===== Scrollable invoice preview ===== */}
        <div
          className="flex-1 overflow-auto bg-neutral-100 dark:bg-neutral-900 p-4"
          style={{ minHeight: 0 }}
        >
          <div
            ref={printRef}
            className="invoice-wrap bg-white mx-auto shadow-md"
            style={{
              width: "148mm",
              padding: "10mm",
              boxSizing: "border-box",
              direction: "rtl",
              fontFamily: "Tahoma, Arial",
              color: printColor,
              fontWeight: printBold ? "bold" : "normal",
            }}
          >
            {/* Draft badge */}
            <div
              style={{
                textAlign: "center",
                padding: "4px 8px",
                marginBottom: 8,
                border: "2px dashed #999",
                fontSize: 12,
                color: "#999",
              }}
            >
              معاينة — لم يتم الحفظ بعد
            </div>

            {/* HEADER */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  lineHeight: 1.4,
                  textAlign: "right",
                  minWidth: 170,
                  color: printColor,
                }}
              >
                <div>
                  <b>التاريخ:</b> {formattedDate}
                </div>
                <div>
                  <b>العميل:</b> {data.customerName || "نقدي"}
                </div>
                {data.customerPhone && (
                  <div>
                    <b>تليفون:</b> {data.customerPhone}
                  </div>
                )}
                <div>
                  <b>النوع:</b> {data.movementType === "sale" ? "بيع" : "شراء"}{" "}
                  — {isWholesale ? "جملة" : "قطاعي"}
                </div>
              </div>

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
                borderTop: `2px solid ${printColor}`,
                marginBottom: 10,
              }}
            />

            {/* ITEMS TABLE */}
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 10,
                color: printColor,
              }}
            >
              <thead>
                <tr>
                  {["م", "الصنف", "العبوة", "الكمية", "السعر", "الإجمالي"].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          background: "#f3f3f3",
                          fontWeight: "bold",
                          borderBottom: `2px solid ${printColor}`,
                          padding: "3px 4px",
                          textAlign: "center",
                          color: printColor,
                        }}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => {
                  const unitPrice = isWholesale
                    ? Number(it.price)
                    : Math.round(calcUnitPrice(it, false, applyDiscount));
                  const itemTotal = calcItemTotal(
                    it,
                    isWholesale,
                    applyDiscount,
                  );
                  const displayQty = it.is_return
                    ? -Math.abs(it.quantity)
                    : it.quantity;
                  const displayTotal = it.is_return
                    ? -Math.abs(Math.round(itemTotal))
                    : Math.round(itemTotal);

                  const tdStyle = (isReturn: boolean) => ({
                    borderBottom: "1px solid #ddd",
                    padding: "3px 4px",
                    textAlign: "center" as const,
                    color: isReturn ? "red" : printColor,
                  });

                  return (
                    <tr
                      key={i}
                      style={
                        it.is_return
                          ? { color: "red", background: "#fff5f5" }
                          : undefined
                      }
                    >
                      <td style={tdStyle(!!it.is_return)}>{i + 1}</td>
                      <td style={tdStyle(!!it.is_return)}>
                        {it.product_name}
                        {it.manufacturer && it.manufacturer !== "-"
                          ? ` - ${it.manufacturer}`
                          : ""}
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
                      <td style={tdStyle(!!it.is_return)}>
                        {formatPackage(it.package ?? "")}
                      </td>
                      <td style={tdStyle(!!it.is_return)}>{displayQty}</td>
                      <td style={tdStyle(!!it.is_return)}>
                        {Math.round(unitPrice)}
                      </td>
                      <td style={tdStyle(!!it.is_return)}>{displayTotal}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr
                  style={{
                    fontWeight: "bold",
                    background: "#fafafa",
                    color: printColor,
                  }}
                >
                  <td style={{ padding: "3px 4px", color: printColor }}></td>
                  <td style={{ padding: "3px 4px", color: printColor }}></td>
                  <td style={{ padding: "3px 4px", color: printColor }}></td>
                  <td
                    style={{
                      padding: "3px 4px",
                      textAlign: "center",
                      color: printColor,
                    }}
                  >
                    {totalQty}
                  </td>
                  <td style={{ padding: "3px 4px", color: printColor }}></td>
                  <td
                    style={{
                      padding: "3px 4px",
                      textAlign: "center",
                      color: printColor,
                    }}
                  >
                    {Math.round(itemsSubtotal)}
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* TOTALS */}
            <div
              style={{
                marginTop: 4,
                paddingTop: 4,
                borderTop: `2px solid ${printColor}`,
                width: "55%",
                marginLeft: 0,
                marginRight: "auto",
                fontSize: 11,
                lineHeight: 1.5,
                textAlign: "left",
                color: printColor,
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
          </div>
        </div>

        {/* ===== Action buttons ===== */}
        <div className="flex gap-3 p-4 pt-2 border-t shrink-0">
          {onSave && (
            <Button
              className="flex-1"
              onClick={() => {
                onOpenChange(false);
                onSave();
              }}
              disabled={saving}
            >
              {saving ? "جارٍ الحفظ..." : "حفظ الفاتورة"}
            </Button>
          )}
          <Button variant="secondary" className="flex-1" onClick={handlePrint}>
            <Printer className="h-4 w-4 ml-2" />
            طباعة المعاينة
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4 ml-2" />
            رجوع للتعديل
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
