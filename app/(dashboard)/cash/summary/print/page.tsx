"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import api from "@/services/api";
import { noSpaces, normalizeArabic } from "@/lib/utils";

const getCustomerLookupKey = (value?: string | null) =>
  normalizeArabic(noSpaces(String(value || "")).toLowerCase());

const DISCOUNT_DIFF_MARKER = "{{discount_diff}}";
const WESTERN_NUMBER_LOCALE = "en-US";
const FIXED_CASH_SUMMARY_PAPER_SIZE = "A4";
const LEGACY_FONT_SIZE_MAP: Record<string, number> = {
  small: 10,
  medium: 12,
  large: 14,
};

/* ================= TYPES ================= */

type CashInItem = {
  id: number;
  transaction_date: string;
  amount: number;
  paid_amount: number;
  remaining_amount: number;
  source_type: "manual" | "invoice" | "customer_payment";
  customer_name: string;
  invoice_source?: string | null;
  notes?: string | null;
};

type CashOutItem = {
  id: number;
  transaction_date: string;
  amount: number;
  name: string;
  entry_type: "expense" | "purchase" | "supplier_payment";
  notes?: string | null;
};

type TableSection = {
  key: string;
  title: string;
  rows: (string | number | null | undefined)[][];
  thirdColumnHeader?: string;
};

type FontStyles = {
  titleSize: number;
  dateSize: number;
  summarySize: number;
  tableTitleSize: number;
  tableSize: number;
  cellPadding: string;
};

/* ================= HELPERS ================= */

const toDateOnly = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

const easternArabicDigits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];

const formatMoney = (n: number) =>
  Math.round(Number(n) || 0).toLocaleString(WESTERN_NUMBER_LOCALE);

