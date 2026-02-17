"use client";

import { useState, useRef, useCallback } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/components/layout/page-container";
import api from "@/services/api";
import {
  Upload,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Package,
  Search,
} from "lucide-react";
import { toast } from "sonner";

/* ---------- CSV Columns ---------- */
const CSV_COLUMNS = [
  { key: "product_code", label: "كود الصنف / الباركود", required: true },
  { key: "product_name", label: "اسم الصنف", required: false },
  { key: "quantity", label: "الكمية", required: true },
  { key: "price", label: "السعر", required: true },
  { key: "unit", label: "الوحدة", required: false },
] as const;

type CSVColumnKey = (typeof CSV_COLUMNS)[number]["key"];
type ColumnMapping = Record<CSVColumnKey, string>;

type Step =
  | "upload"
  | "pickHeader"
  | "mapping"
  | "preview"
  | "importing"
  | "result";

type InvoiceResult = {
  invoice_id: number;
  matched: number;
  unmatched: number;
  unmatched_items: { product_code: string; product_name: string }[];
  total: number;
};

export default function OpeningStockPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [headerRowIdx, setHeaderRowIdx] = useState(0);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [excelData, setExcelData] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({} as ColumnMapping);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [invoiceDate, setInvoiceDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [branchId, setBranchId] = useState(1);
  const [results, setResults] = useState<InvoiceResult[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  // Validation state
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState(false);
  const [matchedCodes, setMatchedCodes] = useState<Set<string>>(new Set());
  const [unmatchedCodes, setUnmatchedCodes] = useState<string[]>([]);

  /* ========== STEP 1: Upload ========== */
  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setFileName(file.name);
      const isCSV = file.name.toLowerCase().endsWith(".csv");

      if (isCSV) {
        const textReader = new FileReader();
        textReader.onload = (evt) => {
          const text = evt.target?.result as string;
          if (!text || text.trim().length === 0) {
            toast.error("الملف فارغ");
            return;
          }

          const firstLine = text.split("\n")[0];
          let delimiter = ",";
          if (firstLine.split("\t").length > firstLine.split(",").length) {
            delimiter = "\t";
          } else if (
            firstLine.split(";").length > firstLine.split(",").length
          ) {
            delimiter = ";";
          }

          const lines = text
            .split(/\r?\n/)
            .filter((line) => line.trim() !== "");
          const rows = lines.map((line) =>
            line
              .split(delimiter)
              .map((cell) => cell.trim().replace(/^"|"$/g, "")),
          );

          if (rows.length < 2) {
            toast.error("الملف فارغ أو لا يحتوي على بيانات كافية");
            return;
          }

          setRawRows(rows);
          const autoIdx = rows.findIndex(
            (row) => row.filter((c) => c.trim() !== "").length >= 3,
          );
          setHeaderRowIdx(autoIdx >= 0 ? autoIdx : 0);
          setStep("pickHeader");
        };
        textReader.readAsText(file, "UTF-8");
      } else {
        const reader = new FileReader();
        reader.onload = (evt) => {
          const data = new Uint8Array(evt.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const aoa = XLSX.utils.sheet_to_json<string[]>(sheet, {
            header: 1,
            defval: "",
          });

          if (aoa.length < 2) {
            toast.error("الملف فارغ أو لا يحتوي على بيانات كافية");
            return;
          }

          setRawRows(aoa.map((row) => row.map((cell) => String(cell ?? ""))));
          const autoIdx = aoa.findIndex(
            (row) =>
              row.filter((c) => String(c ?? "").trim() !== "").length >= 3,
          );
          setHeaderRowIdx(autoIdx >= 0 ? autoIdx : 0);
          setStep("pickHeader");
        };
        reader.readAsArrayBuffer(file);
      }
    },
    [],
  );

  /* ========== STEP 1.5: Confirm header row ========== */
  const confirmHeaderRow = () => {
    const headers = rawRows[headerRowIdx].map(
      (h, i) => h.trim() || `عمود_${i + 1}`,
    );
    setExcelHeaders(headers);

    const dataRows = rawRows.slice(headerRowIdx + 1).map((row) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = row[i] ?? "";
      });
      return obj;
    });
    const filtered = dataRows.filter((row) =>
      Object.values(row).some((v) => String(v).trim() !== ""),
    );
    setExcelData(filtered);

    // Auto-map by matching column names
    const autoMap: Partial<ColumnMapping> = {};
    const aliases: Record<CSVColumnKey, string[]> = {
      product_code: [
        "product_code",
        "barcode",
        "الباركود",
        "كود",
        "code",
        "الكود",
      ],
      product_name: ["product_name", "name", "الاسم", "اسم الصنف", "اسم"],
      quantity: ["quantity", "الكمية", "كمية", "qty"],
      price: ["price", "السعر", "سعر"],
      unit: ["unit", "الوحدة", "وحدة"],
    };

    for (const col of CSV_COLUMNS) {
      const match = headers.find((h) => {
        const lower = h.toLowerCase().trim();
        return (
          aliases[col.key]?.some(
            (a) => lower === a.toLowerCase() || lower.includes(a.toLowerCase()),
          ) || lower === col.key
        );
      });
      if (match) {
        autoMap[col.key] = match;
      }
    }
    setMapping(autoMap as ColumnMapping);
    setStep("mapping");
  };

  /* ========== STEP 2: Mapping ========== */
  const handleMappingChange = (dbKey: CSVColumnKey, excelCol: string) => {
    setMapping((prev) => ({
      ...prev,
      [dbKey]: excelCol === "__none__" ? "" : excelCol,
    }));
  };

  const requiredMapped = CSV_COLUMNS.filter((c) => c.required).every(
    (c) => mapping[c.key],
  );

  /* ========== STEP 3: Preview (mapped data) ========== */
  const getMappedItems = useCallback(() => {
    return excelData.map((row) => {
      const item: Record<string, string> = {};
      for (const col of CSV_COLUMNS) {
        const excelCol = mapping[col.key];
        item[col.key] = excelCol ? String(row[excelCol] ?? "") : "";
      }
      // calculate total
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.price) || 0;
      item.total = (qty * price).toFixed(2);
      return item;
    });
  }, [excelData, mapping]);

  /* ========== STEP 3.5: Validate product codes ========== */
  const handleValidate = async () => {
    setValidating(true);
    try {
      const items = getMappedItems();
      const codes = items.map((item) => item.product_code).filter(Boolean);
      const uniqueCodes = [...new Set(codes)];

      const { data } = await api.post("/admin/opening-stock/validate", {
        codes: uniqueCodes,
      });

      const mSet = new Set<string>(data.matched.map((m: { code: string }) => m.code));
      setMatchedCodes(mSet);
      setUnmatchedCodes(data.unmatched || []);
      setValidated(true);

      if (data.unmatched?.length > 0) {
        toast.warning(`${data.unmatched.length} كود غير موجود في قاعدة البيانات`);
      } else {
        toast.success(`تم التحقق — كل الأكواد (${mSet.size}) موجودة ✅`);
      }
    } catch (err) {
      toast.error("فشل التحقق من الأكواد");
    } finally {
      setValidating(false);
    }
  };

  /* ========== STEP 4: Import (batched) ========== */
  const handleImport = async () => {
    setImporting(true);
    setProgress(0);
    setResults([]);
    setErrors([]);
    setStep("importing");

    try {
      const items = getMappedItems();
      const BATCH_SIZE = 100;
      const batches: Record<string, string>[][] = [];

      for (let i = 0; i < items.length; i += BATCH_SIZE) {
        batches.push(items.slice(i, i + BATCH_SIZE));
      }

      setTotalBatches(batches.length);
      const allResults: InvoiceResult[] = [];
      const allErrors: string[] = [];

      for (let i = 0; i < batches.length; i++) {
        setProgress(i + 1);
        try {
          const { data } = await api.post(
            "/admin/opening-stock",
            {
              items: batches[i],
              branch_id: branchId,
              invoice_date: invoiceDate,
            },
            { timeout: 120000 },
          );
          allResults.push(data);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "خطأ غير معروف";
          allErrors.push(`دفعة ${i + 1}: ${msg}`);
          // Retry once
          try {
            const { data } = await api.post(
              "/admin/opening-stock",
              {
                items: batches[i],
                branch_id: branchId,
                invoice_date: invoiceDate,
              },
              { timeout: 120000 },
            );
            allResults.push(data);
            allErrors.pop(); // remove the error if retry succeeded
          } catch (retryErr: unknown) {
            const retryMsg =
              retryErr instanceof Error ? retryErr.message : "خطأ غير معروف";
            allErrors.push(`دفعة ${i + 1} (إعادة محاولة): ${retryMsg}`);
          }
        }
      }

      setResults(allResults);
      setErrors(allErrors);
      setStep("result");

      const totalMatched = allResults.reduce((s, r) => s + r.matched, 0);
      const totalUnmatched = allResults.reduce((s, r) => s + r.unmatched, 0);
      const totalValue = allResults.reduce((s, r) => s + r.total, 0);

      if (totalMatched > 0) {
        toast.success(
          `تم إنشاء ${allResults.length} فاتورة شراء — ${totalMatched} صنف — ${totalValue.toLocaleString("ar-EG")} ج.م`,
        );
      }
      if (totalUnmatched > 0) {
        toast.warning(`${totalUnmatched} صنف لم يتم مطابقتهم`);
      }
    } catch (err) {
      toast.error("حدث خطأ أثناء الاستيراد");
      setStep("preview");
    } finally {
      setImporting(false);
    }
  };

  /* ========== Computed ========== */
  const allUnmatched = results.flatMap((r) => r.unmatched_items || []);
  const totalMatched = results.reduce((s, r) => s + r.matched, 0);
  const totalValue = results.reduce((s, r) => s + r.total, 0);
  const invoiceIds = results.map((r) => r.invoice_id);

  /* ========== RENDER ========== */
  return (
    <PageContainer size="xl">
      <h2 className="text-2xl font-bold mb-4 text-center">
        استيراد رصيد أول المدة
      </h2>

      {/* Stepper */}
      <div className="flex items-center justify-center gap-2 mb-6 flex-wrap">
        {[
          { key: "upload", label: "رفع الملف", icon: Upload },
          { key: "pickHeader", label: "صف العناوين", icon: FileSpreadsheet },
          { key: "mapping", label: "ربط الأعمدة", icon: FileSpreadsheet },
          { key: "preview", label: "معاينة", icon: AlertTriangle },
          { key: "result", label: "النتيجة", icon: CheckCircle2 },
        ].map((s, i) => {
          const stepOrder: Step[] = [
            "upload",
            "pickHeader",
            "mapping",
            "preview",
            "result",
          ];
          const currentIdx = stepOrder.indexOf(
            step === "importing" ? "preview" : step,
          );
          const thisIdx = stepOrder.indexOf(s.key as Step);
          const isActive = thisIdx === currentIdx;
          const isDone = thisIdx < currentIdx;

          return (
            <div key={s.key} className="flex items-center gap-2">
              {i > 0 && <ArrowLeft className="h-4 w-4 text-muted-foreground" />}
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isDone
                      ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                <s.icon className="h-4 w-4" />
                {s.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* ===== STEP: Upload ===== */}
      {step === "upload" && (
        <Card className="max-w-lg mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              رفع ملف رصيد أول المدة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Package className="h-12 w-12 mx-auto mb-3 text-blue-600" />
              <p className="text-lg font-medium mb-1">اضغط هنا لاختيار ملف</p>
              <p className="text-sm text-muted-foreground">
                يدعم ملفات .xlsx و .xls و .csv
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                الأعمدة المطلوبة: كود الصنف/الباركود، الكمية، السعر
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileUpload}
            />

            {/* Settings */}
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <Label>تاريخ الفاتورة</Label>
                <Input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>الفرع</Label>
                <Select
                  value={String(branchId)}
                  onValueChange={(v) => setBranchId(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">مخزن المعرض (قطاعي)</SelectItem>
                    <SelectItem value="2">المخزن الرئيسي (جملة)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== STEP: Pick Header Row ===== */}
      {step === "pickHeader" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              اختر صف العناوين
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              اضغط على الصف اللي فيه أسماء الأعمدة (مثلاً: product_code,
              quantity, price...)
            </p>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-auto max-h-[400px]">
              <Table>
                <TableBody>
                  {rawRows.slice(0, 20).map((row, i) => (
                    <TableRow
                      key={i}
                      className={`cursor-pointer transition-colors ${
                        headerRowIdx === i
                          ? "bg-primary/10 border-r-4 border-primary font-bold"
                          : "hover:bg-muted/50"
                      }`}
                      onClick={() => setHeaderRowIdx(i)}
                    >
                      <TableCell className="text-center w-12 text-muted-foreground">
                        {i + 1}
                      </TableCell>
                      {row.slice(0, 10).map((cell, j) => (
                        <TableCell
                          key={j}
                          className="text-center text-sm whitespace-nowrap"
                        >
                          {String(cell).trim() || (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {rawRows.length > 20 && (
              <p className="text-xs text-muted-foreground mt-2 text-center">
                يعرض أول 20 صف فقط
              </p>
            )}

            <div className="flex items-center gap-3 mt-6 justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  setStep("upload");
                  setRawRows([]);
                }}
              >
                <ArrowRight className="h-4 w-4 ml-1" />
                رجوع
              </Button>
              <div className="flex items-center gap-2">
                <Badge variant="outline">صف العناوين: {headerRowIdx + 1}</Badge>
                <Button onClick={confirmHeaderRow}>
                  تأكيد والمتابعة
                  <ArrowLeft className="h-4 w-4 mr-1" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== STEP: Mapping ===== */}
      {step === "mapping" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              ربط أعمدة الملف
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              الملف: <strong>{fileName}</strong> — عدد الصفوف:{" "}
              <strong>{excelData.length}</strong>
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {CSV_COLUMNS.map((col) => (
                <div key={col.key} className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    {col.label}
                    {col.required && (
                      <Badge variant="destructive" className="text-[10px] px-1">
                        مطلوب
                      </Badge>
                    )}
                  </Label>
                  <Select
                    value={mapping[col.key] || "__none__"}
                    onValueChange={(v) => handleMappingChange(col.key, v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر عمود من الملف" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— لا شيء —</SelectItem>
                      {excelHeaders.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {mapping[col.key] && excelData[0] && (
                    <p className="text-xs text-muted-foreground truncate">
                      مثال: {String(excelData[0][mapping[col.key]] ?? "—")}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Settings */}
            <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t">
              <div className="space-y-1.5">
                <Label>تاريخ الفاتورة</Label>
                <Input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>الفرع</Label>
                <Select
                  value={String(branchId)}
                  onValueChange={(v) => setBranchId(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">مخزن المعرض (قطاعي)</SelectItem>
                    <SelectItem value="2">المخزن الرئيسي (جملة)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6 justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  setStep("pickHeader");
                  setExcelData([]);
                  setExcelHeaders([]);
                  setMapping({} as ColumnMapping);
                }}
              >
                <ArrowRight className="h-4 w-4 ml-1" />
                رجوع
              </Button>
              <Button
                disabled={!requiredMapped}
                onClick={() => {
                  setValidated(false);
                  setMatchedCodes(new Set());
                  setUnmatchedCodes([]);
                  setStep("preview");
                }}
              >
                معاينة البيانات
                <ArrowLeft className="h-4 w-4 mr-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== STEP: Preview ===== */}
      {(step === "preview" || step === "importing") && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              معاينة البيانات ({excelData.length} صنف)
            </CardTitle>
            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
              <span>
                التاريخ: <strong>{invoiceDate}</strong>
              </span>
              <span>
                الفرع:{" "}
                <strong>
                  {branchId === 1
                    ? "مخزن المعرض (قطاعي)"
                    : "المخزن الرئيسي (جملة)"}
                </strong>
              </span>
              <span>
                الإجمالي:{" "}
                <strong>
                  {getMappedItems()
                    .reduce((s, item) => s + (parseFloat(item.total) || 0), 0)
                    .toLocaleString("ar-EG")}{" "}
                  ج.م
                </strong>
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-auto max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center w-12">#</TableHead>
                    <TableHead className="text-center">كود الصنف</TableHead>
                    <TableHead className="text-center">اسم الصنف</TableHead>
                    <TableHead className="text-center">الكمية</TableHead>
                    <TableHead className="text-center">السعر</TableHead>
                    <TableHead className="text-center">الوحدة</TableHead>
                    <TableHead className="text-center">الإجمالي</TableHead>
                    {validated && <TableHead className="text-center">الحالة</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getMappedItems()
                    .slice(0, 50)
                    .map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-center">{i + 1}</TableCell>
                        <TableCell className="text-center font-mono text-xs">
                          {item.product_code || "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.product_name || "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.quantity || "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.price || "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.unit || "—"}
                        </TableCell>
                        <TableCell className="text-center font-medium">
                          {parseFloat(item.total).toLocaleString("ar-EG")}
                        </TableCell>
                        {validated && (
                          <TableCell className="text-center">
                            {matchedCodes.has(item.product_code?.trim()) ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-500 mx-auto" />
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
            {excelData.length > 50 && (
              <p className="text-sm text-muted-foreground mt-2 text-center">
                يعرض أول 50 صف من {excelData.length}
              </p>
            )}

            {/* Validation Summary */}
            {validated && unmatchedCodes.length > 0 && (
              <div className="mt-4 p-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="h-5 w-5 text-red-500" />
                  <span className="font-semibold text-red-700 dark:text-red-400">
                    {unmatchedCodes.length} كود غير موجود في قاعدة البيانات
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 max-h-[150px] overflow-auto">
                  {unmatchedCodes.map((code, i) => (
                    <Badge key={i} variant="destructive" className="font-mono">
                      {code}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {validated && unmatchedCodes.length === 0 && (
              <div className="mt-4 p-4 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="font-semibold text-green-700 dark:text-green-400">
                    كل الأكواد ({matchedCodes.size}) موجودة في قاعدة البيانات ✅
                  </span>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 mt-6 justify-between">
              <Button
                variant="outline"
                onClick={() => setStep("mapping")}
                disabled={importing || validating}
              >
                <ArrowRight className="h-4 w-4 ml-1" />
                تعديل الربط
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleValidate}
                  disabled={importing || validating}
                >
                  {validating ? (
                    <>
                      <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                      جاري التحقق...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 ml-1" />
                      التحقق من الأكواد
                    </>
                  )}
                </Button>
                <Button onClick={handleImport} disabled={importing || !validated || unmatchedCodes.length > 0}>
                  {importing ? (
                    <>
                      <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                      جاري الاستيراد... دفعة {progress} من {totalBatches}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 ml-1" />
                      استيراد {excelData.length} صنف كفواتير شراء
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== STEP: Result ===== */}
      {step === "result" && (
        <div className="space-y-4 max-w-3xl mx-auto">
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800">
              <CardContent className="pt-6 text-center">
                <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                  {totalMatched}
                </p>
                <p className="text-sm text-green-600 dark:text-green-500">
                  صنف تم استيرادهم
                </p>
              </CardContent>
            </Card>
            <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
              <CardContent className="pt-6 text-center">
                <FileSpreadsheet className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                  {results.length}
                </p>
                <p className="text-sm text-blue-600 dark:text-blue-500">
                  فاتورة شراء
                </p>
              </CardContent>
            </Card>
            <Card className="border-purple-200 bg-purple-50 dark:bg-purple-950/30 dark:border-purple-800">
              <CardContent className="pt-6 text-center">
                <Package className="h-8 w-8 text-purple-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                  {totalValue.toLocaleString("ar-EG")}
                </p>
                <p className="text-sm text-purple-600 dark:text-purple-500">
                  إجمالي (ج.م)
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Invoice details */}
          {results.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">تفاصيل الفواتير</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-center">
                          رقم الفاتورة
                        </TableHead>
                        <TableHead className="text-center">
                          أصناف متطابقة
                        </TableHead>
                        <TableHead className="text-center">
                          غير متطابقة
                        </TableHead>
                        <TableHead className="text-center">الإجمالي</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-center font-mono">
                            #{r.invoice_id}
                          </TableCell>
                          <TableCell className="text-center text-green-600">
                            {r.matched}
                          </TableCell>
                          <TableCell className="text-center text-red-600">
                            {r.unmatched}
                          </TableCell>
                          <TableCell className="text-center">
                            {r.total.toLocaleString("ar-EG")} ج.م
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Unmatched items */}
          {allUnmatched.length > 0 && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  أصناف لم يتم مطابقتها ({allUnmatched.length})
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  هذه الأصناف غير موجودة في قاعدة البيانات — تأكد من إضافتها
                  أولاً
                </p>
              </CardHeader>
              <CardContent>
                <div className="max-h-[300px] overflow-auto space-y-2">
                  {allUnmatched.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 text-sm p-2 bg-red-50 dark:bg-red-950/20 rounded"
                    >
                      <Badge
                        variant="destructive"
                        className="shrink-0 font-mono"
                      >
                        {item.product_code}
                      </Badge>
                      <span className="text-red-700 dark:text-red-400">
                        {item.product_name || "بدون اسم"}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <Card className="border-orange-200">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  أخطاء ({errors.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {errors.map((err, i) => (
                    <div
                      key={i}
                      className="text-sm p-2 bg-orange-50 dark:bg-orange-950/20 rounded text-orange-700 dark:text-orange-400"
                    >
                      {err}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 justify-center">
            <Button
              variant="outline"
              onClick={() => {
                setStep("upload");
                setExcelData([]);
                setExcelHeaders([]);
                setMapping({} as ColumnMapping);
                setResults([]);
                setErrors([]);
                setFileName("");
                setRawRows([]);
              }}
            >
              <Upload className="h-4 w-4 ml-1" />
              استيراد ملف آخر
            </Button>
            {invoiceIds.length > 0 && (
              <Button
                variant="outline"
                onClick={() =>
                  window.open(`/invoices/${invoiceIds[0]}`, "_blank")
                }
              >
                عرض أول فاتورة
                <ArrowLeft className="h-4 w-4 mr-1" />
              </Button>
            )}
          </div>
        </div>
      )}
    </PageContainer>
  );
}
