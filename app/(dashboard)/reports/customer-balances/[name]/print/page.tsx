"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import api from "@/services/api";

/* ========== Types ========== */
type Invoice = {
  record_type: "invoice" | "payment";
  invoice_id: number;
  invoice_date: string;
  total: number;
  paid_amount: number;
  remaining_amount: number;
};

/* ========== Helpers ========== */
const formatMoney = (n: number) => Number(n).toFixed(2);

/* ========== Inner Component ========== */
function CustomerStatementPrintInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const customerName = decodeURIComponent(params.name as string);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const [data, setData] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  /* ========== Fetch ========== */
  const fetchDetails = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/reports/customer-debt-details", {
        params: {
          customer_name: customerName,
          from: from || undefined,
          to: to || undefined,
        },
      });
      setData(res.data || []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [customerName, from, to]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  /* ========== Auto-print ========== */
  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => window.print(), 600);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  /* ========== Totals ========== */
  const totalAll = useMemo(
    () =>
      data
        .filter((i) => i.record_type === "invoice")
        .reduce((s, i) => s + Number(i.total), 0),
    [data],
  );

  const totalPaid = useMemo(
    () => data.reduce((s, i) => s + Number(i.paid_amount), 0),
    [data],
  );

  const netDebt = totalAll - totalPaid;

  /* ========== Running Balance ========== */
  const runningBalances = useMemo(() => {
    const balances: number[] = [];
    let balance = 0;
    for (let i = 0; i < data.length; i++) {
      balances.push(balance);
      const row = data[i];
      if (row.record_type === "invoice") {
        balance += Number(row.total) - Number(row.paid_amount);
      } else {
        balance -= Number(row.paid_amount);
      }
    }
    return balances;
  }, [data]);

  const dateRange =
    from || to
      ? `${from ? new Date(from).toLocaleDateString("ar-EG") : "--"} — ${to ? new Date(to).toLocaleDateString("ar-EG") : "---"}`
      : "-- ---";

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", fontSize: 18 }}>
        جاري تحميل بيانات كشف الحساب...
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      style={{
        background: "#fff",
        color: "#000",
        minHeight: "100vh",
        colorScheme: "light",
        fontFamily: "Arial, sans-serif",
        padding: "10px",
      }}
    >
      <div
        style={{
          maxWidth: 750,
          margin: "0 auto",
          padding: "10px 10px",
        }}
      >
        {/* Header */}
        <h1
          style={{
            textAlign: "center",
            fontSize: 24,
            fontWeight: "bold",
            marginBottom: 16,
          }}
        >
          كشف حساب عميل
        </h1>

        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 14, marginBottom: 4 }}>
            <span style={{ fontWeight: "bold" }}>اسم العميل:</span>{" "}
            {customerName}
          </p>
          <p style={{ fontSize: 14 }}>
            <span style={{ fontWeight: "bold" }}>الفترة:</span> {dateRange}
          </p>
        </div>

        {/* Table */}
        {data.length > 0 ? (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 13,
              marginBottom: 20,
            }}
          >
            <thead>
              <tr style={{ background: "#e5e5e5" }}>
                <th style={thStyle}>النوع</th>
                <th style={thStyle}>رقم</th>
                <th style={thStyle}>التاريخ</th>
                <th style={thStyle}>الحساب السابق</th>
                <th style={thStyle}>الإجمالي</th>
                <th style={thStyle}>المدفوع</th>
                <th style={thStyle}>الباقي</th>
              </tr>
            </thead>
            <tbody>
              {data.map((inv, idx) => (
                <tr
                  key={`${inv.record_type}-${inv.invoice_id}-${idx}`}
                  style={{
                    background:
                      inv.record_type === "payment" ? "#f0fdf4" : "#fefce8",
                  }}
                >
                  <td style={tdStyle}>
                    {inv.record_type === "invoice" ? "فاتورة" : "سند دفع"}
                  </td>
                  <td style={tdStyle}>{inv.invoice_id}</td>
                  <td style={tdStyle}>
                    {new Date(inv.invoice_date).toLocaleDateString("ar-EG")}
                  </td>
                  <td style={tdStyle}>
                    {runningBalances[idx] === 0
                      ? "—"
                      : formatMoney(runningBalances[idx])}
                  </td>
                  <td style={tdStyle}>
                    {inv.record_type === "invoice"
                      ? formatMoney(Number(inv.total))
                      : "—"}
                  </td>
                  <td style={tdStyle}>
                    {formatMoney(Number(inv.paid_amount))}
                  </td>
                  <td style={tdStyle}>
                    {inv.record_type === "invoice"
                      ? formatMoney(Number(inv.remaining_amount))
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ textAlign: "center", padding: "40px 0", color: "#888" }}>
            لا توجد بيانات لهذا العميل
          </p>
        )}

        {/* Summary */}
        {data.length > 0 && (
          <div style={{ textAlign: "right", fontSize: 14 }}>
            <p style={{ marginBottom: 4 }}>
              <span style={{ fontWeight: "bold" }}>إجمالي الفواتير:</span>{" "}
              {formatMoney(totalAll)}
            </p>
            <p style={{ marginBottom: 4 }}>
              <span style={{ fontWeight: "bold" }}>إجمالي المدفوع:</span>{" "}
              {formatMoney(totalPaid)}
            </p>
            <p
              style={{
                fontSize: 18,
                fontWeight: "bold",
                marginTop: 8,
                color: netDebt > 0 ? "#dc2626" : netDebt < 0 ? "#16a34a" : "#000",
              }}
            >
              صافي المديونية: {formatMoney(netDebt)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ========== Shared cell styles ========== */
const thStyle: React.CSSProperties = {
  border: "1px solid #000",
  padding: "6px 8px",
  textAlign: "center",
  fontWeight: "bold",
};

const tdStyle: React.CSSProperties = {
  border: "1px solid #000",
  padding: "6px 8px",
  textAlign: "center",
};

/* ========== Page wrapper (Suspense for useSearchParams) ========== */
export default function CustomerStatementPrintPage() {
  return (
    <Suspense
      fallback={<div className="p-10 text-center text-lg">جاري التحميل...</div>}
    >
      <CustomerStatementPrintInner />
    </Suspense>
  );
}