const formatDateAr = (date: Date) =>
  `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;

const toWesternDigits = (value: string) =>
  value
    .replace(/[٠-٩]/g, (digit) => String(easternArabicDigits.indexOf(digit)))
    .replace(/٬/g, ",")
    .replace(/٫/g, ".");

const formatCellValue = (value: string | number | null | undefined) => {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "number") return formatMoney(value);

  const trimmed = value.trim();
  if (!trimmed || trimmed === "-") return "-";

  const normalizedNumeric = trimmed.replace(/,/g, "");
  if (/^-?\d+(\.\d+)?$/.test(normalizedNumeric)) {
    return Number(normalizedNumeric).toLocaleString(WESTERN_NUMBER_LOCALE);
  }

  return toWesternDigits(value);
};

const getArabicDayName = (d: Date) => {
  const days = [
    "الأحد",
    "الإثنين",
    "الثلاثاء",
    "الأربعاء",
    "الخميس",
    "الجمعة",
    "السبت",
  ];
  return days[d.getDay()];
};

const getPreviousDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);

/** Parse {{total|paid|remaining}} from notes */
const parseMetadata = (notes?: string | null) => {
  const m = notes?.match(/\{\\{(-?[\d.]+)\|(-?[\d.]+)\|(-?[\d.]+)\}\\}/);
  if (m)
    return { total: Number(m[1]), paid: Number(m[2]), remaining: Number(m[3]) };
  const m2 = notes?.match(/\{\{(-?[\d.]+)\|(-?[\d.]+)\|(-?[\d.]+)\}\}/);
  if (m2)
    return {
      total: Number(m2[1]),
      paid: Number(m2[2]),
      remaining: Number(m2[3]),
    };
  return null;
};

const cleanNotes = (notes?: string | null) =>
  notes?.replace(/\{\{[-\d.|]+\}\}/, "").trim() || null;

const isOnlineInvoiceCashEntry = (item: CashInItem) => {
  if (item.source_type !== "invoice") return false;
  if (String(item.invoice_source || "").trim()) return true;

  return /طلب\s+اونلاين/i.test(cleanNotes(item.notes) || "");
};

const effectivePaid = (i: CashInItem) => {
  const meta = parseMetadata(i.notes);
  if (meta) return meta.paid;
  return i.source_type === "invoice" ? Number(i.paid_amount) : Number(i.amount);
};

const getPrintFontStyles = (fontSizeValue: string): FontStyles => {
  const parsedValue =
    LEGACY_FONT_SIZE_MAP[fontSizeValue] ?? Number(fontSizeValue);
  const baseSize = Number.isFinite(parsedValue)
    ? Math.min(Math.max(parsedValue, 8), 24)
    : 12;

  return {
    titleSize: baseSize + 8,
    dateSize: Math.max(baseSize, 10),
    summarySize: Math.max(baseSize, 10),
    tableTitleSize: baseSize + 2,
    tableSize: baseSize,
    cellPadding:
      baseSize <= 10
        ? "2px 4px"
        : baseSize <= 12
          ? "3px 5px"
          : "4px 6px",
  };
};

/* ================= INNER COMPONENT ================= */

function CashSummaryPrintInner() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const includeOpeningBalance = searchParams.get("includeOpeningBalance");
  const orientation = searchParams.get("orientation") || "portrait";
  const fontSize = searchParams.get("fontSize") || "12";
  const fontWeight = searchParams.get("fontWeight") || "normal";
  const tableOrderParam =
    searchParams.get("tableOrder") || "revenue,expenses,purchases,supplier";
  const hideMarketCustomers = searchParams.get("hideMarketCustomers") === "1";
  const tableOrder = tableOrderParam.split(",");
  const isLandscape = orientation === "landscape";
  const isBold = fontWeight === "bold";

  const showOpeningBalance = includeOpeningBalance === "1";

  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;

  const [cashIn, setCashIn] = useState<CashInItem[]>([]);
  const [cashOut, setCashOut] = useState<CashOutItem[]>([]);
  const [marketCustomerKeys, setMarketCustomerKeys] = useState<Set<string>>(
    new Set(),
  );
  const [loading, setLoading] = useState(true);

  const isMarketCustomerEntry = useCallback(
    (item: CashInItem) =>
      marketCustomerKeys.has(getCustomerLookupKey(item.customer_name)),
    [marketCustomerKeys],
  );

  /* ================= FETCH ================= */

  useEffect(() => {
    const stored = localStorage.getItem("user");
    const branchId = stored ? JSON.parse(stored).branch_id : 1;
    (async () => {
      try {
        const [inRes, outRes, customersRes] = await Promise.all([
          api.get("/cash-in", { params: { branch_id: branchId } }),
          api.get("/cash/out", {
            params: { branch_id: branchId, limit: 100000 },
          }),
          api.get("/customers", { params: { market_only: "1" } }),
        ]);
        const visibleCashIn = (inRes.data.data || []).filter((item: any) => {
          const rawNotes = item.notes ?? item.description ?? "";
          return !String(rawNotes || "").includes(DISCOUNT_DIFF_MARKER);
        });
        const marketCustomers: {
          name: string;
          is_market_customer?: boolean;
        }[] = Array.isArray(customersRes.data) ? customersRes.data : [];
        setCashIn(visibleCashIn);
        setCashOut(outRes.data.data || []);
        setMarketCustomerKeys(
          new Set(
            marketCustomers
              .filter((c) => Boolean(c.is_market_customer))
              .map((c) => getCustomerLookupKey(c.name)),
          ),
        );
      } catch {
        console.error("CASH SUMMARY LOAD ERROR");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ================= PRINT SETUP ================= */

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => window.print(), 600);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  /* ================= FILTER ================= */

  const inRange = (dateStr: string) => {
    const t = toDateOnly(new Date(dateStr));
    if (fromDate && t < toDateOnly(fromDate)) return false;
    if (toDate && t > toDateOnly(toDate)) return false;
    return true;
  };

  const filteredIn = cashIn.filter(
    (i) =>
      inRange(i.transaction_date) &&
      (!hideMarketCustomers || !isMarketCustomerEntry(i)),
  );
  const filteredOut = cashOut.filter((o) => inRange(o.transaction_date));
  const expenses = filteredOut.filter((o) => o.entry_type === "expense");
  const purchases = filteredOut.filter((o) => o.entry_type === "purchase");
  const supplierPayments = filteredOut.filter(
    (o) => o.entry_type === "supplier_payment",
  );

  const fromDateTime = fromDate ? toDateOnly(fromDate) : null;

  const prevCashIn = fromDateTime
    ? cashIn.filter(
        (i) =>
          toDateOnly(new Date(i.transaction_date)) < fromDateTime &&
          (!hideMarketCustomers || !isMarketCustomerEntry(i)),
      )
    : [];
  const prevCashOut = fromDateTime
    ? cashOut.filter(
        (o) => toDateOnly(new Date(o.transaction_date)) < fromDateTime,
      )
    : [];

  const lastPrevDate = useMemo(() => {
    const allDates = [
      ...prevCashIn.map((i) => toDateOnly(new Date(i.transaction_date))),
      ...prevCashOut.map((o) => toDateOnly(new Date(o.transaction_date))),
    ];
    if (allDates.length === 0) return null;
    return new Date(Math.max(...allDates));
  }, [prevCashIn, prevCashOut]);

  const prevSummary = useMemo(() => {
    const totalIn = prevCashIn.reduce((s, i) => {
      const val = effectivePaid(i);
      return s + (isNaN(val) ? 0 : val);
    }, 0);
    const totalOut = prevCashOut.reduce((s, o) => {
      const val = Number(o.amount);
      return s + (isNaN(val) ? 0 : val);
    }, 0);
    return { balance: totalIn - totalOut };
  }, [prevCashIn, prevCashOut]);

  const openingBalance = showOpeningBalance ? prevSummary.balance : 0;

  const summary = useMemo(() => {
    const totalIn =
      openingBalance +
      filteredIn.reduce((s, i) => {
        const val = effectivePaid(i);
        return s + (isNaN(val) ? 0 : val);
      }, 0);
    const totalOut = filteredOut.reduce((s, o) => {
      const val = Number(o.amount);
      return s + (isNaN(val) ? 0 : val);
    }, 0);
    return { totalIn, totalOut, balance: totalIn - totalOut };
  }, [filteredIn, filteredOut, openingBalance]);

  const fontStyles = getPrintFontStyles(fontSize);

  // Font weight class
  const weightClass = isBold ? "font-bold" : "font-normal";

  const tableSections = useMemo(() => {
    const sections: TableSection[] = [];

    for (const key of tableOrder) {
      switch (key) {
        case "revenue": {
          sections.push({
            key,
            title: "الوارد",
            thirdColumnHeader: "المتبقي",
            rows: filteredIn.map((i) => {
              const meta = parseMetadata(i.notes);
              const isOnlineInvoice = isOnlineInvoiceCashEntry(i);
              const remaining = meta
                ? meta.remaining
                : Number(i.remaining_amount || 0);
              return [
                isOnlineInvoice
                  ? `${i.customer_name} [أونلاين]`
                  : i.customer_name,
                effectivePaid(i),
                remaining !== 0 ? remaining : "-",
              ];
            }),
          });
          break;
        }
        case "expenses": {
          sections.push({
            key,
            title: "المنصرف (مصروفات)",
            rows: expenses.map((o) => [o.name, o.amount, o.notes || "-"]),
          });
          break;
        }
        case "purchases": {
          if (purchases.length > 0) {
            sections.push({
              key,
              title: "المنصرف (مشتريات)",
              rows: purchases.map((o) => [o.name, o.amount, o.notes || "-"]),
            });
          }
          break;
        }
        case "supplier": {
          if (supplierPayments.length > 0) {
            sections.push({
              key,
              title: "المنصرف (دفعات موردين)",
              rows: supplierPayments.map((o) => [o.name, o.amount, o.notes || "-"]),
            });
          }
          break;
        }
      }
    }

    return sections;
  }, [
    tableOrder,
    filteredIn,
    expenses,
    purchases,
    supplierPayments,
  ]);

  const tableColumns = useMemo(() => {
    const columns: TableSection[][] = [[], []];
    const columnHeights = [0, 0];

    for (const section of tableSections) {
      const targetColumn =
        columnHeights[0] <= columnHeights[1] ? 0 : 1;
      columns[targetColumn].push(section);
      columnHeights[targetColumn] += Math.max(section.rows.length, 1) + 2;
    }

    return columns;
  }, [tableSections]);

  // Render table based on section
  const renderTable = (section: TableSection) => {
    return (
      <DataTable
        key={section.key}
        title={section.title}
        thirdColumnHeader={section.thirdColumnHeader}
        fontStyles={fontStyles}
        compactCellPadding={fontStyles.cellPadding}
        isBold={isBold}
        rows={section.rows}
      />
    );
  };

  if (loading) {
    return (
      <div className="p-10 text-center text-lg">
        جاري تحميل بيانات التقرير...
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      className={`bg-white text-black min-h-screen ${weightClass}`}
      style={{ colorScheme: "light" }}
    >
      <div
        className={`${isLandscape ? "max-w-[1100px]" : "max-w-[800px]"} mx-auto border border-black p-5 print:border-0 print:p-5`}
      >
        {/* Header */}
        <div className="text-center mb-3">
          <h1
            className={isBold ? "font-black" : "font-bold"}
            style={{ fontSize: `${fontStyles.titleSize}px` }}
          >
            اليومية
          </h1>
          {toDate && (
            <p
              className={`${isBold ? "font-bold" : "font-semibold"} mt-1`}
              style={{ fontSize: `${fontStyles.dateSize}px` }}
            >
              {getArabicDayName(toDate)} - {formatDateAr(toDate)}
            </p>
          )}
        </div>

        {/* Summary Box */}
        <div className="border border-black p-2.5 mb-4">
          {showOpeningBalance && (
            <>
              <div
                className="text-center mb-2"
                style={{ fontSize: `${fontStyles.summarySize}px` }}
              >
                <span>
                  الرصيد المُرحَّل
                  {lastPrevDate
                    ? ` (حتى ${formatDateAr(lastPrevDate)})`
                    : ""}{" "}
                  :{" "}
                </span>
                <span className="font-bold">{formatMoney(openingBalance)}</span>
              </div>
              <hr className="border-gray-300 my-0.5" />
            </>
          )}
          <div
            className="flex justify-center gap-8"
            style={{ fontSize: `${fontStyles.summarySize}px` }}
          >
            <div>
              <span>إجمالي الوارد : </span>
              <span className="font-bold">{formatMoney(summary.totalIn)}</span>
            </div>
            <div>
              <span>إجمالي المنصرف : </span>
              <span className="font-bold">{formatMoney(summary.totalOut)}</span>
            </div>
          </div>
          <div
            className="text-center mt-2"
            style={{ fontSize: `${fontStyles.summarySize}px` }}
          >
            <span>الرصيد : </span>
            <span className="font-bold">{formatMoney(summary.balance)}</span>
          </div>
        </div>

        {/* Tables */}
        <div className="grid grid-cols-2 gap-3 items-start">
          {tableColumns.map((column, index) => (
            <div key={index} className="flex flex-col gap-2">
              {column.map((section) => renderTable(section))}
            </div>
          ))}
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page { size: ${isLandscape ? `${FIXED_CASH_SUMMARY_PAPER_SIZE} landscape` : FIXED_CASH_SUMMARY_PAPER_SIZE}; margin: 8mm; }
          body { background: #fff !important; }
          * { overflow: visible !important; }
        }
      `}</style>
    </div>
  );
}

