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
  // Create a clone of the table for clean export
  const clone = tableRef.cloneNode(true) as HTMLElement;
  clone.style.width = orientation === "landscape" ? "1100px" : "750px";
  clone.style.direction = "rtl";
  clone.style.fontFamily = "Tahoma, Arial, sans-serif";
  clone.style.background = "white";
  clone.style.color = "black";
  clone.style.padding = "16px";

  // Force all text to black and backgrounds to white for print
  clone.querySelectorAll("*").forEach((el) => {
    const htmlEl = el as HTMLElement;
    htmlEl.style.color = "black";
    // Keep header backgrounds
    if (
      htmlEl.tagName === "TH" ||
      htmlEl.closest("thead")
    ) {
      htmlEl.style.backgroundColor = "#f3f4f6";
    } else {
      htmlEl.style.backgroundColor = "white";
    }
    htmlEl.style.borderColor = "#d1d5db";
  });

  // Temporarily append to document (hidden)
  clone.style.position = "absolute";
  clone.style.left = "-9999px";
  clone.style.top = "0";
  document.body.appendChild(clone);

  try {
    const canvas = await html2canvas(clone, {
      useCORS: true,
      backgroundColor: "#ffffff",
    } as any);

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
        const sliceDisplayHeight =
          (currentSliceHeight * imgWidth) / canvas.width;
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
  } finally {
    document.body.removeChild(clone);
  }
}
