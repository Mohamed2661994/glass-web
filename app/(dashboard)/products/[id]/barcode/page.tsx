"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import api from "@/services/api";
import JsBarcode from "jsbarcode";

interface Product {
  id: number;
  name: string;
  barcode: string;
  retail_price: number;
}

export default function BarcodePrintPage() {
  const { id } = useParams();
  const searchParams = useSearchParams();
  const count = Number(searchParams.get("count")) || 1;

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await api.get(`/admin/products`);
        const found = res.data.find((p: Product) => p.id === Number(id));
        setProduct(found || null);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchProduct();
  }, [id]);

  useEffect(() => {
    if (product && !loading) {
      // Generate barcodes
      document.querySelectorAll(".barcode-svg").forEach((el) => {
        JsBarcode(el, product.barcode, {
          format: "CODE128",
          width: 1.2,
          height: 30,
          displayValue: true,
          fontSize: 10,
          margin: 1,
        });
      });

      setTimeout(() => window.print(), 500);
    }
  }, [product, loading]);

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <p>جاري التحميل...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <p>المنتج غير موجود</p>
      </div>
    );
  }

  const barcodes = Array.from({ length: count }, (_, i) => i);

  return (
    <>
      <style>{`
body {
  margin: 0;
  padding: 0;
  font-family: Arial, sans-serif;
  background: #fff;
}

.no-print { text-align: center; padding: 16px; }
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

.barcode-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  padding: 0;
  justify-content: flex-start;
}

.barcode-item {
  width: 25%;
  height: 22mm;
  border: 1px dashed #eee;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1mm;
  box-sizing: border-box;
  text-align: center;
}

.barcode-item .product-name {
  font-size: 8px;
  font-weight: bold;
  margin-bottom: 2px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  max-width: 100%;
}

.barcode-item .product-price {
  font-size: 9px;
  font-weight: bold;
  margin-top: 1px;
}

@page {
  size: auto;
  margin: 0;
}

@media print {
  body * { visibility: hidden; }
  .barcode-grid, .barcode-grid * { visibility: visible; }

  .no-print { display: none !important; }

  .barcode-grid {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    padding: 0;
    margin: 0;
  }

  .barcode-item {
    border: none;
    page-break-inside: avoid;
    break-inside: avoid;
  }
}
      `}</style>

      <div className="no-print">
        <button className="primary" onClick={() => window.print()}>
          طباعة
        </button>
        <button onClick={() => window.close()}>إغلاق</button>
      </div>

      <div className="barcode-grid">
        {barcodes.map((i) => (
          <div className="barcode-item" key={i}>
            <div className="product-name">{product.name}</div>
            <svg className="barcode-svg" />
          </div>
        ))}
      </div>
    </>
  );
}
