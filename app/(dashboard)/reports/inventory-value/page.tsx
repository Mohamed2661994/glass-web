"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/services/api";
import { useAuth } from "@/app/context/auth-context";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useRealtime } from "@/hooks/use-realtime";

/* ========== Types ========== */
type InventoryItem = {
  product_id: number;
  product_name: string;
  manufacturer: string;
  quantity: number;
  purchase_price: number;
  total_value: number;
  warehouse_id: number;
  warehouse_name: string;
  packages?: string | null;
  package_name?: string | null;
};

type Product = {
  id: number;
  name: string;
  wholesale_package?: string;
  retail_package?: string;
};

/* ========== Component ========== */
export default function InventoryValuePage() {
  const { user } = useAuth();
  const isShowroomUser = user?.branch_id === 1;
  const isWarehouseUser = user?.branch_id === 2;

  const [data, setData] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [manufacturers, setManufacturers] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [warehouseFilter, setWarehouseFilter] = useState<string | null>(null);
  const [manufacturerFilter, setManufacturerFilter] = useState<string | null>(
    null,
  );

  /* ========== Set default warehouse ========== */
  useEffect(() => {
    if (!user) return;
    if (user.branch_id === 1)
      setWarehouseFilter("1"); // مخزن المعرض
    else if (user.branch_id === 2)
      setWarehouseFilter("2"); // المخزن الرئيسي
    else setWarehouseFilter(null);
  }, [user]);

  /* ========== Fetch Manufacturers ========== */
  const fetchManufacturers = useCallback(async () => {
    try {
      const res = await api.get("/reports/manufacturers");
      const names = (res.data || []).map((item: any) => item.manufacturer);
      const unique = [
        ...new Set(names.filter((n: any) => n && n.trim() !== "")),
      ] as string[];
      setManufacturers(unique);
    } catch {
      /* ignore */
    }
  }, []);

  /* ========== Fetch Products (for package info) ========== */
  const fetchProducts = useCallback(async () => {
    try {
      const res = await api.get("/admin/products");
      setProducts(Array.isArray(res.data) ? res.data : []);
    } catch {
      /* ignore */
    }
  }, []);

  /* ========== Fetch Report ========== */
  const fetchReport = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/reports/inventory-details", {
        params: {
          warehouse_id: warehouseFilter ?? undefined,
          manufacturer: manufacturerFilter ?? undefined,
        },
      });
      setData(Array.isArray(res.data) ? res.data : []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [warehouseFilter, manufacturerFilter]);

  useEffect(() => {
    fetchManufacturers();
    fetchProducts();
  }, [fetchManufacturers, fetchProducts]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  useRealtime(["data:products", "data:stock"], fetchReport);

  /* ========== Product package map ========== */
  const packageMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const p of products) {
      const pkg = isShowroomUser ? p.retail_package : p.wholesale_package;
      if (pkg) map.set(p.id, pkg);
    }
    return map;
  }, [products, isShowroomUser]);

  /* ========== Total ========== */
  const totalValue = useMemo(
    () => data.reduce((sum, item) => sum + Number(item.total_value), 0),
    [data],
  );

  const hasFilters = warehouseFilter !== null || manufacturerFilter !== null;

  /* ========== Warehouse buttons (only if not locked) ========== */
  const warehouseOptions =
    !isShowroomUser && !isWarehouseUser
      ? [
          { label: "الكل", value: null },
          { label: "المخزن الرئيسي", value: "1" },
          { label: "مخزن المعرض", value: "2" },
        ]
      : [];

  return (
    <PageContainer size="xl">
      <div dir="rtl" className="space-y-4 py-6">
        <h1 className="text-2xl font-bold text-center">تقرير قيمة المخزون</h1>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-3 justify-center items-end">
              {/* Warehouse filter */}
              {warehouseOptions.length > 0 && (
                <div className="flex gap-2">
                  {warehouseOptions.map((w) => (
                    <Button
                      key={w.label}
                      variant={
                        warehouseFilter === w.value ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => setWarehouseFilter(w.value)}
                    >
                      {w.label}
                    </Button>
                  ))}
                </div>
              )}

              {/* Manufacturer filter */}
              {manufacturers.length > 0 && (
                <Select
                  value={manufacturerFilter ?? "all"}
                  onValueChange={(v) =>
                    setManufacturerFilter(v === "all" ? null : v)
                  }
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="اختر المصنع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل المصانع</SelectItem>
                    {manufacturers.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {hasFilters && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    if (!isShowroomUser && !isWarehouseUser)
                      setWarehouseFilter(null);
                    setManufacturerFilter(null);
                  }}
                >
                  مسح الفلاتر
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Table */}
        {!loading && data.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">الصنف</TableHead>
                      <TableHead className="text-center">العبوات</TableHead>
                      <TableHead className="text-center">الكمية</TableHead>
                      <TableHead className="text-center">سعر الشراء</TableHead>
                      <TableHead className="text-center">الإجمالي</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-right">
                          <span className="font-medium">
                            {item.product_name}
                          </span>
                          {item.manufacturer && (
                            <span className="text-xs text-muted-foreground mr-2">
                              - {item.manufacturer}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-xs">
                          {item.package_name || item.packages || "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-center">
                          {Number(item.purchase_price).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center font-bold text-primary">
                          {Number(item.total_value).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty */}
        {!loading && data.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            لا توجد بيانات
          </div>
        )}

        {/* Summary */}
        {!loading && data.length > 0 && (
          <div className="flex justify-center gap-4">
            <Badge variant="secondary">{data.length} صنف</Badge>
            <Badge className="bg-primary">
              إجمالي قيمة المخزون: {Math.round(totalValue).toLocaleString()}{" "}
              جنيه
            </Badge>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
