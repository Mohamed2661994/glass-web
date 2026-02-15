"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
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
} from "lucide-react";
import { toast } from "sonner";

/* ---------- DB columns ---------- */
const DB_COLUMNS = [
  { key: "name", label: "اسم الصنف", required: true },
  { key: "wholesale_package", label: "عبوة الجملة", required: true },
  { key: "retail_package", label: "عبوة القطاعي", required: true },
  { key: "manufacturer", label: "الشركة المصنعة", required: false },
  { key: "purchase_price", label: "سعر شراء الجملة", required: false },
  { key: "retail_purchase_price", label: "سعر شراء القطاعي", required: false },
  { key: "wholesale_price", label: "سعر بيع الجملة", required: false },
  { key: "retail_price", label: "سعر بيع القطاعي", required: false },
  { key: "barcode", label: "الباركود", required: false },
  { key: "discount_amount", label: "مبلغ الخصم", required: false },
] as const;

type DBColumnKey = (typeof DB_COLUMNS)[number]["key"];
type ColumnMapping = Record<DBColumnKey, string>; // db_key → excel_col_header

/* ---------- Step type ---------- */
type Step = "upload" | "mapping" | "preview" | "result";

export default function ImportProductsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [excelData, setExcelData] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({} as ColumnMapping);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    skipped: number;
    errors: { row: number; error: string }[];
  } | null>(null);

  /* ========== STEP 1: Upload ========== */
  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setFileName(file.name);

      const reader = new FileReader();
      reader.onload = (evt) => {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
          defval: "",
        });

        if (json.length === 0) {
          toast.error("الملف فارغ أو لا يحتوي على بيانات");
          return;
        }

        const headers = Object.keys(json[0]);
        setExcelHeaders(headers);
        setExcelData(json);

        // Auto-map: try to match excel headers to DB columns
        const autoMap: Partial<ColumnMapping> = {};
        for (const col of DB_COLUMNS) {
          const match = headers.find(
            (h) =>
              h === col.label ||
              h === col.key ||
              h.toLowerCase().includes(col.key.toLowerCase()),
          );
          if (match) {
            autoMap[col.key] = match;
          }
        }
        setMapping(autoMap as ColumnMapping);
        setStep("mapping");
      };
      reader.readAsArrayBuffer(file);
    },
    [],
  );

  /* ========== STEP 2: Mapping ========== */
  const handleMappingChange = (dbKey: DBColumnKey, excelCol: string) => {
    setMapping((prev) => ({
      ...prev,
      [dbKey]: excelCol === "__none__" ? "" : excelCol,
    }));
  };

  const requiredMapped = DB_COLUMNS.filter((c) => c.required).every(
    (c) => mapping[c.key],
  );

  /* ========== STEP 3: Preview (mapped data) ========== */
  const getMappedProducts = useCallback(() => {
    return excelData.map((row) => {
      const product: Record<string, string> = {};
      for (const col of DB_COLUMNS) {
        const excelCol = mapping[col.key];
        product[col.key] = excelCol ? String(row[excelCol] ?? "") : "";
      }
      return product;
    });
  }, [excelData, mapping]);

  /* ========== STEP 4: Import (batched) ========== */
  const [progress, setProgress] = useState(0);

  const handleImport = async () => {
    setImporting(true);
    setProgress(0);
    try {
      const products = getMappedProducts();
      const BATCH_SIZE = 200;
      let totalImported = 0;
      let totalSkipped = 0;
      const allErrors: { row: number; error: string }[] = [];

      for (let i = 0; i < products.length; i += BATCH_SIZE) {
        const batch = products.slice(i, i + BATCH_SIZE);
        const { data } = await api.post(
          "/admin/products/import",
          { products: batch, startRow: i },
          { timeout: 120000 }
        );
        totalImported += data.imported;
        totalSkipped += data.skipped;
        if (data.errors?.length) {
          // Adjust row numbers to reflect actual position
          allErrors.push(
            ...data.errors.map((e: { row: number; error: string }) => ({
              row: e.row + i,
              error: e.error,
            }))
          );
        }
        setProgress(Math.min(i + BATCH_SIZE, products.length));
      }

      setResult({
        imported: totalImported,
        skipped: totalSkipped,
        errors: allErrors,
      });
      setStep("result");
      toast.success(`تم استيراد ${totalImported} صنف بنجاح`);
    } catch (err) {
      toast.error("حدث خطأ أثناء الاستيراد");
    } finally {
      setImporting(false);
    }
  };

  /* ========== RENDER ========== */
  return (
    <PageContainer size="xl">
      <h2 className="text-2xl font-bold mb-4 text-center">
        استيراد أصناف من Excel
      </h2>

      {/* Stepper */}
      <div className="flex items-center justify-center gap-2 mb-6 flex-wrap">
        {[
          { key: "upload", label: "رفع الملف", icon: Upload },
          { key: "mapping", label: "ربط الأعمدة", icon: FileSpreadsheet },
          { key: "preview", label: "معاينة", icon: AlertTriangle },
          { key: "result", label: "النتيجة", icon: CheckCircle2 },
        ].map((s, i) => {
          const stepOrder: Step[] = ["upload", "mapping", "preview", "result"];
          const currentIdx = stepOrder.indexOf(step);
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
              رفع ملف Excel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 text-green-600" />
              <p className="text-lg font-medium mb-1">اضغط هنا لاختيار ملف</p>
              <p className="text-sm text-muted-foreground">
                يدعم ملفات .xlsx و .xls و .csv
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={handleFileUpload}
            />
          </CardContent>
        </Card>
      )}

      {/* ===== STEP: Mapping ===== */}
      {step === "mapping" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              ربط أعمدة الإكسل بأعمدة قاعدة البيانات
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              الملف: <strong>{fileName}</strong> — عدد الصفوف:{" "}
              <strong>{excelData.length}</strong>
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {DB_COLUMNS.map((col) => (
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
                      <SelectValue placeholder="اختر عمود من الإكسل" />
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
                  {/* Mini preview of first value */}
                  {mapping[col.key] && excelData[0] && (
                    <p className="text-xs text-muted-foreground truncate">
                      مثال: {String(excelData[0][mapping[col.key]] ?? "—")}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 mt-6 justify-between">
              <Button
                variant="outline"
                onClick={() => {
                  setStep("upload");
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
                onClick={() => setStep("preview")}
              >
                معاينة البيانات
                <ArrowLeft className="h-4 w-4 mr-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== STEP: Preview ===== */}
      {step === "preview" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              معاينة البيانات ({excelData.length} صنف)
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              تأكد من البيانات قبل الاستيراد
            </p>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-auto max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center w-12">#</TableHead>
                    {DB_COLUMNS.filter((c) => mapping[c.key]).map((col) => (
                      <TableHead
                        key={col.key}
                        className="text-center whitespace-nowrap"
                      >
                        {col.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getMappedProducts()
                    .slice(0, 50)
                    .map((p, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-center">{i + 1}</TableCell>
                        {DB_COLUMNS.filter((c) => mapping[c.key]).map((col) => (
                          <TableCell key={col.key} className="text-center">
                            {p[col.key] || (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        ))}
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

            <div className="flex items-center gap-3 mt-6 justify-between">
              <Button variant="outline" onClick={() => setStep("mapping")}>
                <ArrowRight className="h-4 w-4 ml-1" />
                تعديل الربط
              </Button>
              <Button onClick={handleImport} disabled={importing}>
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 ml-1 animate-spin" />
                    جاري الاستيراد... ({progress}/{excelData.length})
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 ml-1" />
                    استيراد {excelData.length} صنف
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== STEP: Result ===== */}
      {step === "result" && result && (
        <div className="space-y-4 max-w-2xl mx-auto">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800">
              <CardContent className="pt-6 text-center">
                <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                  {result.imported}
                </p>
                <p className="text-sm text-green-600 dark:text-green-500">
                  تم استيرادهم بنجاح
                </p>
              </CardContent>
            </Card>
            <Card className="border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800">
              <CardContent className="pt-6 text-center">
                <XCircle className="h-8 w-8 text-red-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                  {result.skipped}
                </p>
                <p className="text-sm text-red-600 dark:text-red-500">
                  تم تجاوزهم
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Errors list */}
          {result.errors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  الأخطاء ({result.errors.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-[300px] overflow-auto space-y-2">
                  {result.errors.map((err, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 text-sm p-2 bg-red-50 dark:bg-red-950/20 rounded"
                    >
                      <Badge variant="destructive" className="shrink-0">
                        صف {err.row}
                      </Badge>
                      <span className="text-red-700 dark:text-red-400">
                        {err.error}
                      </span>
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
                setResult(null);
                setFileName("");
              }}
            >
              <Upload className="h-4 w-4 ml-1" />
              استيراد ملف آخر
            </Button>
            <Button onClick={() => router.push("/products")}>
              الذهاب للأصناف
              <ArrowLeft className="h-4 w-4 mr-1" />
            </Button>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
