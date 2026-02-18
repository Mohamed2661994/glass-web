"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  Package,
  Search,
  ShieldOff,
  Ban,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/app/context/auth-context";
import { useRouter } from "next/navigation";

/* ---------- Columns we need ---------- */
const CSV_COLUMNS = [
  { key: "product_code", label: "كود الصنف / الباركود", required: true },
  { key: "product_name", label: "اسم الصنف", required: false },
] as const;

type CSVColumnKey = (typeof CSV_COLUMNS)[number]["key"];
type ColumnMapping = Record<CSVColumnKey, string>;

type Step =
  | "upload"
  | "pickHeader"
  | "mapping"
  | "validation"
  | "preview"
  | "executing"
  | "result";

type MatchedProduct = {
  code: string;
  product_id: number;
  product_name: string;
};

export default function BulkDeactivatePage() {
  const { user } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Admin guard
  const isAdmin = user?.role === "admin" || user?.id === 7;
  useEffect(() => {
    if (user && !isAdmin) {
      router.replace("/");
    }
  }, [user, isAdmin, router]);

  // State
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState("");
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [headerRowIdx, setHeaderRowIdx] = useState(0);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [excelData, setExcelData] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({} as ColumnMapping);

  // Validation
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState(false);
  const [matchedProducts, setMatchedProducts] = useState<MatchedProduct[]>([]);
  const [unmatchedCodes, setUnmatchedCodes] = useState<string[]>([]);
  const [alreadyInactive, setAlreadyInactive] = useState<MatchedProduct[]>([]);

  // Execution
  const [executing, setExecuting] = useState(false);
  const [deactivatedCount, setDeactivatedCount] = useState(0);
  const [deactivatedItems, setDeactivatedItems] = useState<
    { id: number; name: string; barcode: string }[]
  >([]);

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
            (row) => row.filter((c) => c.trim() !== "").length >= 1,
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
              row.filter((c) => String(c ?? "").trim() !== "").length >= 1,
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

    // Auto-map
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

  /* ========== Get mapped items ========== */
  const getMappedItems = useCallback(() => {
    return excelData.map((row) => {
      const item: Record<string, string> = {};
      for (const col of CSV_COLUMNS) {
        const excelCol = mapping[col.key];
        item[col.key] = excelCol ? String(row[excelCol] ?? "") : "";
      }
      return item;
    });
  }, [excelData, mapping]);

  /* ========== STEP 3: Validate ========== */
  const handleValidate = useCallback(async () => {
    setValidating(true);
    try {
      const items = getMappedItems();
      const codes = items.map((item) => item.product_code).filter(Boolean);
      const uniqueCodes = [...new Set(codes)];

      const { data } = await api.post(
        "/admin/products/bulk-deactivate/validate",
        { codes: uniqueCodes },
      );

      setMatchedProducts(data.matched || []);
      setUnmatchedCodes(data.unmatched || []);
      setAlreadyInactive(data.alreadyInactive || []);
      setValidated(true);

      const matchCount = data.matched?.length || 0;
      const unmatchCount = data.unmatched?.length || 0;
      const inactiveCount = data.alreadyInactive?.length || 0;

      if (matchCount > 0) {
        toast.success(`${matchCount} صنف جاهز للتعطيل`);
      }
      if (unmatchCount > 0) {
        toast.warning(`${unmatchCount} كود غير موجود`);
      }
      if (inactiveCount > 0) {
        toast.info(`${inactiveCount} صنف معطل بالفعل`);
      }
    } catch {
      toast.error("فشل التحقق من الأكواد");
    } finally {
      setValidating(false);
    }
  }, [getMappedItems]);

  // Auto-validate
  useEffect(() => {
    if (step === "validation" && !validated && !validating) {
      handleValidate();
    }
  }, [step, validated, validating, handleValidate]);

  /* ========== STEP 4: Execute deactivation ========== */
  const handleExecute = async () => {
    setExecuting(true);
    setStep("executing");

    try {
      const ids = matchedProducts.map((p) => p.product_id);
      const { data } = await api.post(
        "/admin/products/bulk-deactivate/execute",
        { product_ids: ids },
      );

      setDeactivatedCount(data.deactivated);
      setDeactivatedItems(data.items || []);
      setStep("result");
      toast.success(`تم تعطيل ${data.deactivated} صنف بنجاح`);
    } catch {
      toast.error("حدث خطأ أثناء التعطيل");
      setStep("preview");
    } finally {
      setExecuting(false);
    }
  };

  /* ========== Reset ========== */
  const resetAll = () => {
    setStep("upload");
    setFileName("");
    setRawRows([]);
    setExcelHeaders([]);
    setExcelData([]);
    setMapping({} as ColumnMapping);
    setValidated(false);
    setMatchedProducts([]);
    setUnmatchedCodes([]);
    setAlreadyInactive([]);
    setDeactivatedCount(0);
    setDeactivatedItems([]);
  };

  if (!isAdmin) return null;

  /* ========== RENDER ========== */
  return (
    <PageContainer size="xl">
      <h2 className="text-2xl font-bold mb-4 text-center">
        تعطيل أصناف بالجملة
      </h2>

      {/* Stepper */}
      <div className="flex items-center justify-center gap-2 mb-6 flex-wrap">
        {[
          { key: "upload", label: "رفع الملف", icon: Upload },
          { key: "pickHeader", label: "صف العناوين", icon: FileSpreadsheet },
          { key: "mapping", label: "ربط الأعمدة", icon: FileSpreadsheet },
          { key: "validation", label: "التحقق", icon: Search },
          { key: "preview", label: "معاينة", icon: AlertTriangle },
          { key: "result", label: "النتيجة", icon: CheckCircle2 },
        ].map((s, i) => {
          const stepOrder: Step[] = [
            "upload",
            "pickHeader",
            "mapping",
            "validation",
            "preview",
            "result",
          ];
          const currentIdx = stepOrder.indexOf(
            step === "executing" ? "preview" : step,
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
              رفع ملف الأصناف المراد تعطيلها
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className="border-2 border-dashed rounded-lg p-10 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <ShieldOff className="h-12 w-12 mx-auto mb-3 text-red-500" />
              <p className="text-lg font-medium mb-1">اضغط هنا لاختيار ملف</p>
              <p className="text-sm text-muted-foreground">
                يدعم ملفات .xlsx و .xls و .csv
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                الأعمدة المطلوبة: كود الصنف/الباركود
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

      {/* ===== STEP: Pick Header Row ===== */}
      {step === "pickHeader" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              اختر صف العناوين
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              اضغط على الصف اللي فيه أسماء الأعمدة (مثلاً: كود الصنف، الاسم...)
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
            <div className="grid gap-4 sm:grid-cols-2">
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
                  setMatchedProducts([]);
                  setUnmatchedCodes([]);
                  setAlreadyInactive([]);
                  setStep("validation");
                }}
              >
                التحقق من الأكواد
                <ArrowLeft className="h-4 w-4 mr-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== STEP: Validation ===== */}
      {step === "validation" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-blue-500" />
              التحقق من أكواد الأصناف ({excelData.length} صنف)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {validating && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-lg font-medium">جاري التحقق من الأكواد...</p>
              </div>
            )}

            {validated && (
              <>
                <div className="rounded-md border overflow-auto max-h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-center w-12">#</TableHead>
                        <TableHead className="text-center">كود الصنف</TableHead>
                        <TableHead className="text-center">
                          اسم الصنف (من الملف)
                        </TableHead>
                        <TableHead className="text-center">الحالة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getMappedItems()
                        .slice(0, 100)
                        .map((item, i) => {
                          const code = item.product_code?.trim();
                          const isMatched = matchedProducts.some(
                            (p) => p.code === code,
                          );
                          const isInactive = alreadyInactive.some(
                            (p) => p.code === code,
                          );
                          const isUnmatched = unmatchedCodes.includes(code);

                          return (
                            <TableRow
                              key={i}
                              className={
                                isMatched
                                  ? ""
                                  : isInactive
                                    ? "bg-yellow-50 dark:bg-yellow-950/20"
                                    : isUnmatched
                                      ? "bg-red-50 dark:bg-red-950/20"
                                      : ""
                              }
                            >
                              <TableCell className="text-center">
                                {i + 1}
                              </TableCell>
                              <TableCell className="text-center font-mono text-xs">
                                {code || "—"}
                              </TableCell>
                              <TableCell className="text-center">
                                {item.product_name || "—"}
                              </TableCell>
                              <TableCell className="text-center">
                                {isMatched ? (
                                  <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                                    <CheckCircle2 className="h-3 w-3 ml-1" />
                                    جاهز للتعطيل
                                  </Badge>
                                ) : isInactive ? (
                                  <Badge
                                    variant="outline"
                                    className="text-yellow-700 border-yellow-400 dark:text-yellow-400"
                                  >
                                    <Ban className="h-3 w-3 ml-1" />
                                    معطل بالفعل
                                  </Badge>
                                ) : (
                                  <Badge variant="destructive">
                                    <XCircle className="h-3 w-3 ml-1" />
                                    غير موجود
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </div>
                {excelData.length > 100 && (
                  <p className="text-sm text-muted-foreground mt-2 text-center">
                    يعرض أول 100 صف من {excelData.length}
                  </p>
                )}

                {/* Summary cards */}
                <div className="grid grid-cols-3 gap-3 mt-4">
                  <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 p-3 text-center">
                    <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                      {matchedProducts.length}
                    </p>
                    <p className="text-xs text-green-600">جاهز للتعطيل</p>
                  </div>
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 p-3 text-center">
                    <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                      {alreadyInactive.length}
                    </p>
                    <p className="text-xs text-yellow-600">معطل بالفعل</p>
                  </div>
                  <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 p-3 text-center">
                    <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                      {unmatchedCodes.length}
                    </p>
                    <p className="text-xs text-red-600">غير موجود</p>
                  </div>
                </div>
              </>
            )}

            <div className="flex items-center gap-3 mt-6 justify-between">
              <Button
                variant="outline"
                onClick={() => setStep("mapping")}
                disabled={validating}
              >
                <ArrowRight className="h-4 w-4 ml-1" />
                رجوع
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setValidated(false);
                    setMatchedProducts([]);
                    setUnmatchedCodes([]);
                    setAlreadyInactive([]);
                  }}
                  disabled={validating}
                >
                  <Search className="h-4 w-4 ml-1" />
                  إعادة التحقق
                </Button>
                <Button
                  onClick={() => setStep("preview")}
                  disabled={!validated || matchedProducts.length === 0}
                >
                  متابعة
                  <ArrowLeft className="h-4 w-4 mr-1" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== STEP: Preview ===== */}
      {(step === "preview" || step === "executing") && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              تأكيد تعطيل {matchedProducts.length} صنف
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              الأصناف التالية سيتم تعطيلها (
              <span className="text-red-600 font-medium">
                is_active = false
              </span>
              )
            </p>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-auto max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-center w-12">#</TableHead>
                    <TableHead className="text-center">كود الصنف</TableHead>
                    <TableHead className="text-center">
                      اسم الصنف (من النظام)
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matchedProducts.map((p, i) => (
                    <TableRow key={p.product_id}>
                      <TableCell className="text-center">{i + 1}</TableCell>
                      <TableCell className="text-center font-mono text-xs">
                        {p.code}
                      </TableCell>
                      <TableCell className="text-center">
                        {p.product_name}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 p-4 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <span className="font-semibold text-red-700 dark:text-red-400">
                  تحذير: هذه العملية ستقوم بتعطيل {matchedProducts.length} صنف.
                  الأصناف المعطلة لن تظهر في الفواتير والبحث.
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3 mt-6 justify-between">
              <Button
                variant="outline"
                onClick={() => setStep("validation")}
                disabled={executing}
              >
                <ArrowRight className="h-4 w-4 ml-1" />
                رجوع
              </Button>
              <Button
                variant="destructive"
                onClick={handleExecute}
                disabled={executing}
              >
                {executing ? (
                  <>
                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                    جاري التعطيل...
                  </>
                ) : (
                  <>
                    <ShieldOff className="h-4 w-4 ml-1" />
                    تأكيد تعطيل {matchedProducts.length} صنف
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== STEP: Result ===== */}
      {step === "result" && (
        <div className="space-y-4 max-w-3xl mx-auto">
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800">
              <CardContent className="pt-6 text-center">
                <ShieldOff className="h-8 w-8 text-red-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                  {deactivatedCount}
                </p>
                <p className="text-sm text-red-600 dark:text-red-500">
                  صنف تم تعطيلهم
                </p>
              </CardContent>
            </Card>
            <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-800">
              <CardContent className="pt-6 text-center">
                <Ban className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                  {alreadyInactive.length}
                </p>
                <p className="text-sm text-yellow-600 dark:text-yellow-500">
                  كانوا معطلين مسبقاً
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Deactivated items list */}
          {deactivatedItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldOff className="h-4 w-4 text-red-500" />
                  الأصناف المعطلة ({deactivatedItems.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-auto max-h-[400px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-center w-12">#</TableHead>
                        <TableHead className="text-center">الباركود</TableHead>
                        <TableHead className="text-center">اسم الصنف</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deactivatedItems.map((item, i) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-center">{i + 1}</TableCell>
                          <TableCell className="text-center font-mono text-xs">
                            {item.barcode || "—"}
                          </TableCell>
                          <TableCell className="text-center">
                            {item.name}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 justify-center">
            <Button variant="outline" onClick={resetAll}>
              <Upload className="h-4 w-4 ml-1" />
              رفع ملف آخر
            </Button>
            <Button
              variant="outline"
              onClick={() => (window.location.href = "/products")}
            >
              <Package className="h-4 w-4 ml-1" />
              عرض الأصناف
            </Button>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
