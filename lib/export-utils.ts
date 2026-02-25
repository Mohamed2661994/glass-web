import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

/* ================================================================
   Export Utilities — Excel & PDF
   ================================================================ */

/**
 * Export data to Excel (.xlsx)
 * @param columns  — array of { header: string; key: string; width?: number }
 * @param rows     — array of objects
 * @param filename — file name without extension
 * @param sheetName — optional sheet name
 */
export function exportToExcel<T extends Record<string, unknown>>(
  columns: { header: string; key: string; width?: number }[],
  rows: T[],
  filename: string,
  sheetName = "Sheet1",
) {
  // Build header row
  const headers = columns.map((c) => c.header);

  // Build data rows
  const dataRows = rows.map((row) =>
    columns.map((col) => {
      const val = row[col.key];
      if (val === null || val === undefined) return "";
      if (typeof val === "number") return val;
      return String(val);
    }),
  );

  const wsData = [headers, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws["!cols"] = columns.map((c) => ({ wch: c.width || 18 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/**
 * Export a table element to PDF (captures as image — perfect for Arabic/RTL)
 * @param tableRef — React ref to the table container element
 * @param filename — file name without extension
 * @param title    — optional title above the table
 * @param orientation — 'portrait' or 'landscape'
 */
export async function exportToPdf(
  tableRef: HTMLElement,
  filename: string,
  title?: string,
  orientation: "portrait" | "landscape" = "portrait",
) {
  // Clone the table HTML and open in a new print window.
  // The browser's print engine handles Arabic text perfectly.
  const tableHtml = tableRef.outerHTML;

  const dateStr = new Date().toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("يرجى السماح بالنوافذ المنبثقة لتنزيل PDF");
    return;
  }

  printWindow.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>${filename}</title>
  <style>
    @page {
      size: ${orientation === "landscape" ? "landscape" : "portrait"};
      margin: 10mm;
    }
    * { box-sizing: border-box; }
    body {
      font-family: Tahoma, "Segoe UI", Arial, sans-serif;
      direction: rtl;
      background: #fff;
      color: #000;
      margin: 0;
      padding: 16px;
    }
    .pdf-title {
      text-align: center;
      font-size: 18px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .pdf-date {
      text-align: center;
      font-size: 12px;
      color: #666;
      margin-bottom: 16px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    th, td {
      border: 1px solid #d1d5db;
      padding: 6px 8px;
      text-align: center;
    }
    th {
      background-color: #f3f4f6;
      font-weight: 600;
    }
    tr:nth-child(even) td {
      background-color: #f9fafb;
    }
    .print-hint {
      text-align: center;
      margin-top: 20px;
      padding: 12px;
      background: #fef3c7;
      border-radius: 8px;
      font-size: 14px;
      color: #92400e;
    }
    @media print {
      .print-hint { display: none; }
    }
  </style>
</head>
<body>
  ${title ? `<div class="pdf-title">${title}</div>` : ""}
  <div class="pdf-date">${dateStr}</div>
  ${tableHtml}
  <div class="print-hint">
    💡 اضغط Ctrl+P واختر "Save as PDF" لحفظ الملف
  </div>
  <script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`);
  printWindow.document.close();
}

/* ================================================================
   WhatsApp Invoice Sharing
   ================================================================ */

export interface WhatsAppInvoice {
  id: number;
  customer_name?: string;
  customer_phone?: string;
  supplier_name?: string;
  supplier_phone?: string;
  movement_type?: string;
  invoice_date?: string;
  total: number;
  paid_amount: number;
  remaining_amount: number;
  extra_discount?: number;
  manual_discount?: number;
  items?: {
    product_name: string;
    package?: string;
    price: number;
    quantity: number;
    discount?: number;
    total: number;
    is_return?: boolean;
  }[];
}

/**
 * Normalize an Egyptian phone number to international format (without +)
 * e.g. "01012345678" → "201012345678"
 */
function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-()]+/g, "");
  if (cleaned.startsWith("+")) cleaned = cleaned.slice(1);
  if (cleaned.startsWith("0") && cleaned.length === 11) {
    cleaned = "2" + cleaned;
  }
  return cleaned;
}

/**
 * Build invoice HTML string (reusable between print & PDF generation)
 */
function buildInvoiceHtml(invoice: WhatsAppInvoice): string {
  const isSale = invoice.movement_type !== "purchase";
  const name = isSale
    ? invoice.customer_name || "نقدي"
    : invoice.supplier_name || "—";
  const phone = isSale ? invoice.customer_phone : invoice.supplier_phone;
  const dateStr = invoice.invoice_date
    ? new Date(invoice.invoice_date).toLocaleDateString("ar-EG", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : new Date().toLocaleDateString("ar-EG", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

  const items = invoice.items || [];
  const hasDiscount = items.some((it) => Number(it.discount || 0) > 0);
  const extraDiscount =
    Number(invoice.extra_discount || 0) + Number(invoice.manual_discount || 0);

  const itemsHtml = items
    .map((it, idx) => {
      const unitPrice = hasDiscount
        ? Number(it.price) - Number(it.discount || 0)
        : Number(it.price);
      const total = Math.abs(Number(it.total));
      return `<tr>
        <td>${idx + 1}</td>
        <td style="text-align:right;">${it.product_name}${it.is_return ? ' <span style="color:#ea580c;font-size:11px;">(مرتجع)</span>' : ""}</td>
        <td>${it.package || "-"}</td>
        <td>${unitPrice.toFixed(2)}</td>
        <td>${it.quantity}</td>
        <td style="font-weight:600;">${it.is_return ? "-" : ""}${total.toFixed(2)}</td>
      </tr>`;
    })
    .join("");

  return `
    <div class="header">
      <h2>فاتورة رقم #${invoice.id}</h2>
      <p>${dateStr}</p>
    </div>
    <div class="info">
      <div>
        <span class="label">${isSale ? "العميل" : "المورد"}:</span>
        <strong>${name}</strong>
      </div>
      ${phone ? `<div><span class="label">هاتف:</span> ${phone}</div>` : ""}
    </div>
    ${
      items.length > 0
        ? `<table>
            <thead><tr>
              <th style="width:36px;">#</th>
              <th style="text-align:right;">الصنف</th>
              <th>العبوة</th>
              <th>السعر</th>
              <th>الكمية</th>
              <th>الإجمالي</th>
            </tr></thead>
            <tbody>${itemsHtml}</tbody>
          </table>`
        : ""
    }
    <div class="summary">
      <div class="summary-row">
        <span>الإجمالي</span>
        <strong>${Number(invoice.total).toFixed(2)} جنيه</strong>
      </div>
      ${extraDiscount > 0 ? `<div class="summary-row red"><span>الخصم</span><span>-${extraDiscount.toFixed(2)}</span></div>` : ""}
      <div class="summary-row">
        <span>المدفوع</span>
        <span>${Number(invoice.paid_amount).toFixed(2)} جنيه</span>
      </div>
      ${Number(invoice.remaining_amount) > 0 ? `<div class="summary-row red bold"><span>المتبقي</span><span>${Number(invoice.remaining_amount).toFixed(2)} جنيه</span></div>` : ""}
    </div>`;
}

/**
 * CSS for invoice PDF/print
 */
const INVOICE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Tahoma, "Segoe UI", Arial, sans-serif;
    direction: rtl;
    background: #fff;
    color: #111;
    padding: 24px;
    line-height: 1.6;
  }
  .header { text-align: center; margin-bottom: 16px; }
  .header h2 { margin: 0 0 4px; font-size: 20px; }
  .header p { margin: 0; color: #666; font-size: 13px; }
  .info {
    display: flex;
    justify-content: space-between;
    margin-bottom: 16px;
    padding: 10px 12px;
    background: #f9fafb;
    border-radius: 6px;
    border: 1px solid #e5e7eb;
  }
  .info span.label { color: #666; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px; }
  th { padding: 8px; background: #f3f4f6; border-bottom: 2px solid #d1d5db; text-align: center; }
  td { padding: 6px 8px; text-align: center; border-bottom: 1px solid #e5e7eb; }
  .summary { border-top: 2px solid #111; padding-top: 12px; font-size: 14px; }
  .summary-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
  .red { color: #dc2626; }
  .bold { font-weight: 700; }
`;

/**
 * Generate a PDF blob from invoice data using an isolated iframe + html2canvas
 */
async function generateInvoicePdfBlob(
  invoice: WhatsAppInvoice,
): Promise<Blob | null> {
  const bodyHtml = buildInvoiceHtml(invoice);

  // Create an isolated iframe — NO Tailwind/shadcn CSS, so html2canvas won't crash
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-9999px";
  iframe.style.top = "0";
  iframe.style.width = "650px";
  iframe.style.height = "900px";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    return null;
  }

  iframeDoc.open();
  iframeDoc.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><style>${INVOICE_CSS}</style></head>
<body>${bodyHtml}</body>
</html>`);
  iframeDoc.close();

  // Wait for iframe to render
  await new Promise((r) => setTimeout(r, 300));

  try {
    const target = iframeDoc.body;
    const canvas = await (html2canvas as any)(target, {
      useCORS: true,
      backgroundColor: "#ffffff",
      scale: 2,
      width: target.scrollWidth,
      windowWidth: target.scrollWidth,
    });

    document.body.removeChild(iframe);

    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const usableWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height * usableWidth) / canvas.width;
    const usableHeight = pageHeight - margin * 2;

    if (imgHeight <= usableHeight) {
      pdf.addImage(imgData, "PNG", margin, margin, usableWidth, imgHeight);
    } else {
      let remaining = canvas.height;
      let srcY = 0;
      const sliceHeightPx = (usableHeight / usableWidth) * canvas.width;
      let first = true;
      while (remaining > 0) {
        if (!first) pdf.addPage();
        const sliceH = Math.min(sliceHeightPx, remaining);
        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceH;
        const ctx = sliceCanvas.getContext("2d");
        if (ctx)
          ctx.drawImage(
            canvas,
            0,
            srcY,
            canvas.width,
            sliceH,
            0,
            0,
            canvas.width,
            sliceH,
          );
        const sliceImg = sliceCanvas.toDataURL("image/png");
        const displayH = (sliceH * usableWidth) / canvas.width;
        pdf.addImage(sliceImg, "PNG", margin, margin, usableWidth, displayH);
        srcY += sliceH;
        remaining -= sliceH;
        first = false;
      }
    }

    return pdf.output("blob");
  } catch (e) {
    console.error("PDF generation in iframe failed:", e);
    try {
      document.body.removeChild(iframe);
    } catch {
      /* already removed */
    }
    return null;
  }
}

/**
 * Download invoice as PDF — opens a print window with clean styled HTML
 */
export async function downloadInvoicePdf(
  invoice: WhatsAppInvoice,
): Promise<boolean> {
  try {
    const bodyHtml = buildInvoiceHtml(invoice);

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("يرجى السماح بالنوافذ المنبثقة لتنزيل PDF");
      return false;
    }

    printWindow.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>فاتورة ${invoice.id}</title>
  <style>
    @page { size: portrait; margin: 12mm; }
    ${INVOICE_CSS}
    .print-hint {
      text-align: center; margin-top: 24px; padding: 12px;
      background: #fef3c7; border-radius: 8px; font-size: 14px; color: #92400e;
    }
    @media print { .print-hint { display: none; } }
  </style>
</head>
<body>
  ${bodyHtml}
  <div class="print-hint">💡 اضغط Ctrl+P واختر "Save as PDF" لحفظ الملف</div>
  <script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`);
    printWindow.document.close();
    return true;
  } catch (e) {
    console.error("PDF print failed:", e);
    return false;
  }
}

/**
 * Send invoice PDF via WhatsApp:
 * 1. Generate PDF blob in isolated iframe
 * 2. Download the PDF file
 * 3. Open WhatsApp chat directly on customer's number
 */
export async function shareViaWhatsApp(
  invoice: WhatsAppInvoice,
): Promise<"downloaded_and_opened" | "no_phone" | "failed"> {
  const isSale = invoice.movement_type !== "purchase";
  const phone = isSale ? invoice.customer_phone : invoice.supplier_phone;

  if (!phone) return "no_phone";

  // 1. Generate PDF blob
  const pdfBlob = await generateInvoicePdfBlob(invoice);
  if (!pdfBlob) return "failed";

  // 2. Download PDF
  const blobUrl = URL.createObjectURL(pdfBlob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = `invoice-${invoice.id}.pdf`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // 3. Open WhatsApp on the customer's number after a short delay
  const normalizedPhone = normalizePhone(phone);
  setTimeout(() => {
    window.open(`https://wa.me/${normalizedPhone}`, "_blank");
    URL.revokeObjectURL(blobUrl);
  }, 800);

  return "downloaded_and_opened";
}

/**
 * Open WhatsApp chat (simple, no PDF)
 */
export function openWhatsApp(invoice: {
  customer_phone?: string;
  supplier_phone?: string;
  movement_type?: string;
}): "opened" | "no_phone" {
  const isSale = invoice.movement_type !== "purchase";
  const phone = isSale ? invoice.customer_phone : invoice.supplier_phone;

  if (!phone) return "no_phone";

  const normalizedPhone = normalizePhone(phone);
  window.open(`https://wa.me/${normalizedPhone}`, "_blank");
  return "opened";
}
