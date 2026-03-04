"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import api from "@/services/api";
import { useAuth } from "@/app/context/auth-context";
import { useRouter } from "next/navigation";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Loader2, Search, ShoppingCart, Plus, Trash2 } from "lucide-react";
import { multiWordMatch } from "@/lib/utils";
import { useRealtime } from "@/hooks/use-realtime";
import { toast } from "sonner";

/* ========== Types ========== */
type LowStockItem = {
  product_id: number;
  product_name: string;
  manufacturer_name?: string | null;
  warehouse_name: string;
  current_stock: number;
  wholesale_package?: string | null;
  retail_package?: string | null;
  variant_id?: number;
};

type WholesaleStockItem = {
  product_id: number;
  quantity: number;
};

type CartItem = {
  product_id: number;
  product_name: string;
  manufacturer_name?: string | null;
  current_stock: number;
};

/* ========== Component ========== */
export default function LowStockReorderPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [data, setData] = useState<LowStockItem[]>([]);
  const [wholesaleStock, setWholesaleStock] = useState<Record<number, number>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCartModal, setShowCartModal] = useState(false);

  /* ========== Fetch ========== */
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [lowStockRes, wholesaleRes] = await Promise.all([
        api.get("/reports/low-stock", {
          params: { limit_quantity: 5 },
        }),
        api.get("/reports/low-stock", {
          params: { limit_quantity: 999999, warehouse_id: 1 },
        }),
      ]);

      const lowItems: LowStockItem[] = Array.isArray(lowStockRes.data)
        ? lowStockRes.data
        : [];
      setData(lowItems);

      // Build wholesale stock map
      const wsItems: LowStockItem[] = Array.isArray(wholesaleRes.data)
        ? wholesaleRes.data
        : [];
      const wsMap: Record<number, number> = {};
      for (const item of wsItems) {
        if (item.warehouse_name === "المخزن الرئيسي") {
          wsMap[item.product_id] = Math.max(
            wsMap[item.product_id] || 0,
            item.current_stock,
          );
        }
      }
      setWholesaleStock(wsMap);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useRealtime(["data:products", "data:stock"], fetchData);

  /* ========== Filter — show only retail warehouse items with stock ≤ 5 ========== */
  const filteredData = useMemo(() => {
    let result = data.filter(
      (i) =>
        i.warehouse_name === "مخزن المعرض" &&
        i.current_stock <= 5 &&
        i.current_stock >= 0 &&
        !!i.wholesale_package,
    );

    if (search.trim()) {
      result = result.filter((item) =>
        multiWordMatch(
          search,
          item.product_name,
          item.manufacturer_name,
          String(item.product_id),
        ),
      );
    }

    return result.sort((a, b) => a.current_stock - b.current_stock);
  }, [data, search]);

  /* ========== Cart actions ========== */
  const addToCart = (item: LowStockItem) => {
    if (cart.find((c) => c.product_id === item.product_id)) {
      toast.warning("الصنف مضاف بالفعل");
      return;
    }
    setCart((prev) => [
      ...prev,
      {
        product_id: item.product_id,
        product_name: item.product_name,
        manufacturer_name: item.manufacturer_name,
        current_stock: item.current_stock,
      },
    ]);
    toast.success("تم إضافة الصنف للعربة");
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((c) => c.product_id !== productId));
  };

  const isInCart = (productId: number) =>
    cart.some((c) => c.product_id === productId);

  /* ========== Go to transfer ========== */
  const goToTransfer = () => {
    if (cart.length === 0) return;

    // Store selected product IDs in sessionStorage for the transfer page to pick up
    sessionStorage.setItem(
      "reorder_product_ids",
      JSON.stringify(cart.map((c) => c.product_id)),
    );
    setShowCartModal(false);
    router.push("/stock-transfer");
  };

  /* ========== Render ========== */
  return (
    <PageContainer>
      <h1 className="text-2xl font-bold text-center mb-6" dir="rtl">
        أصناف تحتاج تحويل
      </h1>
      {/* ===== Search + Cart Icon ===== */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            dir="rtl"
            placeholder="بحث عن صنف..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          className="relative"
          onClick={() => setShowCartModal(true)}
        >
          <ShoppingCart className="h-5 w-5" />
          {cart.length > 0 && (
            <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-[10px]">
              {cart.length}
            </Badge>
          )}
        </Button>
      </div>

      {/* ===== Summary ===== */}
      {!loading && (
        <Card className="mb-4">
          <CardContent className="p-3 flex items-center justify-between">
            <Badge variant="secondary">
              {filteredData.length} صنف رصيده 5 أو أقل
            </Badge>
            {cart.length > 0 && <Badge>{cart.length} في العربة</Badge>}
          </CardContent>
        </Card>
      )}

      {/* ===== Loading ===== */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* ===== Table ===== */}
      {!loading && filteredData.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">اسم الصنف</TableHead>
                    <TableHead className="text-center">المصنع</TableHead>
                    <TableHead className="text-center">الرصيد</TableHead>
                    <TableHead className="text-center">رصيد الجملة</TableHead>
                    <TableHead className="text-center w-20">إضافة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.map((item) => {
                    const wsQty = wholesaleStock[item.product_id] ?? 0;
                    const inCart = isInCart(item.product_id);
                    return (
                      <TableRow
                        key={`${item.product_id}-${item.variant_id || 0}`}
                      >
                        <TableCell className="text-right font-medium">
                          {item.product_name}
                        </TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">
                          {item.manufacturer_name || "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge
                            variant={
                              item.current_stock === 0
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {item.current_stock}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {wsQty > 0 ? (
                            <Badge variant="outline">{wsQty}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              0
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {wsQty > 0 && !inCart && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-green-600 hover:text-green-700"
                              onClick={() => addToCart(item)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          )}
                          {inCart && (
                            <Badge variant="secondary" className="text-xs">
                              ✓
                            </Badge>
                          )}
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

      {/* ===== Empty ===== */}
      {!loading && filteredData.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          لا توجد أصناف منخفضة حالياً
        </div>
      )}

      {/* ===== Cart Modal ===== */}
      <Dialog open={showCartModal} onOpenChange={setShowCartModal}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              عربة التحويل ({cart.length} صنف)
            </DialogTitle>
          </DialogHeader>

          {cart.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              العربة فارغة — أضف أصناف من القائمة
            </p>
          ) : (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {cart.map((item) => (
                <div
                  key={item.product_id}
                  className="flex items-center justify-between border rounded-lg p-3"
                >
                  <div>
                    <p className="font-medium text-sm">{item.product_name}</p>
                    {item.manufacturer_name && (
                      <p className="text-xs text-muted-foreground">
                        {item.manufacturer_name}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-500 hover:text-red-600"
                    onClick={() => removeFromCart(item.product_id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {cart.length > 0 && (
            <Button className="w-full mt-2" onClick={goToTransfer}>
              فتح فاتورة تحويل
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
