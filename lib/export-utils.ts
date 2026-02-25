import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
 * Build invoice PDF using jsPDF + autoTable (no DOM rendering needed)
 */
function generateInvoicePdfBlob(
  invoice: WhatsAppInvoice,
): Blob | null {
  try {
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
    const extraDiscount =
      Number(invoice.extra_discount || 0) + Number(invoice.manual_discount || 0);

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    // Use built-in Helvetica (supports basic Latin) — Arabic won't render natively,
    // so we'll use the autoTable approach which handles text better
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 14;

    // Title
    pdf.setFontSize(18);
    pdf.text(`Invoice #${invoice.id}`, pageWidth / 2, 20, { align: "center" });
    pdf.setFontSize(11);
    pdf.setTextColor(100);
    pdf.text(dateStr, pageWidth / 2, 27, { align: "center" });

    // Customer/Supplier info
    pdf.setTextColor(0);
    pdf.setFontSize(11);
    let yPos = 36;
    const infoLabel = isSale ? "Customer" : "Supplier";
    pdf.text(`${infoLabel}: ${name}`, pageWidth - margin, yPos, { align: "right" });
    if (phone) {
      yPos += 6;
      pdf.text(`Phone: ${phone}`, pageWidth - margin, yPos, { align: "right" });
    }

    // Items table
    yPos += 8;
    if (items.length > 0) {
      const hasDiscount = items.some((it) => Number(it.discount || 0) > 0);

      const head = hasDiscount
        ? [["#", "Product", "Package", "Price", "Disc.", "Qty", "Total"]]
        : [["#", "Product", "Package", "Price", "Qty", "Total"]];

      const body = items.map((it, idx) => {
        const total = Math.abs(Number(it.total));
        const row: (string | number)[] = [
          idx + 1,
          `${it.product_name}${it.is_return ? " (Return)" : ""}`,
          it.package || "-",
          Number(it.price).toFixed(2),
        ];
        if (hasDiscount) row.push(Number(it.discount || 0).toFixed(2));
        row.push(it.quantity);
        row.push(`${it.is_return ? "-" : ""}${total.toFixed(2)}`);
        return row;
      });

      autoTable(pdf, {
        startY: yPos,
        head,
        body,
        theme: "grid",
        headStyles: { fillColor: [41, 128, 185], halign: "center", fontSize: 9 },
        bodyStyles: { halign: "center", fontSize: 9 },
        columnStyles: {
          1: { halign: "left" },
        },
        margin: { left: margin, right: margin },
      });

      yPos = (pdf as any).lastAutoTable.finalY + 10;
    }

    // Summary section
    pdf.setDrawColor(0);
    pdf.setLineWidth(0.5);
    pdf.line(margin, yPos - 4, pageWidth - margin, yPos - 4);

    const summaryX1 = pageWidth - margin;
    const summaryX2 = margin;

    pdf.setFontSize(11);
    pdf.text("Total:", summaryX2, yPos);
    pdf.text(`${Number(invoice.total).toFixed(2)} EGP`, summaryX1, yPos, { align: "right" });
    yPos += 7;

    if (extraDiscount > 0) {
      pdf.setTextColor(220, 38, 38);
      pdf.text("Discount:", summaryX2, yPos);
      pdf.text(`-${extraDiscount.toFixed(2)}`, summaryX1, yPos, { align: "right" });
      pdf.setTextColor(0);
      yPos += 7;
    }

    pdf.text("Paid:", summaryX2, yPos);
    pdf.text(`${Number(invoice.paid_amount).toFixed(2)} EGP`, summaryX1, yPos, { align: "right" });
    yPos += 7;

    if (Number(invoice.remaining_amount) > 0) {
      pdf.setFontSize(12);
      pdf.setTextColor(220, 38, 38);
      pdf.text("Remaining:", summaryX2, yPos);
      pdf.text(`${Number(invoice.remaining_amount).toFixed(2)} EGP`, summaryX1, yPos, { align: "right" });
    }

    return pdf.output("blob");
  } catch (e) {
    console.error("PDF generation failed:", e);
    return null;
  }
}

/**
 * Download invoice as PDF
 */
export async function downloadInvoicePdf(
  invoice: WhatsAppInvoice,
): Promise<boolean> {
  try {
    const pdfBlob = generateInvoicePdfBlob(invoice);
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
  } catch (e) {
    console.error("PDF download failed:", e);
    return false;
  }
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
