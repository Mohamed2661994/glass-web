"use client";

import { useEffect, useMemo, useState } from "react";

const INVENTORY_SUMMARY_PRINT_STORAGE_KEY = "inventorySummaryPrintData";

const getWholesalePackageOnly = (value?: string) => {
  if (!value) return "";
  const firstPart = value.split("/")[0]?.trim();
  const withoutCartonWord = (firstPart || "")
    .replace(/^\s*كرتون(?:ة|ه)?\s*/, "")
    .trim();
  return withoutCartonWord || firstPart || "";
};

type PrintRow = {
  product_id: number;
  product_name: string;
  package_name?: string;
  manufacturer_name?: string;
  warehouse_name?: string;
  balance: number;
};

type PrintPayload = {
  rows: PrintRow[];
  selectedWarehouse?: string;
  searchText?: string;
  printedAt?: string;
};

const formatNumber = (value: number) =>
  Number(value || 0).toLocaleString("en-US");

const formatPrintedAt = (value?: string) => {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

export default function InventorySummaryPrintPage() {
  const [payload, setPayload] = useState<PrintPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(INVENTORY_SUMMARY_PRINT_STORAGE_KEY);
      if (raw) {
        setPayload(JSON.parse(raw));
      }
    } catch {
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const rows = useMemo(() => payload?.rows ?? [], [payload]);

  useEffect(() => {
    if (!loading && rows.length > 0) {
      const timer = setTimeout(() => window.print(), 500);
      return () => clearTimeout(timer);
    }
  }, [loading, rows]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-lg">
        جاري التحميل...
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div
        dir="rtl"
        className="min-h-screen flex items-center justify-center text-lg"
      >
        لا توجد بيانات جاهزة للطباعة
      </div>
    );
  }

  return (
    <>
      <style>{`
        body {
          margin: 0;
          background: #efefef;
          font-family: Tahoma, Arial, sans-serif;
        }

        .no-print {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin: 16px 0;
        }

        .no-print button {
          padding: 8px 18px;
          border: 1px solid #cfcfcf;
          border-radius: 8px;
          background: #fff;
          cursor: pointer;
          font-size: 14px;
        }

        .no-print .primary {
          background: #111;
          color: #fff;
          border-color: #111;
        }

        .page {
          width: 210mm;
          min-height: 297mm;
          margin: 0 auto 24px;
          background: #fff;
          color: #000;
          box-sizing: border-box;
          padding: 14mm 12mm;
          box-shadow: 0 0 14px rgba(0, 0, 0, 0.12);
          direction: rtl;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 14px;
          border-bottom: 2px solid #000;
          padding-bottom: 10px;
        }

        .header h1 {
          margin: 0 0 6px;
          font-size: 24px;
        }

        .meta {
          font-size: 13px;
          line-height: 1.7;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }

        th,
        td {
          border: 1px solid #000;
          padding: 8px 10px;
          text-align: center;
        }

        th {
          background: #f3f3f3;
          font-weight: 700;
        }

        td.name {
          text-align: right;
          font-weight: 600;
        }

        .count {
          margin-top: 12px;
          text-align: center;
          font-size: 13px;
          font-weight: 700;
        }

        @page {
          size: A4 portrait;
          margin: 10mm;
        }

        @media print {
          body {
            background: #fff;
          }

          .no-print {
            display: none !important;
          }

          .page {
            width: 100%;
            min-height: auto;
            margin: 0;
            box-shadow: none;
            padding: 0;
          }
        }
      `}</style>

      <div className="no-print">
        <button className="primary" onClick={() => window.print()}>
          طباعة
        </button>
        <button onClick={() => window.close()}>إغلاق</button>
      </div>

      <div className="page" dir="rtl">
        <div className="header">
          <div>
            <h1>طباعة اسم الصنف والرصيد</h1>
            <div className="meta">
              <div>المخزن: {payload?.selectedWarehouse || "الكل"}</div>
              <div>البحث: {payload?.searchText || "بدون"}</div>
            </div>
          </div>

          <div className="meta">
            <div>وقت الطباعة: {formatPrintedAt(payload?.printedAt)}</div>
            <div>عدد الأصناف: {formatNumber(rows.length)}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style={{ width: "8%" }}>#</th>
              <th style={{ width: "72%" }}>اسم الصنف - العبوة - المصنع</th>
              <th style={{ width: "20%" }}>الرصيد</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`${row.product_id}-${index}`}>
                <td>{formatNumber(index + 1)}</td>
                <td className="name">
                  {[
                    row.product_name,
                    getWholesalePackageOnly(row.package_name),
                    row.manufacturer_name?.trim() || "",
                  ]
                    .filter(Boolean)
                    .join(" - ")}
                </td>
                <td>{formatNumber(row.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="count">إجمالي الأصناف: {formatNumber(rows.length)}</div>
      </div>
    </>
  );
}
