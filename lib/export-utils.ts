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

/**
 * Normalize an Egyptian phone number to international format (without +)
 * e.g. "01012345678" → "201012345678"
 */
function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[\s\-()]+/g, "");
  // Remove leading +
  if (cleaned.startsWith("+")) cleaned = cleaned.slice(1);
  // Egyptian number starting with 0 → add 20
  if (cleaned.startsWith("0") && cleaned.length === 11) {
    cleaned = "2" + cleaned;
  }
  // If already starts with 20 and length is 12, it's correct
  return cleaned;
}

/**
 * Generate a PDF blob from an iframe (invoice print page)
 */
async function generateInvoicePdfBlob(invoiceId: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    // Create hidden iframe to load the print page
    const iframe = document.createElement("iframe");
    iframe.style.position = "absolute";
    iframe.style.left = "-9999px";
    iframe.style.top = "0";
    iframe.style.width = "800px";
    iframe.style.height = "1200px";
    iframe.src = `/invoices/${invoiceId}/print?preview=1`;
    document.body.appendChild(iframe);

    const timeout = setTimeout(() => {
      document.body.removeChild(iframe);
      resolve(null);
    }, 15000);

    iframe.onload = async () => {
      // Wait for content to render
      await new Promise((r) => setTimeout(r, 2000));

      try {
        const iframeDoc =
          iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) {
          clearTimeout(timeout);
          document.body.removeChild(iframe);
          resolve(null);
          return;
        }

        // Find the invoice content (the main printable area)
        const printArea =
          iframeDoc.querySelector("[data-print-area]") ||
          iframeDoc.querySelector(".print-area") ||
          iframeDoc.body;

        const canvas = await html2canvas(
          printArea as HTMLElement,
          {
            useCORS: true,
            backgroundColor: "#ffffff",
          } as any,
        );

        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4",
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const margin = 5;
        const usableWidth = pageWidth - margin * 2;
        const imgHeight = (canvas.height * usableWidth) / canvas.width;
        const usableHeight = pageHeight - margin * 2;

        if (imgHeight <= usableHeight) {
          pdf.addImage(imgData, "PNG", margin, margin, usableWidth, imgHeight);
        } else {
          // Multi-page
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
            }
            const sliceImg = sliceCanvas.toDataURL("image/png");
            const displayH = (sliceH * usableWidth) / canvas.width;
            pdf.addImage(
              sliceImg,
              "PNG",
              margin,
              margin,
              usableWidth,
              displayH,
            );
            srcY += sliceH;
            remainingHeight -= sliceH;
            isFirstPage = false;
          }
        }

        const blob = pdf.output("blob");
        clearTimeout(timeout);
        document.body.removeChild(iframe);
        resolve(blob);
      } catch {
        clearTimeout(timeout);
        document.body.removeChild(iframe);
        resolve(null);
      }
    };
  });
}

/**
 * Share an invoice via WhatsApp
 * 1. Try Web Share API with PDF file (native — works on mobile, shows WhatsApp)
 * 2. Fallback: open wa.me with text summary
 */
export async function shareInvoiceWhatsApp(invoice: {
  id: number;
  customer_name?: string;
  customer_phone?: string;
  supplier_name?: string;
  supplier_phone?: string;
  movement_type?: string;
  total: number;
  paid_amount: number;
  remaining_amount: number;
}): Promise<"shared" | "whatsapp_opened" | "no_phone"> {
  const isSale = invoice.movement_type !== "purchase";
  const name = isSale
    ? invoice.customer_name || "نقدي"
    : invoice.supplier_name || "—";
  const phone = isSale ? invoice.customer_phone : invoice.supplier_phone;

  if (!phone) return "no_phone";

  const normalizedPhone = normalizePhone(phone);

  // Build text summary
  const lines = [
    `فاتورة رقم #${invoice.id}`,
    `${isSale ? "العميل" : "المورد"}: ${name}`,
    `الإجمالي: ${Number(invoice.total).toFixed(2)} جنيه`,
    `المدفوع: ${Number(invoice.paid_amount).toFixed(2)} جنيه`,
  ];
  if (Number(invoice.remaining_amount) > 0) {
    lines.push(`المتبقي: ${Number(invoice.remaining_amount).toFixed(2)} جنيه`);
  }
  const textMessage = lines.join("\n");

  // Try Web Share API with PDF
  if (navigator.share && navigator.canShare) {
    try {
      const pdfBlob = await generateInvoicePdfBlob(invoice.id);
      if (pdfBlob) {
        const pdfFile = new File([pdfBlob], `فاتورة-${invoice.id}.pdf`, {
          type: "application/pdf",
        });

        if (navigator.canShare({ files: [pdfFile] })) {
          await navigator.share({
            title: `فاتورة #${invoice.id}`,
            text: textMessage,
            files: [pdfFile],
          });
          return "shared";
        }
      }
    } catch (err: any) {
      // User cancelled or share failed — fall through to wa.me
      if (err?.name === "AbortError") return "shared"; // user cancelled
    }
  }

  // Fallback: open wa.me with text message
  const encoded = encodeURIComponent(textMessage);
  window.open(`https://wa.me/${normalizedPhone}?text=${encoded}`, "_blank");
  return "whatsapp_opened";
}
