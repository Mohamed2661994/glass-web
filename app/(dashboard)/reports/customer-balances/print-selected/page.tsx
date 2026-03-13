"use client";

import { useEffect, useState } from "react";

/* ========== Types ========== */
type CustomerBalanceItem = {
  customer_name: string;
  total_sales: number;
  total_paid: number;
  balance_due: number;
  last_invoice_date?: string | null;
};

/* ========== Helpers ========== */
const formatMoney = (n: number) => Number(n).toLocaleString();

const formatTodayHeader = () => {
  const today = new Date();
  const weekday = new Intl.DateTimeFormat("ar-EG", {
    weekday: "long",
  }).format(today);

  return `${weekday} ${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;
};

export default function PrintSelectedCustomersPage() {
  const [data, setData] = useState<CustomerBalanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const reportDate = formatTodayHeader();

  useEffect(() => {
    const stored = localStorage.getItem("printSelectedCustomers");
    if (stored) {
      try {
        setData(JSON.parse(stored));
      } catch {
        /* ignore */
      }
    }
    setLoading(false);
  }, []);

  /* Auto-print */
  useEffect(() => {
    if (!loading && data.length > 0) {
      const timer = setTimeout(() => window.print(), 600);
      return () => clearTimeout(timer);
    }
  }, [loading, data]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", fontSize: 18 }}>
        جاري التحميل...
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div dir="rtl" style={{ padding: 40, textAlign: "center", fontSize: 18 }}>
        لا يوجد عملاء مختارين
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
        padding: "0",
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            background: "#3b5998",
            color: "#fff",
            padding: "10px 12px",
            textAlign: "center",
          }}
        >
          <h1 style={{ fontSize: 18, fontWeight: "bold", margin: 0 }}>
            حسابات السوق
          </h1>
          <div style={{ fontSize: 14, marginTop: 6 }}>{reportDate}</div>
        </div>

        {/* Table */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 13,
            tableLayout: "fixed",
          }}
        >
          <thead>
            <tr style={{ background: "#dce1e8" }}>
              <th style={thBlank}>&nbsp;</th>
              <th style={thBlankExpanded}>&nbsp;</th>
              <th style={thCustomer}>اسم العميل</th>
              <th style={thDebt}>المديونية</th>
              <th style={thCompact}>فرق خصم</th>
              <th style={thCompact}>المدفوع</th>
              <th style={thRemaining}>المتبقي</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, idx) => {
              const balanceDue = Number(item.balance_due || 0);

              return (
                <tr key={idx}>
                  <td style={tdStyle}>&nbsp;</td>
                  <td style={tdStyle}>&nbsp;</td>
                  <td style={tdCustomer}>
                    {item.customer_name}
                  </td>
                  <td style={tdMoney}>
                    {balanceDue > 0 ? formatMoney(balanceDue) : ""}
                  </td>
                  <td style={tdStyle}>&nbsp;</td>
                  <td style={tdStyle}>&nbsp;</td>
                  <td style={tdStyle}>&nbsp;</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ========== Shared cell styles ========== */
const thBase: React.CSSProperties = {
  border: "1px solid #aaa",
  padding: "4px 6px",
  textAlign: "center",
  fontWeight: "bold",
  whiteSpace: "nowrap",
};

const thBlank: React.CSSProperties = {
  ...thBase,
  width: "8%",
};

const thBlankExpanded: React.CSSProperties = {
  ...thBase,
  width: "18%",
};

const thCustomer: React.CSSProperties = {
  ...thBase,
  width: "16%",
};

const thDebt: React.CSSProperties = {
  ...thBase,
  width: "12%",
};

const thCompact: React.CSSProperties = {
  ...thBase,
  width: "10%",
};

const thRemaining: React.CSSProperties = {
  ...thBase,
  width: "12%",
};

const tdStyle: React.CSSProperties = {
  border: "1px solid #ccc",
  padding: "4px 6px",
  textAlign: "center",
};

const tdCustomer: React.CSSProperties = {
  ...tdStyle,
  fontWeight: "bold",
  whiteSpace: "nowrap",
};

const tdMoney: React.CSSProperties = {
  ...tdStyle,
  whiteSpace: "nowrap",
};
