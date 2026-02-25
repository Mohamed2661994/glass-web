"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { exportToExcel, exportToPdf } from "@/lib/export-utils";
import { toast } from "sonner";

/* ================================================================
   Export Buttons Component
   ================================================================ */

export type ExportColumn = {
  header: string;
  key: string;
  width?: number;
};

interface ExportButtonsProps {
  /** Table container ref for PDF export */
  tableRef: React.RefObject<HTMLDivElement | null>;
  /** Columns definition for Excel */
  columns: ExportColumn[];
  /** Data rows for Excel */
  data: Record<string, unknown>[];
  /** Filename (without extension) */
  filename: string;
  /** Title shown in PDF header */
  title: string;
  /** PDF only (no Excel option) */
  pdfOnly?: boolean;
  /** Excel only (no PDF option) */
  excelOnly?: boolean;
  /** PDF orientation */
  pdfOrientation?: "portrait" | "landscape";
  /** Disable when loading */
  disabled?: boolean;
}

export function ExportButtons({
  tableRef,
  columns,
  data,
  filename,
  title,
  pdfOnly = false,
  excelOnly = false,
  pdfOrientation = "portrait",
  disabled = false,
}: ExportButtonsProps) {
  const [exporting, setExporting] = useState(false);

  const handleExcel = () => {
    if (data.length === 0) {
      toast.error("لا توجد بيانات للتصدير");
      return;
    }
    try {
      exportToExcel(columns, data, filename);
      toast.success("تم تصدير ملف Excel بنجاح");
    } catch {
      toast.error("فشل تصدير Excel");
    }
  };

  const handlePdf = async () => {
    if (!tableRef.current) {
      toast.error("لا توجد بيانات للتصدير");
      return;
    }
    setExporting(true);
    try {
      await exportToPdf(tableRef.current, filename, title, pdfOrientation);
      toast.success("تم تصدير ملف PDF بنجاح");
    } catch {
      toast.error("فشل تصدير PDF");
    } finally {
      setExporting(false);
    }
  };

  // Single button mode
  if (pdfOnly) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handlePdf}
        disabled={disabled || exporting}
        className="gap-2"
      >
        {exporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
        تصدير PDF
      </Button>
    );
  }

  if (excelOnly) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleExcel}
        disabled={disabled}
        className="gap-2"
      >
        <FileSpreadsheet className="h-4 w-4" />
        تصدير Excel
      </Button>
    );
  }

  // Dropdown with both options
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled || exporting}
          className="gap-2"
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          تصدير
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={handleExcel}
          className="gap-2 cursor-pointer"
        >
          <FileSpreadsheet className="h-4 w-4" />
          تصدير Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePdf} className="gap-2 cursor-pointer">
          <FileText className="h-4 w-4" />
          تصدير PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
