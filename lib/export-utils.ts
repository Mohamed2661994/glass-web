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
  const targetWidth = orientation === "landscape" ? 1100 : 750;

  const canvas = await (html2canvas as any)(tableRef, {
    useCORS: true,
    backgroundColor: "#ffffff",
    windowWidth: targetWidth + 40,
    width: targetWidth + 32,
    onclone: (_doc: Document, clonedEl: HTMLElement) => {
      // Style the cloned element for clean PDF output
      clonedEl.style.width = targetWidth + "px";
      clonedEl.style.direction = "rtl";
      clonedEl.style.fontFamily = "Tahoma, Arial, sans-serif";
      clonedEl.style.background = "white";
      clonedEl.style.color = "black";
      clonedEl.style.padding = "16px";

      clonedEl.querySelectorAll("*").forEach((el: Element) => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.color = "black";
        if (htmlEl.tagName === "TH" || htmlEl.closest("thead")) {
          htmlEl.style.backgroundColor = "#f3f4f6";
        } else {
          htmlEl.style.backgroundColor = "white";
        }
        htmlEl.style.borderColor = "#d1d5db";
      });
    },
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({
    orientation,
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const usableWidth = pageWidth - margin * 2;

  let yPos = margin;

  // Add title if provided
  if (title) {
    pdf.setFontSize(16);
    pdf.text(title, pageWidth / 2, yPos + 6, { align: "center" });
    yPos += 14;
  }

  // Add date
  const now = new Date();
  const dateStr = now.toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  pdf.setFontSize(9);
  pdf.text(dateStr, pageWidth / 2, yPos + 4, { align: "center" });
  yPos += 10;

  // Calculate image dimensions to fit page
  const imgWidth = usableWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  // If image is taller than one page, split across multiple pages
  const usableHeight = pageHeight - yPos - margin;

  if (imgHeight <= usableHeight) {
    pdf.addImage(imgData, "PNG", margin, yPos, imgWidth, imgHeight);
  } else {
    // Multi-page: slice the canvas
    let remainingHeight = canvas.height;
    let srcY = 0;
    const sliceHeightPx = (usableHeight / imgWidth) * canvas.width;
    let isFirstPage = true;

    while (remainingHeight > 0) {
      if (!isFirstPage) {
        pdf.addPage();
        yPos = margin;
      }

      const currentSliceHeight = Math.min(sliceHeightPx, remainingHeight);
      const currentSliceCanvas = document.createElement("canvas");
      currentSliceCanvas.width = canvas.width;
      currentSliceCanvas.height = currentSliceHeight;
      const ctx = currentSliceCanvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(
          canvas,
          0,
          srcY,
          canvas.width,
          currentSliceHeight,
          0,
          0,
          canvas.width,
          currentSliceHeight,
        );
      }

      const sliceImgData = currentSliceCanvas.toDataURL("image/png");
      const sliceDisplayHeight = (currentSliceHeight * imgWidth) / canvas.width;
      pdf.addImage(
        sliceImgData,
        "PNG",
        margin,
        yPos,
        imgWidth,
        sliceDisplayHeight,
      );

      srcY += currentSliceHeight;
      remainingHeight -= currentSliceHeight;
      isFirstPage = false;
    }
  }

  pdf.save(`${filename}.pdf`);
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
 * Build a clean invoice HTML, render via html2canvas, then wrap in a PDF blob
 */
async function generateInvoicePdfBlob(
  invoice: WhatsAppInvoice,
): Promise<Blob | null> {
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

  // Build items rows HTML
  const itemsHtml = items
    .map((it, idx) => {
      const unitPrice = hasDiscount
        ? Number(it.price) - Number(it.discount || 0)
        : Number(it.price);
      const total = Math.abs(Number(it.total));
      return `<tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:6px 8px;text-align:center;">${idx + 1}</td>
        <td style="padding:6px 8px;">${it.product_name}${it.is_return ? ' <span style="color:#ea580c;font-size:11px;">(مرتجع)</span>' : ""}</td>
        <td style="padding:6px 8px;text-align:center;">${it.package || "-"}</td>
        <td style="padding:6px 8px;text-align:center;">${unitPrice.toFixed(2)}</td>
        <td style="padding:6px 8px;text-align:center;">${it.quantity}</td>
        <td style="padding:6px 8px;text-align:center;font-weight:600;">${it.is_return ? "-" : ""}${total.toFixed(2)}</td>
      </tr>`;
    })
    .join("");

  const html = `
    <div style="width:580px;direction:rtl;font-family:Tahoma,Arial,sans-serif;background:#fff;color:#111;padding:24px;line-height:1.6;">
      <div style="text-align:center;margin-bottom:16px;">
        <h2 style="margin:0 0 4px;font-size:20px;">فاتورة رقم #${invoice.id}</h2>
        <p style="margin:0;color:#666;font-size:13px;">${dateStr}</p>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:16px;padding:10px 12px;background:#f9fafb;border-radius:6px;border:1px solid #e5e7eb;">
        <div>
          <span style="color:#666;font-size:13px;">${isSale ? "العميل" : "المورد"}:</span>
          <strong style="margin-right:6px;">${name}</strong>
        </div>
        ${phone ? `<div><span style="color:#666;font-size:13px;">هاتف:</span> <span style="margin-right:6px;">${phone}</span></div>` : ""}
      </div>
      ${
        items.length > 0
          ? `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px;">
              <thead>
                <tr style="background:#f3f4f6;border-bottom:2px solid #d1d5db;">
                  <th style="padding:8px;text-align:center;width:36px;">#</th>
                  <th style="padding:8px;text-align:right;">الصنف</th>
                  <th style="padding:8px;text-align:center;">العبوة</th>
                  <th style="padding:8px;text-align:center;">السعر</th>
                  <th style="padding:8px;text-align:center;">الكمية</th>
                  <th style="padding:8px;text-align:center;">الإجمالي</th>
                </tr>
              </thead>
              <tbody>${itemsHtml}</tbody>
            </table>`
          : ""
      }
      <div style="border-top:2px solid #111;padding-top:12px;font-size:14px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span>الإجمالي</span>
          <strong>${Number(invoice.total).toFixed(2)} جنيه</strong>
        </div>
        ${extraDiscount > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:6px;color:#dc2626;"><span>الخصم</span><span>-${extraDiscount.toFixed(2)}</span></div>` : ""}
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span>المدفوع</span>
          <span>${Number(invoice.paid_amount).toFixed(2)} جنيه</span>
        </div>
        ${Number(invoice.remaining_amount) > 0 ? `<div style="display:flex;justify-content:space-between;color:#dc2626;font-weight:700;"><span>المتبقي</span><span>${Number(invoice.remaining_amount).toFixed(2)} جنيه</span></div>` : ""}
      </div>
    </div>`;

  // Create a hidden container
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.zIndex = "-1";
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    const target = container.firstElementChild as HTMLElement;
    const canvas = await (html2canvas as any)(target, {
      useCORS: true,
      backgroundColor: "#ffffff",
      scale: 2,
    });
    document.body.removeChild(container);

    // Convert canvas to PDF
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const usableWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height * usableWidth) / canvas.width;
    const usableHeight = pageHeight - margin * 2;

    if (imgHeight <= usableHeight) {
      pdf.addImage(imgData, "PNG", margin, margin, usableWidth, imgHeight);
    } else {
      let remainingHeight = canvas.height;
      let srcY = 0;
      const sliceHeightPx = (usableHeight / usableWidth) * canvas.width;
      let isFirstPage = true;
      while (remainingHeight > 0) {
        if (!isFirstPage) pdf.addPage();
        const sliceH = Math.min(sliceHeightPx, remainingHeight);
        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceH;
        const ctx = sliceCanvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
        }
        const sliceImg = sliceCanvas.toDataURL("image/png");
        const displayH = (sliceH * usableWidth) / canvas.width;
        pdf.addImage(sliceImg, "PNG", margin, margin, usableWidth, displayH);
        srcY += sliceH;
        remainingHeight -= sliceH;
        isFirstPage = false;
      }
    }

    return pdf.output("blob");
  } catch {
    document.body.removeChild(container);
    return null;
  }
}

/**
 * Download invoice as PDF
 */
export async function downloadInvoicePdf(
  invoice: WhatsAppInvoice,
): Promise<boolean> {
  const pdfBlob = await generateInvoicePdfBlob(invoice);
  if (!pdfBlob) return false;

  const blobUrl = URL.createObjectURL(pdfBlob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = `invoice-${invoice.id}.pdf`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  await new Promise((r) => setTimeout(r, 1500));
  document.body.removeChild(link);
  URL.revokeObjectURL(blobUrl);
  return true;
}

/**
 * Open WhatsApp chat with the customer/supplier
 */
export function openWhatsApp(invoice: {
  id: number;
  customer_name?: string;
  customer_phone?: string;
  supplier_name?: string;
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
