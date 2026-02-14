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

export default function PrintSelectedCustomersPage() {
  const [data, setData] = useState<CustomerBalanceItem[]>([]);
  const [loading, setLoading] = useState(true);

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
            تقرير مديونية العملاء المختارين
          </h1>
        </div>

        {/* Table */}
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 13,
          }}
        >
          <thead>
            <tr style={{ background: "#dce1e8" }}>
              <th style={thWide}>&nbsp;</th>
              <th style={thWide}>&nbsp;</th>
              <th style={thFit}>اسم العميل</th>
              <th style={thFit}>التاريخ</th>
              <th style={thFit}>المديونية</th>
              <th style={thWide}>فرق خصم</th>
              <th style={thWide}>المدفوع</th>
              <th style={thWide}>المتبقي</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, idx) => {
              const balanceDue = Number(item.balance_due || 0);

              return (
                <tr key={idx}>
                  <td style={tdStyle}>&nbsp;</td>
                  <td style={tdStyle}>&nbsp;</td>
                  <td
                    style={{
                      ...tdStyle,
                      fontWeight: "bold",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.customer_name}
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                    {item.last_invoice_date
                      ? new Date(item.last_invoice_date).toLocaleDateString(
                          "en-US",
                        )
                      : ""}
                  </td>
                  <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
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
const thFit: React.CSSProperties = {
  border: "1px solid #aaa",
  padding: "4px 6px",
  textAlign: "center",
  fontWeight: "bold",
  whiteSpace: "nowrap",
  width: "1%",
};

const thWide: React.CSSProperties = {
  border: "1px solid #aaa",
  padding: "4px 6px",
  textAlign: "center",
  fontWeight: "bold",
};

const tdStyle: React.CSSProperties = {
  border: "1px solid #ccc",
  padding: "4px 6px",
  textAlign: "center",
};
