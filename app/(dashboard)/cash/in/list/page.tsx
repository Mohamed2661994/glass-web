"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { noSpaces } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
import api from "@/services/api";
import { useRouter } from "next/navigation";
import { useRealtime } from "@/hooks/use-realtime";

const DISCOUNT_DIFF_MARKER = "{{discount_diff}}";

interface CashInItem {
  id: number;
  customer_name: string;
  amount: number;
  paid_amount: number;
  remaining_amount: number;
  notes: string | null;
  transaction_date: string;
  source_type: "manual" | "invoice" | "customer_payment";
  invoice_id?: number;
}

export default function CashInListPage() {
  const router = useRouter();
  const [data, setData] = useState<CashInItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchName, setSearchName] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [deleteItem, setDeleteItem] = useState<CashInItem | null>(null);

  const todayStr = useMemo(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  }, []);
  const [fromDate, setFromDate] = useState(todayStr);
  const [toDate, setToDate] = useState(todayStr);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/cash-in");
      setData(data.data || []);
    } catch {
      toast.error("فشل تحميل البيانات");
    } finally {
      setLoading(false);
    }
  }, []);

  useRealtime(["data:cash", "data:cash-in"], fetchData);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = useMemo(() => {
    return data.filter((item) => {
      const rawNotes = item.notes || (item as any).description || "";
      if ((rawNotes || "").includes(DISCOUNT_DIFF_MARKER)) return false;
      if (
        searchName.trim() &&
        !noSpaces(item.customer_name || "")
          .toLowerCase()
          .includes(noSpaces(searchName).toLowerCase())
      )
        return false;
      if (filterType !== "all" && item.source_type !== filterType) return false;

      const itemDate = item.transaction_date.substring(0, 10);
      if (fromDate && itemDate < fromDate) return false;
      if (toDate && itemDate > toDate) return false;

      return true;
    });
  }, [data, searchName, filterType, fromDate, toDate]);

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      await api.delete(`/cash-in/${deleteItem.id}`);
      toast.success("تم حذف القيد");
      setDeleteItem(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "فشل حذف القيد");
    }
  };

  const formatDate = (s: string) => {
    const d = s.substring(0, 10).split("-");
    return `${d[2]}/${d[1]}/${d[0]}`;
  };

  const sourceLabel = (s: string) => {
    switch (s) {
      case "manual":
        return "وارد عادي";
      case "invoice":
        return "فاتورة";
      case "customer_payment":
        return "سند دفع";
      default:
        return s;
    }
  };

  const sourceBadgeVariant = (s: string) => {
    switch (s) {
      case "invoice":
        return "default" as const;
      case "customer_payment":
        return "secondary" as const;
      default:
        return "outline" as const;
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4" dir="rtl">
      <h1 className="text-xl font-bold">عرض الوارد</h1>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              placeholder="🔍 بحث بالاسم"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
            />
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger>
                <SelectValue placeholder="النوع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="manual">وارد عادي</SelectItem>
                <SelectItem value="invoice">فاتورة</SelectItem>
                <SelectItem value="customer_payment">سند دفع</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>من تاريخ</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label>إلى تاريخ</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>
          {(searchName || filterType !== "all" || fromDate || toDate) && (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500"
              onClick={() => {
                setSearchName("");
                setFilterType("all");
                setFromDate("");
                setToDate("");
              }}
            >
              مسح الفلاتر
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">#</TableHead>
                <TableHead className="text-right">الاسم</TableHead>
                <TableHead className="text-right">النوع</TableHead>
                <TableHead className="text-right">المبلغ</TableHead>
                <TableHead className="text-right">المدفوع</TableHead>
                <TableHead className="text-right">المتبقي</TableHead>
                <TableHead className="text-right">التاريخ</TableHead>
                <TableHead className="text-right">ملاحظات</TableHead>
                <TableHead className="text-right">إجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center py-8 text-muted-foreground"
                  >
                    لا يوجد وارد
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((item) => {
                  // Parse breakdown from notes: {{total|paid|remaining}}
                  const metaMatch = item.notes?.match(
                    /\{\{(-?[\d.]+)\|(-?[\d.]+)\|(-?[\d.]+)\}\}/,
                  );
                  const metaTotal = metaMatch ? Number(metaMatch[1]) : null;
                  const metaPaid = metaMatch ? Number(metaMatch[2]) : null;
                  const metaRemaining = metaMatch ? Number(metaMatch[3]) : null;
                  const displayNotes =
                    item.notes?.replace(/\{\{[-\d.|]+\}\}/, "").trim() || null;

                  const totalAmount =
                    metaTotal != null
                      ? metaTotal
                      : item.source_type === "invoice"
                        ? Number(item.paid_amount) +
                          Number(item.remaining_amount)
                        : Number(item.amount);
                  const displayPaid =
                    metaPaid != null ? metaPaid : Number(item.paid_amount || 0);
                  const displayRemaining =
                    metaRemaining != null
                      ? metaRemaining
                      : Number(item.remaining_amount || 0);
                  return (
                    <TableRow key={item.id}>
                      <TableCell>{item.id}</TableCell>
                      <TableCell className="font-semibold">
                        {item.customer_name || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={sourceBadgeVariant(item.source_type)}>
                          {sourceLabel(item.source_type)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-green-600 font-bold">
                        {Math.round(totalAmount).toLocaleString()} ج
                      </TableCell>
                      <TableCell>
                        {Math.round(displayPaid).toLocaleString()}
                      </TableCell>
                      <TableCell
                        className={
                          displayRemaining > 0 ? "text-red-500 font-bold" : ""
                        }
                      >
                        {Math.round(displayRemaining).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatDate(item.transaction_date)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                        {item.source_type !== "invoice"
                          ? displayNotes || "—"
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              router.push(`/cash/in/edit/${item.id}`)
                            }
                          >
                            <Pencil className="h-4 w-4 text-blue-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setDeleteItem(item)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل تريد حذف هذا القيد؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
