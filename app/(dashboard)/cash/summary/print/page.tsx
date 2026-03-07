"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import api from "@/services/api";

/* ================= TYPES ================= */

type CashInItem = {
  id: number;
  transaction_date: string;
  amount: number;
  paid_amount: number;
  remaining_amount: number;
  source_type: "manual" | "invoice" | "customer_payment";
  customer_name: string;
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

/* ================= HELPERS ================= */

const toDateOnly = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

const formatMoney = (n: number) => Math.round(n).toLocaleString("ar-EG");

const getArabicDayName = (d: Date) => {
  const days = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
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

const effectivePaid = (i: CashInItem) => {
  const meta = parseMetadata(i.notes);
  if (meta) return meta.paid;
  return i.source_type === "invoice" ? Number(i.paid_amount) : Number(i.amount);
};

/* ================= INNER COMPONENT ================= */

function CashSummaryPrintInner() {
  const searchParams = useSearchParams();
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const includeOpeningBalance = searchParams.get("includeOpeningBalance");
  const orientation = searchParams.get("orientation") || "portrait";
  const fontSize = searchParams.get("fontSize") || "medium";
  const tableOrderParam = searchParams.get("tableOrder") || "revenue,expenses,purchases,supplier";
  const tableOrder = tableOrderParam.split(",");
  const isLandscape = orientation === "landscape";

  const showOpeningBalance = includeOpeningBalance === "1";

  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;

  const [cashIn, setCashIn] = useState<CashInItem[]>([]);
  const [cashOut, setCashOut] = useState<CashOutItem[]>([]);
  const [loading, setLoading] = useState(true);

  /* ================= FETCH ================= */

  useEffect(() => {
    const stored = localStorage.getItem("user");
    const branchId = stored ? JSON.parse(stored).branch_id : 1;
    (async () => {
      try {
        const [inRes, outRes] = await Promise.all([
          api.get("/cash-in", { params: { branch_id: branchId } }),
          api.get("/cash/out", {
            params: { branch_id: branchId, limit: 100000 },
          }),
        ]);
        setCashIn(inRes.data.data || []);
        setCashOut(outRes.data.data || []);
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

  const filteredIn = cashIn.filter((i) => inRange(i.transaction_date));
  const filteredOut = cashOut.filter((o) => inRange(o.transaction_date));
  const expenses = filteredOut.filter((o) => o.entry_type === "expense");
  const purchases = filteredOut.filter((o) => o.entry_type === "purchase");
  const supplierPayments = filteredOut.filter(
    (o) => o.entry_type === "supplier_payment",
  );

  const fromDateTime = fromDate ? toDateOnly(fromDate) : null;

  const prevCashIn = fromDateTime
    ? cashIn.filter(
        (i) => toDateOnly(new Date(i.transaction_date)) < fromDateTime,
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

  // Font size configuration
  const fontSizeClasses = {
    small: {
      title: "text-lg",
      date: "text-xs",
      summary: "text-xs",
      tableTitle: "text-[13px]",
      table: "text-[10px]",
      cell: "p-1",
    },
    medium: {
      title: "text-xl",
      date: "text-sm",
      summary: "text-sm",
      tableTitle: "text-[15px]",
      table: "text-xs",
      cell: "p-1.5",
    },
    large: {
      title: "text-2xl",
      date: "text-base",
      summary: "text-base",
      tableTitle: "text-[17px]",
      table: "text-sm",
      cell: "p-2",
    },
  };

  const fontStyles = fontSizeClasses[fontSize as keyof typeof fontSizeClasses] || fontSizeClasses.medium;

  // Render table based on key
  const renderTable = (key: string) => {
    switch (key) {
      case "revenue":
        return (
          <DataTable
            key="revenue"
            title="الوارد"
            thirdColumnHeader="المتبقي"
            fontStyles={fontStyles}
            rows={filteredIn.map((i) => {
              const meta = parseMetadata(i.notes);
              const remaining = meta
                ? meta.remaining
                : Number(i.remaining_amount || 0);
              return [
                i.customer_name,
                effectivePaid(i),
                remaining !== 0 ? remaining : "-",
              ];
            })}
          />
        );
      case "expenses":
        return (
          <DataTable
            key="expenses"
            title="المنصرف (مصروفات)"
            fontStyles={fontStyles}
            rows={expenses.map((o) => [o.name, o.amount, o.notes || "-"])}
          />
        );
      case "purchases":
        return purchases.length > 0 ? (
          <DataTable
            key="purchases"
            title="المنصرف (مشتريات)"
            fontStyles={fontStyles}
            rows={purchases.map((o) => [o.name, o.amount, o.notes || "-"])}
          />
        ) : null;
      case "supplier":
        return supplierPayments.length > 0 ? (
          <DataTable
            key="supplier"
            title="المنصرف (دفعات موردين)"
            fontStyles={fontStyles}
            rows={supplierPayments.map((o) => [
              o.name,
              o.amount,
              o.notes || "-",
            ])}
          />
        ) : null;
      default:
        return null;
    }
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
      className="bg-white text-black min-h-screen"
      style={{ colorScheme: "light" }}
    >
      <div
        className={`${isLandscape ? "max-w-[1100px]" : "max-w-[800px]"} mx-auto border border-black p-5 print:border-0 print:p-5`}
      >
        {/* Header */}
        <div className="text-center mb-3">
          <h1 className={`${fontStyles.title} font-bold`}>اليومية</h1>
          {toDate && (
            <p className={`${fontStyles.date} font-semibold mt-1`}>
              {getArabicDayName(toDate)} - {toDate.toLocaleDateString("ar-EG")}
            </p>
          )}
        </div>

        {/* Summary Box */}
        <div className="border border-black p-3 mb-5">
          {showOpeningBalance && (
            <>
              <div className={`text-center mb-2 ${fontStyles.summary}`}>
                <span>الرصيد المُرحَّل{lastPrevDate ? ` (حتى ${lastPrevDate.toLocaleDateString("ar-EG")})` : ""} : </span>
                <span className="font-bold">{formatMoney(openingBalance)}</span>
              </div>
              <hr className="border-gray-300 my-1" />
            </>
          )}
          <div className={`flex justify-center gap-8 ${fontStyles.summary}`}>
            <div>
              <span>إجمالي الوارد : </span>
              <span className="font-bold">{formatMoney(summary.totalIn)}</span>
            </div>
            <div>
              <span>إجمالي المنصرف : </span>
              <span className="font-bold">{formatMoney(summary.totalOut)}</span>
            </div>
          </div>
          <div className={`text-center mt-2 ${fontStyles.summary}`}>
            <span>الرصيد : </span>
            <span className="font-bold">{formatMoney(summary.balance)}</span>
          </div>
        </div>

        {/* Tables */}
        <div className="flex gap-4 items-start flex-wrap">
          {tableOrder.map((key) => renderTable(key))}
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page { size: ${isLandscape ? "A4 landscape" : "A4"}; margin: 15mm; }
          body { background: #fff !important; }
          * { overflow: visible !important; }
        }
      `}</style>
    </div>
  );
}

/* ================= SUMMARY ROW ================= */

function SummaryRow({ label, value, className = "text-sm" }: { label: string; value: number; className?: string }) {
  return (
    <div className={`flex justify-between items-center mb-2 ${className}`}>
      <span>{label} :</span>
      <span className="font-bold">{formatMoney(value)}</span>
    </div>
  );
}

/* ================= DATA TABLE ================= */

type FontStyles = {
  title: string;
  date: string;
  summary: string;
  tableTitle: string;
  table: string;
  cell: string;
};

function DataTable({
  title,
  rows,
  thirdColumnHeader = "ملاحظات",
  fontStyles,
}: {
  title: string;
  rows: (string | number | null | undefined)[][];
  thirdColumnHeader?: string;
  fontStyles?: FontStyles;
}) {
  const tableClass = fontStyles?.table || "text-xs";
  const titleClass = fontStyles?.tableTitle || "text-[15px]";
  const cellClass = fontStyles?.cell || "p-1.5";

  return (
    <div className="flex-1 min-w-[200px]">
      <h3 className={`font-bold ${titleClass} mb-2 mt-2`}>{title}</h3>
      <table className={`w-full border-collapse border border-black ${tableClass}`}>
        <thead>
          <tr className="bg-gray-100">
            <th className={`border border-black ${cellClass} text-right`}>الاسم</th>
            <th className={`border border-black ${cellClass} text-center`}>المبلغ</th>
            <th className={`border border-black ${cellClass} text-right`}>
              {thirdColumnHeader}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className={`border border-black ${cellClass}`}>{r[0]}</td>
              <td className={`border border-black ${cellClass} text-center`}>
                {formatMoney(Number(r[1]))}
              </td>
              <td className={`border border-black ${cellClass}`}>{r[2] || "-"}</td>
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
