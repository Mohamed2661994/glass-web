"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import api from "@/services/api";
import { useUserPreferences } from "@/hooks/use-user-preferences";
import { multiWordMatch, multiWordScore } from "@/lib/utils";
import { ProductCard } from "@/components/product-card";
import { ProductCompactCard } from "@/components/product-compact-card";
import { ProductTableRow } from "@/components/product-table-row";
import { ProductCardSkeleton } from "@/components/product-card-skeleton";
import { ProductFormDialog } from "@/components/product-form-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  Trash2,
  Loader2,
  LayoutGrid,
  Table2,
  Grid3X3,
  Columns2,
  GalleryHorizontalEnd,
  ChevronLeft,
  ChevronRight,
  Kanban,
  X,
  Copy,
  Pencil,
  Printer,
  Check,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useRealtime } from "@/hooks/use-realtime";
import { highlightText } from "@/lib/highlight-text";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  description?: string;
}

export default function ProductsPage() {
  const router = useRouter();
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "true" | "false">("true");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedManufacturer, setSelectedManufacturer] =
    useState<string>("الكل");
  const {
    prefs,
    loaded: prefsLoaded,
    setProductsView: saveProductsView,
  } = useUserPreferences();
  const [viewMode, setViewMode] = useState<
    "cards" | "compact" | "table" | "split" | "swipe" | "kanban"
  >("cards");

  // Swipe view
  const swipeRef = useRef<HTMLDivElement>(null);
  const [swipeIndex, setSwipeIndex] = useState(0);

  // Kanban view
  const [kanbanGroupBy, setKanbanGroupBy] = useState<"manufacturer" | "status">(
    "manufacturer",
  );

  // Sync from prefs when loaded
  useEffect(() => {
    if (prefsLoaded && prefs.products_view) {
      setViewMode(prefs.products_view);
    }
  }, [prefsLoaded, prefs.products_view]);
  const [userId, setUserId] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Read user id from localStorage
  useEffect(() => {
    try {
      const user = localStorage.getItem("user");
      if (user) {
        const parsed = JSON.parse(user);
        setUserId(parsed.id);
        setIsAdmin(
          parsed.role === "admin" || parsed.id === 7 || parsed.id === 5,
        );
      }
    } catch {}
  }, []);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Split view selection
  const [splitSelectedId, setSplitSelectedId] = useState<number | null>(null);

  // Barcode print modal
  const [barcodePrintProduct, setBarcodePrintProduct] =
    useState<Product | null>(null);
  const [barcodePrintCount, setBarcodePrintCount] = useState("1");
  const [showBarcodePrintModal, setShowBarcodePrintModal] = useState(false);

  // Variants
  const [variantsMap, setVariantsMap] = useState<Record<number, any[]>>({});

  // Delete all
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);

  // Delete single product
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deletingSingle, setDeletingSingle] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const limit = 30;

  const fetchProducts = async (opts?: {
    searchQuery?: string;
    activeFilter?: string;
  }) => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      const sq = opts?.searchQuery ?? "";
      const af = opts?.activeFilter ?? activeFilter;
      if (sq) params.search = sq;
      params.active = sq ? "all" : af; // search always searches all
      const res = await api.get("/admin/products", { params });
      const prods = res.data;
      setAllProducts(prods);

      // جلب كل الأكواد الفرعية
      if (prods.length > 0) {
        try {
          const ids = prods.map((p: any) => p.id).join(",");
          const vRes = await api.get("/products/variants", {
            params: { product_ids: ids },
          });
          const map: Record<number, any[]> = {};
          for (const v of vRes.data || []) {
            if (!map[v.product_id]) map[v.product_id] = [];
            map[v.product_id].push(v);
          }
          setVariantsMap(map);
        } catch {
          /* silent */
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts({ activeFilter });
  }, [activeFilter]);

  useRealtime(["data:products", "data:invoices", "data:stock"], () =>
    fetchProducts(),
  );

  // استخراج المصانع
  const manufacturers = [
    "الكل",
    ...Array.from(
      new Set(allProducts.map((p) => p.manufacturer).filter(Boolean)),
    ),
  ];

  // فلترة
  const filteredProducts = allProducts
    .filter((product) => {
      const matchesSearch = multiWordMatch(
        search,
        product.name,
        product.barcode,
        product.description,
        product.manufacturer,
      );
      const matchesManufacturer =
        selectedManufacturer === "الكل" ||
        product.manufacturer === selectedManufacturer;
      return matchesSearch && matchesManufacturer;
    })
    .sort((a, b) => {
      // Relevance sort when searching
      if (search.trim()) {
        const scoreA = multiWordScore(
          search,
          a.name,
          a.barcode,
          a.description,
          a.manufacturer,
        );
        const scoreB = multiWordScore(
          search,
          b.name,
          b.barcode,
          b.description,
          b.manufacturer,
        );
        if (scoreA !== scoreB) return scoreB - scoreA;
      }
      // الأصناف الغير مفعلة في الآخر
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
      return 0;
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

  // Delete All Products
  const handleDeleteAll = async () => {
    try {
      setDeletingAll(true);
      await api.delete("/admin/products/all?force=true");
      setAllProducts([]);
      setVariantsMap({});
      setPage(1);
      toast.success("تم مسح جميع الأصناف بنجاح");
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "فشل مسح الأصناف";
      toast.error(msg);
      console.error("Delete all products error:", err?.response?.data || err);
    } finally {
      setDeletingAll(false);
      setShowDeleteAllConfirm(false);
    }
  };

  // Delete Single Product
  const handleDeleteSingle = async () => {
    if (!deleteTarget) return;
    try {
      setDeletingSingle(true);
      await api.delete(`/admin/products/${deleteTarget.id}?force=true`);
      setAllProducts((prev) => prev.filter((p) => p.id !== deleteTarget!.id));
      setVariantsMap((prev) => {
        const copy = { ...prev };
        delete copy[deleteTarget!.id];
        return copy;
      });
      toast.success(`تم حذف الصنف: ${deleteTarget.name}`);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "فشل حذف الصنف";
      toast.error(msg);
      console.error("Delete product error:", err?.response?.data || err);
    } finally {
      setDeletingSingle(false);
      setDeleteTarget(null);
    }
  };

  // أزرار أرقام الصفحات (محدودة)
  const renderPaginationNumbers = () => {
    const pages: React.ReactNode[] = [];
    const maxVisible = 5; // عدد الأزرار المرئية
    let start = Math.max(1, page - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);

    // لو قربنا من الآخر، نرجع البداية
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }

    if (start > 1) {
      pages.push(
        <Button key={1} variant="outline" size="sm" onClick={() => setPage(1)}>
          1
        </Button>,
      );
      if (start > 2) {
        pages.push(
          <span key="dots-start" className="text-muted-foreground px-1">
            ...
          </span>,
        );
      }
    }

    for (let i = start; i <= end; i++) {
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

    if (end < totalPages) {
      if (end < totalPages - 1) {
        pages.push(
          <span key="dots-end" className="text-muted-foreground px-1">
            ...
          </span>,
        );
      }
      pages.push(
        <Button
          key={totalPages}
          variant="outline"
          size="sm"
          onClick={() => setPage(totalPages)}
        >
          {totalPages}
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

        <div className="flex items-center gap-2">
          {userId === 7 && (
            <>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteAllConfirm(true)}
                disabled={allProducts.length === 0}
              >
                <Trash2 className="h-4 w-4 ml-1" />
                مسح الكل
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push("/products/import")}
              >
                <FileSpreadsheet className="h-4 w-4 ml-1" />
                استيراد Excel
              </Button>
            </>
          )}
          <Button
            onClick={() => {
              setSelectedProduct(null);
              setDialogOpen(true);
            }}
          >
            إضافة منتج
          </Button>
        </div>
      </div>

      {/* Search + Manufacturer Filter + View Toggle */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              placeholder="ابحث باسم المنتج أو الباركود..."
              value={search}
              onChange={(e) => {
                const val = e.target.value;
                setSearch(val);
                setPage(1);
                // Debounced server search
                if (searchTimerRef.current)
                  clearTimeout(searchTimerRef.current);
                if (val.trim().length >= 2) {
                  searchTimerRef.current = setTimeout(() => {
                    fetchProducts({ searchQuery: val.trim() });
                  }, 400);
                } else if (val.trim().length === 0) {
                  fetchProducts({
                    activeFilter,
                  });
                }
              }}
            />
            {manufacturers.length > 2 && (
              <Select
                value={selectedManufacturer}
                onValueChange={(val) => {
                  setSelectedManufacturer(val);
                  setPage(1);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="المصنع" />
                </SelectTrigger>
                <SelectContent>
                  {manufacturers.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {filteredProducts.length} صنف
              </span>
              <Select
                value={activeFilter}
                onValueChange={(val: "all" | "true" | "false") => {
                  setActiveFilter(val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-auto min-w-[140px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">الأصناف المفعلة</SelectItem>
                  <SelectItem value="false">الأصناف الغير مفعلة</SelectItem>
                  <SelectItem value="all">جميع الأصناف</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              <button
                onClick={() => {
                  setViewMode("cards");
                  saveProductsView("cards");
                }}
                className={`p-1.5 rounded-md transition-all ${
                  viewMode === "cards"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="كروت"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setViewMode("compact");
                  saveProductsView("compact");
                }}
                className={`p-1.5 rounded-md transition-all ${
                  viewMode === "compact"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="كروت مصغرة"
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setViewMode("table");
                  saveProductsView("table");
                }}
                className={`p-1.5 rounded-md transition-all ${
                  viewMode === "table"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="جدول"
              >
                <Table2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setViewMode("split");
                  saveProductsView("split");
                }}
                className={`p-1.5 rounded-md transition-all ${
                  viewMode === "split"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="عرض مقسم"
              >
                <Columns2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setViewMode("swipe");
                  saveProductsView("swipe");
                  setSwipeIndex(0);
                }}
                className={`p-1.5 rounded-md transition-all ${
                  viewMode === "swipe"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="عرض أفقي بالسحب"
              >
                <GalleryHorizontalEnd className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setViewMode("kanban");
                  saveProductsView("kanban");
                }}
                className={`p-1.5 rounded-md transition-all ${
                  viewMode === "kanban"
                    ? "bg-background shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title="أعمدة (كانبان)"
              >
                <Kanban className="h-4 w-4" />
              </button>
            </div>
          </div>
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
          {/* === Cards View === */}
          {viewMode === "cards" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 max-w-6xl mx-auto">
              {currentProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  variants={variantsMap[product.id] || []}
                  searchQuery={search}
                  onToggle={(value) => handleToggle(product.id, value)}
                  onEdit={() => {
                    setSelectedProduct(product);
                    setDialogOpen(true);
                  }}
                  onDelete={
                    isAdmin ? () => setDeleteTarget(product) : undefined
                  }
                  onPrintBarcode={(p) => {
                    setBarcodePrintProduct(p);
                    setBarcodePrintCount("1");
                    setShowBarcodePrintModal(true);
                  }}
                />
              ))}
            </div>
          )}

          {/* === Compact Cards View === */}
          {viewMode === "compact" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-w-7xl mx-auto">
              {currentProducts.map((product) => (
                <ProductCompactCard
                  key={product.id}
                  product={product}
                  variants={variantsMap[product.id] || []}
                  searchQuery={search}
                  onToggle={(value) => handleToggle(product.id, value)}
                  onEdit={() => {
                    setSelectedProduct(product);
                    setDialogOpen(true);
                  }}
                  onDelete={
                    isAdmin ? () => setDeleteTarget(product) : undefined
                  }
                  onPrintBarcode={(p) => {
                    setBarcodePrintProduct(p);
                    setBarcodePrintCount("1");
                    setShowBarcodePrintModal(true);
                  }}
                />
              ))}
            </div>
          )}

          {/* === Table View === */}
          {viewMode === "table" && (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 text-right font-semibold">الاسم</th>
                      <th className="p-3 text-right font-semibold">الباركود</th>
                      <th className="p-3 text-center font-semibold">
                        <span className="text-sky-600 dark:text-sky-400">
                          عبوة جملة
                        </span>
                      </th>
                      <th className="p-3 text-center font-semibold">
                        <span className="text-sky-600 dark:text-sky-400">
                          شراء جملة
                        </span>
                      </th>
                      <th className="p-3 text-center font-semibold">
                        <span className="text-sky-600 dark:text-sky-400">
                          بيع جملة
                        </span>
                      </th>
                      <th className="p-3 text-center font-semibold">
                        <span className="text-amber-600 dark:text-amber-400">
                          عبوة قطاعي
                        </span>
                      </th>
                      <th className="p-3 text-center font-semibold">
                        <span className="text-amber-600 dark:text-amber-400">
                          شراء قطاعي
                        </span>
                      </th>
                      <th className="p-3 text-center font-semibold">
                        <span className="text-amber-600 dark:text-amber-400">
                          بيع قطاعي
                        </span>
                      </th>
                      <th className="p-3 text-center font-semibold">خصم</th>
                      <th className="p-3 text-center font-semibold">حالة</th>
                      <th className="p-3 text-center font-semibold">إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentProducts.map((product) => (
                      <ProductTableRow
                        key={product.id}
                        product={product}
                        variants={variantsMap[product.id] || []}
                        searchQuery={search}
                        onToggle={(value) => handleToggle(product.id, value)}
                        onEdit={() => {
                          setSelectedProduct(product);
                          setDialogOpen(true);
                        }}
                        onDelete={
                          isAdmin ? () => setDeleteTarget(product) : undefined
                        }
                        onPrintBarcode={(p) => {
                          setBarcodePrintProduct(p);
                          setBarcodePrintCount("1");
                          setShowBarcodePrintModal(true);
                        }}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* === Split View === */}
          {viewMode === "split" && (
            <div
              className="flex gap-4 max-w-7xl mx-auto"
              style={{ height: "calc(100vh - 280px)" }}
            >
              {/* Product List (Right side in RTL) */}
              <Card className="w-80 shrink-0 flex flex-col overflow-hidden">
                <ScrollArea className="flex-1">
                  <div className="divide-y">
                    {currentProducts.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => setSplitSelectedId(product.id)}
                        className={`w-full text-right p-3 transition-colors hover:bg-muted/50 ${
                          splitSelectedId === product.id
                            ? "bg-primary/10 border-r-2 border-primary"
                            : ""
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p
                              className={`text-sm font-medium truncate ${!product.is_active ? "text-muted-foreground line-through" : ""}`}
                            >
                              {highlightText(product.name, search)}
                            </p>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {product.manufacturer || "—"} ·{" "}
                              {product.barcode || "بدون باركود"}
                            </p>
                          </div>
                          {!product.is_active && (
                            <Badge
                              variant="secondary"
                              className="text-[10px] shrink-0"
                            >
                              معطل
                            </Badge>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </Card>

              {/* Product Detail (Left side in RTL) */}
              <Card className="flex-1 overflow-hidden">
                {(() => {
                  const splitProduct = allProducts.find(
                    (p) => p.id === splitSelectedId,
                  );
                  if (!splitProduct) {
                    return (
                      <div className="h-full flex items-center justify-center text-muted-foreground">
                        <div className="text-center space-y-2">
                          <Columns2 className="h-12 w-12 mx-auto opacity-20" />
                          <p>اختر صنف من القائمة لعرض التفاصيل</p>
                        </div>
                      </div>
                    );
                  }

                  const variants = variantsMap[splitProduct.id] || [];
                  const packages = [
                    {
                      label: "أساسي",
                      wholesale_package: splitProduct.wholesale_package,
                      retail_package: splitProduct.retail_package,
                      purchase_price: splitProduct.purchase_price,
                      retail_purchase_price: splitProduct.retail_purchase_price,
                      wholesale_price: splitProduct.wholesale_price,
                      retail_price: splitProduct.retail_price,
                      barcode: splitProduct.barcode,
                      discount_amount: splitProduct.discount_amount || 0,
                    },
                    ...variants.map((v: any) => ({
                      label: v.label || "فرعي",
                      wholesale_package: v.wholesale_package,
                      retail_package: v.retail_package,
                      purchase_price: v.purchase_price,
                      retail_purchase_price: v.retail_purchase_price,
                      wholesale_price: v.wholesale_price,
                      retail_price: v.retail_price,
                      barcode: v.barcode,
                      discount_amount: v.discount_amount || 0,
                    })),
                  ];
                  const fmt = (v: number) =>
                    Number(v || 0).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    });

                  return (
                    <ScrollArea className="h-full">
                      <div className="p-6 space-y-6">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-xl font-bold">
                              {highlightText(splitProduct.name, search)}
                            </h3>
                            {splitProduct.manufacturer && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {highlightText(
                                  splitProduct.manufacturer,
                                  search,
                                )}
                              </p>
                            )}
                            {splitProduct.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {splitProduct.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedProduct(splitProduct);
                                setDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5 ml-1" />
                              تعديل
                            </Button>
                            {isAdmin && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => setDeleteTarget(splitProduct)}
                              >
                                <Trash2 className="h-3.5 w-3.5 ml-1" />
                                حذف
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Status + Barcode */}
                        <div className="flex items-center gap-4 flex-wrap">
                          <Badge
                            variant={
                              splitProduct.is_active ? "default" : "secondary"
                            }
                          >
                            {splitProduct.is_active ? "مفعل" : "معطل"}
                          </Badge>
                          {splitProduct.barcode && (
                            <div className="flex items-center gap-1.5 text-sm font-mono text-muted-foreground">
                              <span>{splitProduct.barcode}</span>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(
                                    splitProduct.barcode,
                                  );
                                  toast.success("تم نسخ الباركود");
                                }}
                                className="p-0.5 rounded hover:bg-muted"
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setBarcodePrintProduct(splitProduct);
                                  setBarcodePrintCount("1");
                                  setShowBarcodePrintModal(true);
                                }}
                                className="p-0.5 rounded hover:bg-muted"
                              >
                                <Printer className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Pricing Table */}
                        {packages.map((pkg, idx) => (
                          <div key={idx} className="space-y-2">
                            {packages.length > 1 && (
                              <h4 className="text-sm font-semibold text-muted-foreground">
                                {pkg.label}{" "}
                                {pkg.barcode &&
                                pkg.barcode !== splitProduct.barcode
                                  ? `(${pkg.barcode})`
                                  : ""}
                              </h4>
                            )}
                            <div className="grid grid-cols-2 gap-3">
                              {/* Wholesale Column */}
                              <div className="border rounded-lg p-3 bg-sky-500/5">
                                <p className="text-xs font-semibold text-sky-600 dark:text-sky-400 mb-2">
                                  جملة
                                </p>
                                <div className="space-y-1.5 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                      العبوة
                                    </span>
                                    <span className="font-medium">
                                      {pkg.wholesale_package || "—"}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                      شراء
                                    </span>
                                    <span className="font-medium">
                                      {fmt(pkg.purchase_price)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                      بيع
                                    </span>
                                    <span className="font-bold text-sky-600 dark:text-sky-400">
                                      {fmt(pkg.wholesale_price)}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Retail Column */}
                              <div className="border rounded-lg p-3 bg-amber-500/5">
                                <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-2">
                                  قطاعي
                                </p>
                                <div className="space-y-1.5 text-sm">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                      العبوة
                                    </span>
                                    <span className="font-medium">
                                      {pkg.retail_package || "—"}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                      شراء
                                    </span>
                                    <span className="font-medium">
                                      {fmt(pkg.retail_purchase_price)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                      بيع
                                    </span>
                                    <span className="font-bold text-amber-600 dark:text-amber-400">
                                      {fmt(pkg.retail_price)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {pkg.discount_amount > 0 && (
                              <div className="text-sm text-center text-green-600 dark:text-green-400 font-medium">
                                خصم: {fmt(pkg.discount_amount)}
                              </div>
                            )}
                          </div>
                        ))}

                        {/* Toggle Active */}
                        <div className="flex items-center justify-between border rounded-lg p-3">
                          <span className="text-sm font-medium">
                            حالة الصنف
                          </span>
                          <button
                            onClick={() =>
                              handleToggle(
                                splitProduct.id,
                                !splitProduct.is_active,
                              )
                            }
                            className={`relative h-6 w-12 rounded-full transition-all duration-300 ${
                              splitProduct.is_active
                                ? "bg-green-500"
                                : "bg-gray-300 dark:bg-gray-600"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all duration-300 ${
                                splitProduct.is_active
                                  ? "right-0.5"
                                  : "left-0.5"
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </ScrollArea>
                  );
                })()}
              </Card>
            </div>
          )}

          {/* === Swipe Horizontal View === */}
          {viewMode === "swipe" && (
            <div className="space-y-4">
              {/* Navigation header */}
              <div className="flex items-center justify-between px-1">
                <span className="text-sm text-muted-foreground font-medium">
                  {Math.min(swipeIndex + 1, currentProducts.length)} /{" "}
                  {currentProducts.length}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={swipeIndex <= 0}
                    onClick={() => {
                      const next = Math.max(0, swipeIndex - 1);
                      setSwipeIndex(next);
                      swipeRef.current?.children[next]?.scrollIntoView({
                        behavior: "smooth",
                        block: "nearest",
                        inline: "center",
                      });
                    }}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={swipeIndex >= currentProducts.length - 1}
                    onClick={() => {
                      const next = Math.min(
                        currentProducts.length - 1,
                        swipeIndex + 1,
                      );
                      setSwipeIndex(next);
                      swipeRef.current?.children[next]?.scrollIntoView({
                        behavior: "smooth",
                        block: "nearest",
                        inline: "center",
                      });
                    }}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Swipeable cards container */}
              <div
                ref={swipeRef}
                className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-4 px-1 scrollbar-hide"
                style={{ WebkitOverflowScrolling: "touch" }}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  const cardWidth = el.children[0]?.clientWidth || 300;
                  const gap = 16;
                  const scrollPos = Math.abs(el.scrollLeft);
                  const idx = Math.round(scrollPos / (cardWidth + gap));
                  if (idx !== swipeIndex) setSwipeIndex(idx);
                }}
              >
                {currentProducts.map((product, idx) => {
                  const variants = variantsMap[product.id] || [];
                  const packages = [
                    {
                      label: "أساسي",
                      wholesale_package: product.wholesale_package,
                      retail_package: product.retail_package,
                      purchase_price: product.purchase_price,
                      retail_purchase_price: product.retail_purchase_price,
                      wholesale_price: product.wholesale_price,
                      retail_price: product.retail_price,
                      barcode: product.barcode,
                      discount_amount: product.discount_amount || 0,
                    },
                    ...variants.map((v: any) => ({
                      label: v.label || "فرعي",
                      wholesale_package: v.wholesale_package,
                      retail_package: v.retail_package,
                      purchase_price: v.purchase_price,
                      retail_purchase_price: v.retail_purchase_price,
                      wholesale_price: v.wholesale_price,
                      retail_price: v.retail_price,
                      barcode: v.barcode,
                      discount_amount: v.discount_amount || 0,
                    })),
                  ];
                  const fmt = (v: number) =>
                    Number(v || 0).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    });

                  return (
                    <Card
                      key={product.id}
                      className={`snap-center shrink-0 w-[85vw] sm:w-[400px] overflow-hidden transition-all ${
                        !product.is_active ? "opacity-60 grayscale" : ""
                      }`}
                    >
                      <CardContent className="p-5 space-y-4">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-lg font-bold truncate">
                              {highlightText(product.name, search)}
                            </h3>
                            {product.manufacturer && (
                              <p className="text-sm text-muted-foreground">
                                {highlightText(product.manufacturer, search)}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => {
                                setSelectedProduct(product);
                                setDialogOpen(true);
                              }}
                              className="p-1.5 rounded-md hover:bg-muted transition-colors"
                              title="تعديل"
                            >
                              <Pencil className="h-4 w-4 text-muted-foreground" />
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => setDeleteTarget(product)}
                                className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors"
                                title="حذف"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Barcode + Status */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                            {product.barcode ? (
                              <>
                                <span>{product.barcode}</span>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(
                                      product.barcode,
                                    );
                                    toast.success("تم نسخ الباركود");
                                  }}
                                  className="p-0.5 rounded hover:bg-muted"
                                >
                                  <Copy className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => {
                                    setBarcodePrintProduct(product);
                                    setBarcodePrintCount("1");
                                    setShowBarcodePrintModal(true);
                                  }}
                                  className="p-0.5 rounded hover:bg-muted"
                                >
                                  <Printer className="h-3 w-3" />
                                </button>
                              </>
                            ) : (
                              <span>بدون باركود</span>
                            )}
                          </div>
                          <button
                            onClick={() =>
                              handleToggle(product.id, !product.is_active)
                            }
                            className={`relative h-5 w-10 rounded-full transition-all duration-300 shrink-0 ${
                              product.is_active
                                ? "bg-green-500"
                                : "bg-gray-300 dark:bg-gray-600"
                            }`}
                          >
                            <span
                              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all duration-300 ${
                                product.is_active ? "right-0.5" : "left-0.5"
                              }`}
                            />
                          </button>
                        </div>

                        {/* Pricing */}
                        {packages.map((pkg, pkgIdx) => (
                          <div key={pkgIdx} className="space-y-2">
                            {packages.length > 1 && (
                              <p className="text-xs font-semibold text-muted-foreground border-b pb-1">
                                {pkg.label}{" "}
                                {pkg.barcode && pkg.barcode !== product.barcode
                                  ? `(${pkg.barcode})`
                                  : ""}
                              </p>
                            )}
                            <div className="grid grid-cols-2 gap-3">
                              <div className="rounded-lg p-2.5 bg-sky-500/5 border border-sky-200/30 dark:border-sky-800/30">
                                <p className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 mb-1.5">
                                  جملة
                                </p>
                                <div className="space-y-1 text-xs">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                      العبوة
                                    </span>
                                    <span className="font-medium">
                                      {pkg.wholesale_package || "—"}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                      شراء
                                    </span>
                                    <span>{fmt(pkg.purchase_price)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                      بيع
                                    </span>
                                    <span className="font-bold text-sky-600 dark:text-sky-400">
                                      {fmt(pkg.wholesale_price)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="rounded-lg p-2.5 bg-amber-500/5 border border-amber-200/30 dark:border-amber-800/30">
                                <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 mb-1.5">
                                  قطاعي
                                </p>
                                <div className="space-y-1 text-xs">
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                      العبوة
                                    </span>
                                    <span className="font-medium">
                                      {pkg.retail_package || "—"}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                      شراء
                                    </span>
                                    <span>
                                      {fmt(pkg.retail_purchase_price)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-muted-foreground">
                                      بيع
                                    </span>
                                    <span className="font-bold text-amber-600 dark:text-amber-400">
                                      {fmt(pkg.retail_price)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            {pkg.discount_amount > 0 && (
                              <p className="text-xs text-center text-green-600 dark:text-green-400 font-medium">
                                خصم: {fmt(pkg.discount_amount)}
                              </p>
                            )}
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Dot indicators */}
              {currentProducts.length > 1 && currentProducts.length <= 20 && (
                <div className="flex justify-center gap-1.5">
                  {currentProducts.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSwipeIndex(idx);
                        swipeRef.current?.children[idx]?.scrollIntoView({
                          behavior: "smooth",
                          block: "nearest",
                          inline: "center",
                        });
                      }}
                      className={`h-2 rounded-full transition-all duration-300 ${
                        idx === swipeIndex
                          ? "w-6 bg-primary"
                          : "w-2 bg-muted-foreground/30"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* === Kanban Board View === */}
          {viewMode === "kanban" &&
            (() => {
              // Group products into columns
              const groups: Record<string, Product[]> = {};
              if (kanbanGroupBy === "manufacturer") {
                for (const p of filteredProducts) {
                  const key = p.manufacturer || "بدون مصنّع";
                  if (!groups[key]) groups[key] = [];
                  groups[key].push(p);
                }
              } else {
                groups["مفعل"] = filteredProducts.filter((p) => p.is_active);
                groups["معطل"] = filteredProducts.filter((p) => !p.is_active);
              }
              const columns = Object.entries(groups);

              return (
                <div className="space-y-3">
                  {/* Group-by toggle */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      تجميع حسب:
                    </span>
                    <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                      <button
                        onClick={() => setKanbanGroupBy("manufacturer")}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                          kanbanGroupBy === "manufacturer"
                            ? "bg-background shadow-sm text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        المصنّع
                      </button>
                      <button
                        onClick={() => setKanbanGroupBy("status")}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                          kanbanGroupBy === "status"
                            ? "bg-background shadow-sm text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        الحالة
                      </button>
                    </div>
                  </div>

                  {/* Board */}
                  <div
                    className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide"
                    style={{ WebkitOverflowScrolling: "touch" }}
                  >
                    {columns.map(([groupName, products]) => (
                      <div
                        key={groupName}
                        className="shrink-0 w-72 sm:w-80 flex flex-col bg-muted/40 rounded-xl border max-h-[calc(100vh-300px)]"
                      >
                        {/* Column Header */}
                        <div className="p-3 border-b bg-muted/60 rounded-t-xl sticky top-0 z-10">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-sm truncate">
                              {groupName}
                            </h4>
                            <Badge
                              variant="secondary"
                              className="text-[10px] shrink-0"
                            >
                              {products.length}
                            </Badge>
                          </div>
                        </div>

                        {/* Column Cards - Scrollable */}
                        <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-hide">
                          {products.map((product) => {
                            const fmt = (v: number) =>
                              Number(v || 0).toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                              });

                            return (
                              <Card
                                key={product.id}
                                className={`overflow-hidden transition-all hover:shadow-md cursor-pointer ${
                                  !product.is_active
                                    ? "opacity-50 grayscale"
                                    : ""
                                }`}
                                onClick={() => {
                                  setSelectedProduct(product);
                                  setDialogOpen(true);
                                }}
                              >
                                <CardContent className="p-3 space-y-2">
                                  {/* Name + Toggle */}
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                      <p className="text-sm font-semibold truncate">
                                        {highlightText(product.name, search)}
                                      </p>
                                      {kanbanGroupBy !== "manufacturer" &&
                                        product.manufacturer && (
                                          <p className="text-[11px] text-muted-foreground truncate">
                                            {product.manufacturer}
                                          </p>
                                        )}
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleToggle(
                                          product.id,
                                          !product.is_active,
                                        );
                                      }}
                                      className={`relative h-4 w-8 rounded-full transition-all duration-300 shrink-0 mt-0.5 ${
                                        product.is_active
                                          ? "bg-green-500"
                                          : "bg-gray-300 dark:bg-gray-600"
                                      }`}
                                    >
                                      <span
                                        className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-all duration-300 ${
                                          product.is_active
                                            ? "right-0.5"
                                            : "left-0.5"
                                        }`}
                                      />
                                    </button>
                                  </div>

                                  {/* Barcode */}
                                  {product.barcode && (
                                    <p className="text-[10px] font-mono text-muted-foreground truncate">
                                      {product.barcode}
                                    </p>
                                  )}

                                  {/* Quick Prices */}
                                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                                    <div className="bg-sky-500/5 rounded px-2 py-1">
                                      <span className="text-muted-foreground">
                                        جملة:{" "}
                                      </span>
                                      <span className="font-bold text-sky-600 dark:text-sky-400">
                                        {fmt(product.wholesale_price)}
                                      </span>
                                    </div>
                                    <div className="bg-amber-500/5 rounded px-2 py-1">
                                      <span className="text-muted-foreground">
                                        قطاعي:{" "}
                                      </span>
                                      <span className="font-bold text-amber-600 dark:text-amber-400">
                                        {fmt(product.retail_price)}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Actions */}
                                  <div className="flex items-center gap-1 pt-1 border-t">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedProduct(product);
                                        setDialogOpen(true);
                                      }}
                                      className="p-1 rounded hover:bg-muted transition-colors"
                                      title="تعديل"
                                    >
                                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                    </button>
                                    {product.barcode && (
                                      <>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            navigator.clipboard.writeText(
                                              product.barcode,
                                            );
                                            toast.success("تم نسخ الباركود");
                                          }}
                                          className="p-1 rounded hover:bg-muted transition-colors"
                                          title="نسخ الباركود"
                                        >
                                          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setBarcodePrintProduct(product);
                                            setBarcodePrintCount("1");
                                            setShowBarcodePrintModal(true);
                                          }}
                                          className="p-1 rounded hover:bg-muted transition-colors"
                                          title="طباعة الباركود"
                                        >
                                          <Printer className="h-3.5 w-3.5 text-muted-foreground" />
                                        </button>
                                      </>
                                    )}
                                    {isAdmin && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDeleteTarget(product);
                                        }}
                                        className="p-1 rounded hover:bg-destructive/10 transition-colors mr-auto"
                                        title="حذف"
                                      >
                                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                      </button>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

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

      {/* Delete All Confirmation */}
      <AlertDialog
        open={showDeleteAllConfirm}
        onOpenChange={setShowDeleteAllConfirm}
      >
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>مسح جميع الأصناف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من مسح جميع الأصناف؟ هذا الإجراء لا يمكن التراجع عنه
              وسيتم حذف {allProducts.length} صنف نهائياً.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-center gap-3 sm:justify-center">
            <AlertDialogAction
              onClick={handleDeleteAll}
              disabled={deletingAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingAll ? (
                <>
                  <Loader2 className="h-4 w-4 ml-1 animate-spin" />
                  جاري المسح...
                </>
              ) : (
                "نعم، امسح الكل"
              )}
            </AlertDialogAction>
            <AlertDialogCancel disabled={deletingAll}>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Single Product Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الصنف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف &quot;{deleteTarget?.name}&quot;؟ هذا الإجراء
              لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-center gap-3 sm:justify-center">
            <AlertDialogAction
              onClick={handleDeleteSingle}
              disabled={deletingSingle}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingSingle ? (
                <>
                  <Loader2 className="h-4 w-4 ml-1 animate-spin" />
                  جاري الحذف...
                </>
              ) : (
                "نعم، احذف"
              )}
            </AlertDialogAction>
            <AlertDialogCancel disabled={deletingSingle}>
              إلغاء
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
