"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import api from "@/services/api";

/* ========== Types ========== */
type StatementRow = {
  record_type: "invoice" | "payment";
  record_id: number;
  record_date: string;
  total: number;
  paid_amount: number;
  remaining_amount: number;
  notes?: string | null;
  permission_number?: string | null;
};

/* ========== Helpers ========== */
const formatMoney = (n: number) => Number(n).toFixed(2);

/* ========== Inner Component ========== */
function SupplierStatementPrintInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const supplierId = params.id as string;
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const [supplierName, setSupplierName] = useState("");
  const [data, setData] = useState<StatementRow[]>([]);
  const [loading, setLoading] = useState(true);

  /* ========== Fetch supplier info ========== */
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get(`/suppliers/${supplierId}`);
        setSupplierName(res.data.name || `مورد #${supplierId}`);
      } catch {
        setSupplierName(`مورد #${supplierId}`);
      }
    })();
  }, [supplierId]);

  /* ========== Fetch statement ========== */
  const fetchDetails = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/reports/supplier-debt-details", {
        params: {
          supplier_id: supplierId,
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
  }, [supplierId, from, to]);

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
  const invoices = data.filter((r) => r.record_type === "invoice");
  const payments = data.filter((r) => r.record_type === "payment");

  const totalPurchases = invoices.reduce((s, i) => s + Number(i.total), 0);
  const totalPaidInvoices = invoices.reduce(
    (s, i) => s + Number(i.paid_amount),
    0,
  );
  const totalPayments = payments.reduce((s, i) => s + Number(i.paid_amount), 0);
  const totalPaid = totalPaidInvoices + totalPayments;
  const netDebt = totalPurchases - totalPaid;

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
          كشف حساب مورد
        </h1>

        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 14, marginBottom: 4 }}>
            <span style={{ fontWeight: "bold" }}>اسم المورد:</span>{" "}
            {supplierName}
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
              {data.map((row, idx) => (
                <tr
                  key={`${row.record_type}-${row.record_id}-${idx}`}
                  style={{
                    background:
                      row.record_type === "payment" ? "#f0fdf4" : "#fefce8",
                  }}
                >
                  <td style={tdStyle}>
                    {row.record_type === "invoice"
                      ? "فاتورة مشتريات"
                      : "دفعة نقدية"}
                  </td>
                  <td style={tdStyle}>
                    {row.record_type === "invoice"
                      ? `#${row.record_id}`
                      : row.permission_number || `#${row.record_id}`}
                  </td>
                  <td style={tdStyle}>
                    {new Date(row.record_date).toLocaleDateString("ar-EG")}
                  </td>
                  <td style={tdStyle}>
                    {runningBalances[idx] === 0
                      ? "—"
                      : formatMoney(runningBalances[idx])}
                  </td>
                  <td style={tdStyle}>
                    {row.record_type === "invoice"
                      ? formatMoney(Number(row.total))
                      : "—"}
                  </td>
                  <td style={tdStyle}>
                    {formatMoney(Number(row.paid_amount))}
                  </td>
                  <td style={tdStyle}>
                    {row.record_type === "invoice"
                      ? formatMoney(Number(row.remaining_amount))
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ textAlign: "center", padding: "40px 0", color: "#888" }}>
            لا توجد بيانات لهذا المورد
          </p>
        )}

        {/* Summary */}
        {data.length > 0 && (
          <div style={{ textAlign: "right", fontSize: 14 }}>
            <p style={{ marginBottom: 4 }}>
              <span style={{ fontWeight: "bold" }}>إجمالي المشتريات:</span>{" "}
              {formatMoney(totalPurchases)}
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
                color:
                  netDebt > 0 ? "#dc2626" : netDebt < 0 ? "#16a34a" : "#000",
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
export default function SupplierStatementPrintPage() {
  return (
    <Suspense
      fallback={<div className="p-10 text-center text-lg">جاري التحميل...</div>}
    >
      <SupplierStatementPrintInner />
    </Suspense>
  );
}
