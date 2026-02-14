"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import api from "@/services/api";

const ROWS_PER_PAGE = 22;

const chunkItems = <T,>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
};

interface TransferRow {
  id: number;
  transfer_id: number;
  product_name: string;
  manufacturer: string;
  from_quantity: string;
  to_quantity: string;
  total_price: string;
  status: string;
}

export default function TransfersPrintPageWrapper() {
  return (
    <Suspense>
      <TransfersPrintPage />
    </Suspense>
  );
}

function TransfersPrintPage() {
  const searchParams = useSearchParams();
  const date = searchParams.get("date") || "";
  const [rows, setRows] = useState<TransferRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!date) return;
    (async () => {
      try {
        const { data } = await api.get("/stock-transfers/by-date", {
          params: { date },
        });
        const items = data?.items ?? data;
        setRows(Array.isArray(items) ? items : []);
      } catch {
        /* empty */
      } finally {
        setLoading(false);
      }
    })();
  }, [date]);

  useEffect(() => {
    if (!loading && rows.length > 0) {
      const timer = setTimeout(() => window.print(), 500);
      return () => clearTimeout(timer);
    }
  }, [loading, rows]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>جاري التحميل...</p>
      </div>
    );
  }

  if (!date || rows.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>لا توجد تحويلات</p>
      </div>
    );
  }

  const activeRows = rows.filter((r) => r.status !== "cancelled");
  const totalPrice = activeRows.reduce(
    (sum, r) => sum + (parseFloat(r.total_price) || 0),
    0,
  );
  const totalFromQty = activeRows.reduce(
    (sum, r) => sum + (parseInt(r.from_quantity) || 0),
    0,
  );

  const formattedDate = new Date(date).toLocaleDateString("ar-EG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const pages = chunkItems(activeRows, ROWS_PER_PAGE);
  const totalPages = pages.length;

  return (
    <>
      {/* eslint-disable-next-line react/no-unknown-property */}
      <style>{`
body { background: #e5e5e5; font-family: Tahoma, Arial; }

.no-print { text-align: center; margin: 16px; }
.no-print button {
  padding: 8px 24px;
  margin: 0 6px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  border: 1px solid #ccc;
  background: #fff;
}
.no-print button.primary { background: #000; color: #fff; border: none; }

.spread {
  display: flex;
  gap: 20px;
  justify-content: center;
  align-items: flex-start;
  flex-wrap: wrap;
  margin: 20px;
}

.page {
  width: 210mm;
  min-height: 297mm;
  background: white;
  color: #000 !important;
  padding: 12mm 10mm;
  box-shadow: 0 0 15px rgba(0,0,0,0.15);
  box-sizing: border-box;
  direction: rtl;
}

.page * { color: #000 !important; }

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 2px solid #000;
}

.header h1 {
  font-size: 18px;
  font-weight: bold;
  margin: 0;
}

.header-info {
  font-size: 12px;
  text-align: left;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

th {
  background: #f3f3f3;
  font-weight: bold;
  border-bottom: 2px solid #000;
}

td { border-bottom: 1px solid #ddd; }

th, td { padding: 6px 8px; text-align: center; }

td.name-cell { text-align: right; font-weight: 500; }

.cancelled { text-decoration: line-through; opacity: 0.4; }

.summary {
  margin-top: 16px;
  padding-top: 8px;
  border-top: 2px solid #000;
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  font-weight: bold;
}

.page-num {
  text-align: center;
  font-size: 10px;
  margin-top: 12px;
  color: #999 !important;
}

@page { size: A4 portrait; margin: 0; }

@media print {
  body * { visibility: hidden; }
  .spread, .spread * { visibility: visible; }
  body { margin: 0; padding: 0; background: white; }
  .no-print { display: none !important; }

  .spread {
    display: block !important;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    margin: 0;
    padding: 0;
    gap: 0 !important;
  }

  .page {
    display: block;
    width: 210mm;
    height: 297mm;
    margin: 0 auto;
    box-shadow: none;
    page-break-after: always;
    break-after: page;
    overflow: visible;
  }

  .page:last-child { page-break-after: auto; break-after: auto; }
}
      `}</style>

      {/* ===== أزرار ===== */}
      <div className="no-print">
        <button className="primary" onClick={() => window.print()}>
          طباعة
        </button>
        <button onClick={() => window.history.back()}>رجوع</button>
      </div>

      {/* ===== الصفحات ===== */}
      <div className="spread">
        {pages.map((pageRows, pageIdx) => (
          <div className="page" key={pageIdx}>
            {/* Header */}
            <div className="header">
              <h1>تحويلات المعرض</h1>
              <div className="header-info">
                <div>{formattedDate}</div>
                <div>عدد الأصناف: {activeRows.length}</div>
              </div>
            </div>

            {/* Table */}
            <table>
              <thead>
                <tr>
                  <th style={{ width: "5%" }}>#</th>
                  <th style={{ textAlign: "right", width: "30%" }}>
                    اسم الصنف
                  </th>
                  <th style={{ width: "15%" }}>المصنع</th>
                  <th style={{ width: "12%" }}>من المخزن</th>
                  <th style={{ width: "12%" }}>إلى المعرض</th>
                  <th style={{ width: "12%" }}>السعر</th>
                  <th style={{ width: "10%" }}>رقم التحويل</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, idx) => (
                  <tr key={row.id}>
                    <td>{pageIdx * ROWS_PER_PAGE + idx + 1}</td>
                    <td className="name-cell">{row.product_name}</td>
                    <td>{row.manufacturer}</td>
                    <td>{row.from_quantity}</td>
                    <td>{row.to_quantity}</td>
                    <td>
                      {Math.round(
                        parseFloat(row.total_price) || 0,
                      ).toLocaleString()}
                    </td>
                    <td>{row.transfer_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Summary on last page */}
            {pageIdx === totalPages - 1 && (
              <div className="summary">
                <div>إجمالي الكمية: {totalFromQty}</div>
                <div>
                  الإجمالي: {Math.round(totalPrice).toLocaleString()} جنيه
                </div>
              </div>
            )}

            {/* Page number */}
            {totalPages > 1 && (
              <div className="page-num">
                صفحة {pageIdx + 1} من {totalPages}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
