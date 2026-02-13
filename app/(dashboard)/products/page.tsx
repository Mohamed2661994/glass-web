"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import api from "@/services/api";
import { ProductCard } from "@/components/product-card";
import { ProductCardSkeleton } from "@/components/product-card-skeleton";
import { ProductFormDialog } from "@/components/product-form-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Product {
  id: number;
  name: string;
  manufacturer: string;
  wholesale_package: string;
  retail_package: string;
  purchase_price: number;
  retail_purchase_price: number;
  wholesale_price: number;
  retail_price: number;
  barcode: string;
  discount_amount: number;
  is_active: boolean;
}

export default function ProductsPage() {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Barcode print modal
  const [barcodePrintProduct, setBarcodePrintProduct] =
    useState<Product | null>(null);
  const [barcodePrintCount, setBarcodePrintCount] = useState("1");
  const [showBarcodePrintModal, setShowBarcodePrintModal] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const limit = 15;

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/products");
      setAllProducts(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // فلترة
  const filteredProducts = allProducts.filter((product) => {
    const q = search.toLowerCase();
    return (
      product.name.toLowerCase().includes(q) ||
      (product.barcode && product.barcode.toLowerCase().includes(q))
    );
  });

  // حساب الصفحات
  const totalPages = Math.ceil(filteredProducts.length / limit);

  // تقطيع البيانات حسب الصفحة
  const startIndex = (page - 1) * limit;
  const currentProducts = filteredProducts.slice(
    startIndex,
    startIndex + limit,
  );

  // Toggle Active
  const handleToggle = async (id: number, value: boolean) => {
    setAllProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, is_active: value } : p)),
    );

    try {
      await api.put(`/admin/products/${id}/toggle`, {
        is_active: value,
      });
    } catch (err) {
      setAllProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, is_active: !value } : p)),
      );
    }
  };

  // أزرار أرقام الصفحات
  const renderPaginationNumbers = () => {
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      pages.push(
        <Button
          key={i}
          variant={page === i ? "default" : "outline"}
          size="sm"
          onClick={() => setPage(i)}
        >
          {i}
        </Button>,
      );
    }
    return pages;
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <h2 className="text-2xl font-bold">إدارة المنتجات</h2>

        <Button
          onClick={() => {
            setSelectedProduct(null);
            setDialogOpen(true);
          }}
        >
          إضافة منتج
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <Input
            placeholder="ابحث باسم المنتج أو الباركود..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </CardContent>
      </Card>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 max-w-6xl mx-auto">
          {Array.from({ length: 15 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : currentProducts.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            لا توجد منتجات
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 max-w-6xl mx-auto">
            {currentProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onToggle={(value) => handleToggle(product.id, value)}
                onEdit={() => {
                  setSelectedProduct(product);
                  setDialogOpen(true);
                }}
                onPrintBarcode={(p) => {
                  setBarcodePrintProduct(p);
                  setBarcodePrintCount("1");
                  setShowBarcodePrintModal(true);
                }}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-8 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                السابق
              </Button>

              {renderPaginationNumbers()}

              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage(page + 1)}
              >
                التالي
              </Button>
            </div>
          )}
        </>
      )}

      {/* Dialog */}
      <ProductFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        product={selectedProduct || undefined}
        onSuccess={fetchProducts}
      />

      {/* Barcode Print Modal */}
      <Dialog
        open={showBarcodePrintModal}
        onOpenChange={setShowBarcodePrintModal}
      >
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>طباعة باركود</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              {barcodePrintProduct?.name} — {barcodePrintProduct?.barcode}
            </p>
            <div className="space-y-2">
              <Label>عدد النسخ</Label>
              <Input
                type="number"
                min="1"
                value={barcodePrintCount}
                onChange={(e) => setBarcodePrintCount(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <Button
                className="flex-1"
                onClick={() => {
                  const count = Number(barcodePrintCount) || 1;
                  const url = `/products/${barcodePrintProduct?.id}/barcode?count=${count}`;
                  window.open(url, "_blank");
                  setShowBarcodePrintModal(false);
                }}
              >
                طباعة
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowBarcodePrintModal(false)}
              >
                إلغاء
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
