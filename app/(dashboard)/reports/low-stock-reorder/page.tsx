"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Loader2, Search, ShoppingCart, Plus, Trash2 } from "lucide-react";
import { multiWordMatch } from "@/lib/utils";
import { useRealtime } from "@/hooks/use-realtime";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchStockSnapshot } from "@/lib/stock-snapshot";
import {
  getTransferNeededProducts,
  type LowStockReorderItem as LowStockItem,
} from "@/lib/low-stock-reorder";

/* ========== Types ========== */
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
  const [retailStock, setRetailStock] = useState<Record<number, number>>({});
  const [wholesaleStock, setWholesaleStock] = useState<Record<number, number>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [resolvingStock, setResolvingStock] = useState(false);
  const [firstResolvedLoadDone, setFirstResolvedLoadDone] = useState(false);
  const [search, setSearch] = useState("");
  const [onlyWithWholesaleStock, setOnlyWithWholesaleStock] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCartModal, setShowCartModal] = useState(false);
  const fetchIdRef = useRef(0);
  const hasCachedDataRef = useRef(false);

  const LOW_STOCK_CACHE_KEY = "low_stock_reorder_cache_v1";

  /* ========== Restore cached results immediately ========== */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOW_STOCK_CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw);
        if (cached.data?.length) {
          setData(cached.data);
          setRetailStock(cached.retailStock || {});
          setWholesaleStock(cached.wholesaleStock || {});
          setLoading(false);
          setFirstResolvedLoadDone(true);
          hasCachedDataRef.current = true;
        }
      }
    } catch {}
  }, []);

  /* ========== Fetch ========== */
  const fetchData = useCallback(async () => {
    const fetchId = fetchIdRef.current + 1;
    fetchIdRef.current = fetchId;

    const hasCachedData = hasCachedDataRef.current;

    try {
      if (!hasCachedData) setLoading(true);
      setResolvingStock(false);
      if (!hasCachedData) setFirstResolvedLoadDone(false);
      const [lowStockRes, retailSnapshot, wholesaleSnapshot] =
        await Promise.all([
          api.get("/reports/low-stock", {
            params: { limit_quantity: 5 },
          }),
          fetchStockSnapshot({
            endpoint: "/products",
            params: {
              branch_id: 1,
              invoice_type: "retail",
              movement_type: "sale",
            },
            cacheKey: "lookup_retail",
          }),
          fetchStockSnapshot({
            endpoint: "/products",
            params: {
              branch_id: 2,
              invoice_type: "wholesale",
              movement_type: "sale",
            },
            cacheKey: "lookup_wholesale",
          }),
        ]);

      const lowItems: LowStockItem[] = Array.isArray(lowStockRes.data)
        ? lowStockRes.data
        : [];

      if (fetchIdRef.current !== fetchId) return;

      setData(lowItems);
      setRetailStock({});
      setWholesaleStock({});

      const relevantProductIds = Array.from(
        new Set(
          lowItems.map((item) => Number(item.product_id)).filter(Boolean),
        ),
      );

      if (fetchIdRef.current !== fetchId) return;

      setLoading(false);

      if (relevantProductIds.length === 0) {
        setFirstResolvedLoadDone(true);
        return;
      }

      setResolvingStock(true);

      if (fetchIdRef.current !== fetchId) return;

      const retailMap = Object.fromEntries(
        relevantProductIds.map((productId) => [
          productId,
          Number(retailSnapshot?.resolvedQtyById?.[productId] || 0),
        ]),
      );
      const wsMap = Object.fromEntries(
        relevantProductIds.map((productId) => [
          productId,
          Number(wholesaleSnapshot?.resolvedQtyById?.[productId] || 0),
        ]),
      );

      setRetailStock(retailMap);
      setWholesaleStock(wsMap);
      setFirstResolvedLoadDone(true);

      try {
        localStorage.setItem(
          LOW_STOCK_CACHE_KEY,
          JSON.stringify({
            data: lowItems,
            retailStock: retailMap,
            wholesaleStock: wsMap,
          }),
        );
      } catch {}
    } catch {
      if (fetchIdRef.current !== fetchId) return;
      if (!hasCachedData) {
        setData([]);
        setRetailStock({});
        setWholesaleStock({});
      }
      setFirstResolvedLoadDone(true);
    } finally {
      if (fetchIdRef.current !== fetchId) return;
      setLoading(false);
      setResolvingStock(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useRealtime(["data:products", "data:stock"], fetchData);

  /* ========== Filter — show only retail warehouse items with stock ≤ 5 ========== */
  const filteredData = useMemo(() => {
    let result = getTransferNeededProducts(data, retailStock, wholesaleStock, {
      onlyWithWholesaleStock,
    });

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
  }, [data, search, retailStock, wholesaleStock, onlyWithWholesaleStock]);

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
      <div className="flex flex-wrap items-center gap-3 mb-4">
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

        <div
          className="flex items-center gap-2 border rounded-md px-3 h-10"
          dir="rtl"
        >
          <span className="text-sm whitespace-nowrap">متاح في الجملة فقط</span>
          <Switch
            checked={onlyWithWholesaleStock}
            onCheckedChange={(checked) =>
              setOnlyWithWholesaleStock(Boolean(checked))
            }
            size="sm"
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
            {firstResolvedLoadDone ? (
              <Badge variant="secondary">
                {filteredData.length} صنف رصيده 5 أو أقل
              </Badge>
            ) : (
              <Badge variant="outline">جاري تجهيز النتائج...</Badge>
            )}
            <div className="flex items-center gap-2">
              {resolvingStock && (
                <Badge variant="outline">جاري تدقيق الأرصدة...</Badge>
              )}
              {cart.length > 0 && <Badge>{cart.length} في العربة</Badge>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== Loading Skeleton ===== */}
      {loading && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">
                    <Skeleton className="h-4 w-24" />
                  </TableHead>
                  <TableHead className="text-center">
                    <Skeleton className="h-4 w-16 mx-auto" />
                  </TableHead>
                  <TableHead className="text-center">
                    <Skeleton className="h-4 w-16 mx-auto" />
                  </TableHead>
                  <TableHead className="text-center">
                    <Skeleton className="h-4 w-20 mx-auto" />
                  </TableHead>
                  <TableHead className="text-center w-20">
                    <Skeleton className="h-4 w-12 mx-auto" />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(8)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-40" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Skeleton className="h-4 w-20 mx-auto" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Skeleton className="h-6 w-12 mx-auto rounded-full" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Skeleton className="h-6 w-12 mx-auto rounded-full" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Skeleton className="h-8 w-8 mx-auto rounded" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* ===== Table - Desktop ===== */}
      {!loading && firstResolvedLoadDone && filteredData.length > 0 && (
        <Card className="hidden md:block">
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

      {/* ===== Mobile Cards ===== */}
      {!loading && firstResolvedLoadDone && filteredData.length > 0 && (
        <div className="md:hidden space-y-2">
          {filteredData.map((item) => {
            const wsQty = wholesaleStock[item.product_id] ?? 0;
            const inCart = isInCart(item.product_id);
            return (
              <Card
                key={`m-${item.product_id}-${item.variant_id || 0}`}
                className="p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-medium">{item.product_name}</p>
                    {item.manufacturer_name && (
                      <p className="text-xs text-muted-foreground">
                        {item.manufacturer_name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        item.current_stock === 0 ? "destructive" : "secondary"
                      }
                    >
                      {item.current_stock}
                    </Badge>
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
                  </div>
                </div>
                <div className="flex justify-between mt-2 pt-2 border-t text-xs text-muted-foreground">
                  <span>رصيد الجملة: {wsQty > 0 ? wsQty : "0"}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ===== Empty ===== */}
      {!loading && !firstResolvedLoadDone && (
        <Card>
          <CardContent className="py-16 flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            جاري تجهيز الأصناف...
          </CardContent>
        </Card>
      )}

      {!loading && firstResolvedLoadDone && filteredData.length === 0 && (
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