/* ================= SUMMARY ROW ================= */

function SummaryRow({
  label,
  value,
  className = "text-sm",
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className={`flex justify-between items-center mb-2 ${className}`}>
      <span>{label} :</span>
      <span className="font-bold">{formatMoney(value)}</span>
    </div>
  );
}

/* ================= DATA TABLE ================= */

function DataTable({
  title,
  rows,
  thirdColumnHeader = "ملاحظات",
  fontStyles,
  compactCellPadding,
  isBold = false,
}: {
  title: string;
  rows: (string | number | null | undefined)[][];
  thirdColumnHeader?: string;
  fontStyles?: FontStyles;
  compactCellPadding?: string;
  isBold?: boolean;
}) {
  const weightClass = isBold ? "font-bold" : "font-normal";
  const titleWeight = isBold ? "font-black" : "font-bold";
  const tableFontSize = fontStyles?.tableSize ?? 12;
  const titleFontSize = fontStyles?.tableTitleSize ?? 14;
  const cellPadding = compactCellPadding || fontStyles?.cellPadding || "3px 5px";

  return (
    <div className="min-w-0 break-inside-avoid-page">
      <h3
        className={`${titleWeight} mb-1 mt-1 leading-tight`}
        style={{ fontSize: `${titleFontSize}px` }}
      >
        {title}
      </h3>
      <table
        className={`w-full border-collapse border border-black ${weightClass}`}
        style={{ fontSize: `${tableFontSize}px` }}
      >
        <thead>
          <tr className="bg-gray-100">
            <th
              className="border border-black text-right"
              style={{ padding: cellPadding }}
            >
              الاسم
            </th>
            <th
              className="border border-black text-center"
              style={{ padding: cellPadding }}
            >
              المبلغ
            </th>
            <th
              className="border border-black text-right"
              style={{ padding: cellPadding }}
            >
              {thirdColumnHeader}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td
                className="border border-black"
                style={{ padding: cellPadding }}
              >
                {formatCellValue(r[0])}
              </td>
              <td
                className="border border-black text-center"
                style={{ padding: cellPadding }}
              >
                {formatMoney(Number(r[1]))}
              </td>
              <td
                className="border border-black"
                style={{ padding: cellPadding }}
              >
                {formatCellValue(r[2])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ================= PAGE (with Suspense for useSearchParams) ================= */

export default function CashSummaryPrintPage() {
  return (
    <Suspense
      fallback={<div className="p-10 text-center">جاري التحميل...</div>}
    >
      <CashSummaryPrintInner />
    </Suspense>
  );
}
