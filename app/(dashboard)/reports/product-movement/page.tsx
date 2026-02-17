"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "@/services/api";
import { highlightText } from "@/lib/highlight-text";
import { useAuth } from "@/app/context/auth-context";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Search } from "lucide-react";

/* ========== Types ========== */
type MovementItem = {
  created_at?: string | null;
  movement_date?: string | null;
  invoice_date?: string | null;
  entry_date?: string | null;
  product_name: string;
  manufacturer_name?: string | null;
  warehouse_name: string;
  movement_type: string;
  quantity: number;
  note?: string | null;
  party_name?: string | null;
  invoice_type?: string | null;
  invoice_movement_type?: string | null;
  package_name?: string | null;
};

type Product = {
  id: number;
  name: string;
  manufacturer?: string | null;
  manufacturer_name?: string | null;
};

type WarehouseFilter = "الكل" | "المخزن الرئيسي" | "مخزن المعرض";

/* ========== Component ========== */
export default function ProductMovementPage() {
  const { user } = useAuth();
  const isShowroomUser = user?.branch_id === 1;
  const isWarehouseUser = user?.branch_id === 2;

  const [data, setData] = useState<MovementItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseFilter>(
    isShowroomUser
      ? "مخزن المعرض"
      : isWarehouseUser
        ? "المخزن الرئيسي"
        : "الكل",
  );

  const searchInputRef = useRef<HTMLInputElement>(null);

  /* ========== Fetch Products ========== */
  const fetchProducts = useCallback(async () => {
    try {
      const res = await api.get("/reports/products");
      setProducts(Array.isArray(res.data) ? res.data : []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  /* ========== Fetch Movement ========== */
  const fetchMovement = useCallback(async () => {
    if (!selectedProduct) return;
    try {
      setLoading(true);
      const res = await api.get("/reports/product-movement", {
        params: {
          product_name: selectedProduct.name,
          from: fromDate || undefined,
          to: toDate || undefined,
        },
      });
      setData(Array.isArray(res.data) ? res.data : []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedProduct, fromDate, toDate]);

  useEffect(() => {
    if (selectedProduct) fetchMovement();
  }, [fetchMovement, selectedProduct]);

  /* ========== Filter ========== */
  const filteredData = useMemo(() => {
    let result = data;

    if (isShowroomUser) {
      result = result.filter((i) =>
        (i.warehouse_name || "").trim().includes("المعرض"),
      );
    } else if (isWarehouseUser) {
      result = result.filter(
        (i) =>
          (i.warehouse_name || "").trim().includes("الرئيسي") ||
          (i.warehouse_name || "").trim().includes("المخزن الرئيسي"),
      );
    }

    if (!isShowroomUser && !isWarehouseUser && selectedWarehouse !== "الكل") {
      result = result.filter(
        (item) =>
          (item.warehouse_name || "").trim() === selectedWarehouse.trim(),
      );
    }

    return result;
  }, [data, selectedWarehouse, isShowroomUser, isWarehouseUser]);

  /* ========== Product list filter ========== */
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const q = productSearch.toLowerCase();
    return products.filter(
      (p) =>
        String(p.id).includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.manufacturer || p.manufacturer_name || "").toLowerCase().includes(q),
    );
  }, [products, productSearch]);

  /* ========== Warehouse buttons ========== */
  const warehouseOptions: WarehouseFilter[] =
    !isShowroomUser && !isWarehouseUser
      ? ["الكل", "المخزن الرئيسي", "مخزن المعرض"]
      : [];

  /* ========== Get date for row ========== */
  const getDate = (item: MovementItem) => {
    const d =
      item.entry_date ||
      item.invoice_date ||
      item.movement_date ||
      item.created_at;
    return d ? new Date(d).toLocaleDateString("ar-EG") : "—";
  };

  return (
    <PageContainer size="xl">
      <div dir="rtl" className="space-y-4 py-6">
        <h1 className="text-2xl font-bold text-center">تقرير حركة الأصناف</h1>

        {/* Product selection */}
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={() => {
              setShowProductModal(true);
              setProductSearch("");
              setTimeout(() => searchInputRef.current?.focus(), 100);
            }}
            className="min-w-[250px]"
          >
            {selectedProduct ? selectedProduct.name : "اختر صنف لعرض حركته"}
          </Button>
        </div>

        {/* Selected product badge */}
        {selectedProduct && (
          <div className="flex justify-center">
            <Badge className="text-sm px-4 py-1">
              {selectedProduct.name}
              {selectedProduct.manufacturer_name &&
                ` - ${selectedProduct.manufacturer_name}`}
            </Badge>
          </div>
        )}

        {/* Filters */}
        {selectedProduct && (
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 justify-center items-end">
                {/* Warehouse filter */}
                {warehouseOptions.length > 0 && (
                  <div className="flex gap-2">
                    {warehouseOptions.map((w) => (
                      <Button
                        key={w}
                        variant={
                          selectedWarehouse === w ? "default" : "outline"
                        }
                        size="sm"
                        onClick={() => setSelectedWarehouse(w)}
                      >
                        {w}
                      </Button>
                    ))}
                  </div>
                )}

                {/* Date range */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">
                    من تاريخ
                  </label>
                  <Input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-44"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">
                    إلى تاريخ
                  </label>
                  <Input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-44"
                  />
                </div>

                {(fromDate || toDate) && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      setFromDate("");
                      setToDate("");
                    }}
                  >
                    مسح التاريخ
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Table */}
        {!loading && filteredData.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-center">التاريخ</TableHead>
                      <TableHead className="text-center">المخزن</TableHead>
                      <TableHead className="text-center">النوع</TableHead>
                      <TableHead className="text-center">الكمية</TableHead>
                      <TableHead className="text-center">العبوة</TableHead>
                      <TableHead className="text-center">الطرف</TableHead>
                      <TableHead className="text-center">ملاحظات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.map((item, idx) => {
                      const mt =
                        item.movement_type || item.invoice_movement_type || "";
                      const isIn = [
                        "purchase",
                        "transfer_in",
                        "replace_in",
                        "in",
                      ].includes(mt);

                      return (
                        <TableRow key={idx}>
                          <TableCell className="text-center text-xs">
                            {getDate(item)}
                          </TableCell>
                          <TableCell className="text-center text-xs">
                            {item.warehouse_name}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={isIn ? "default" : "destructive"}>
                              {isIn ? "وارد" : "صادر"}
                            </Badge>
                          </TableCell>
                          <TableCell
                            className={`text-center font-bold ${isIn ? "text-green-600" : "text-red-600"}`}
                          >
                            {item.quantity}
                          </TableCell>
                          <TableCell className="text-center text-xs">
                            {item.package_name || "—"}
                          </TableCell>
                          <TableCell className="text-center text-xs font-medium">
                            {item.party_name || "—"}
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">
                            {item.note || "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty */}
        {!loading && selectedProduct && filteredData.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            لا توجد حركات لهذا الصنف
          </div>
        )}

        {!selectedProduct && !loading && (
          <div className="text-center py-16 text-muted-foreground">
            اختر صنف لعرض حركته
          </div>
        )}

        {/* Count */}
        {!loading && filteredData.length > 0 && (
          <div className="text-center">
            <Badge variant="secondary">{filteredData.length} حركة</Badge>
          </div>
        )}
      </div>

      {/* ========== Product Selection Modal ========== */}
      <Dialog open={showProductModal} onOpenChange={setShowProductModal}>
        <DialogContent
          dir="rtl"
          className="max-w-md p-0 flex flex-col"
          style={{ height: 420, maxHeight: "75vh" }}
        >
          <DialogHeader className="p-4 border-b shrink-0">
            <DialogTitle>اختيار صنف</DialogTitle>
          </DialogHeader>

          {/* Search */}
          <div className="px-4 pt-2">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="بحث بالاسم أو المصنع..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pr-9"
              />
            </div>
          </div>

          {/* Product list */}
          <div className="flex-1 overflow-y-auto p-2">
            {filteredProducts.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setSelectedProduct(p);
                  setShowProductModal(false);
                }}
                className={`w-full text-right px-3 py-2.5 rounded-lg hover:bg-muted transition-colors ${
                  selectedProduct?.id === p.id ? "bg-muted" : ""
                }`}
              >
                <div className="font-medium text-sm">{highlightText(p.name, productSearch)}</div>
                {(p.manufacturer || p.manufacturer_name) && (
                  <div className="text-xs text-muted-foreground">
                    {highlightText(p.manufacturer || p.manufacturer_name, productSearch)}
                  </div>
                )}
              </button>
            ))}

            {filteredProducts.length === 0 && (
              <p className="text-center text-muted-foreground py-8 text-sm">
                لا توجد نتائج
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
