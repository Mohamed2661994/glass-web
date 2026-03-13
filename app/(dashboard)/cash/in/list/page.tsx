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
import { useAuth } from "@/app/context/auth-context";
import { hasPermission } from "@/lib/permissions";
import {
  MobileTableCard,
  MobileTableWrapper,
} from "@/components/mobile-table-card";
import { ResponsiveTableContainer } from "@/components/responsive-table-container";

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
  const { user } = useAuth();
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
  const canEditCashIn = hasPermission(user, "cash_in_edit");
  const canDeleteCashIn = hasPermission(user, "cash_in_delete");

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
          <ResponsiveTableContainer
            desktop={
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
                    filtered.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs">
                          {item.id}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {item.customer_name}
                        </TableCell>
                        <TableCell>
                          <Badge variant={sourceBadgeVariant(item.source_type)}>
                            {sourceLabel(item.source_type)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-bold">
                          {Math.round(item.amount).toLocaleString()} ج
                        </TableCell>
                        <TableCell className="text-green-600 font-bold">
                          {Math.round(item.paid_amount).toLocaleString()} ج
                        </TableCell>
                        <TableCell className="text-red-500 font-bold">
                          {Math.round(item.remaining_amount).toLocaleString()} ج
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatDate(item.transaction_date)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                          {item.notes || "—"}
                        </TableCell>
                        <TableCell>
                          {canEditCashIn || canDeleteCashIn ? (
                            <div className="flex gap-2">
                              {canEditCashIn && (
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
                              )}
                              {canDeleteCashIn && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => setDeleteItem(item)}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            }
            mobile={
              loading ? (
                <div className="space-y-3 p-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Card key={i} className="p-4 space-y-2">
                      <Skeleton className="h-5 w-1/2" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-4/5" />
                    </Card>
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">
                  لا يوجد وارد
                </p>
              ) : (
                <MobileTableWrapper className="p-4">
                  {filtered.map((item) => (
                    <MobileTableCard
                      key={item.id}
                      fields={[
                        { label: "#", value: item.id },
                        { label: "الاسم", value: item.customer_name },
                        {
                          label: "النوع",
                          value: (
                            <Badge
                              variant={sourceBadgeVariant(item.source_type)}
                            >
                              {sourceLabel(item.source_type)}
                            </Badge>
                          ),
                        },
                        {
                          label: "المبلغ",
                          value: `${Math.round(item.amount).toLocaleString()} ج`,
                        },
                        {
                          label: "المدفوع",
                          value: `${Math.round(item.paid_amount).toLocaleString()} ج`,
                          color: "success",
                        },
                        {
                          label: "المتبقي",
                          value: `${Math.round(item.remaining_amount).toLocaleString()} ج`,
                          color: "danger",
                        },
                        {
                          label: "التاريخ",
                          value: formatDate(item.transaction_date),
                        },
                        { label: "ملاحظات", value: item.notes || "—" },
                      ]}
                      onEdit={
                        canEditCashIn
                          ? () => router.push(`/cash/in/edit/${item.id}`)
                          : undefined
                      }
                      onDelete={
                        canDeleteCashIn ? () => setDeleteItem(item) : undefined
                      }
                    />
                  ))}
                </MobileTableWrapper>
              )
            }
          />
        </CardContent>
      </Card>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل تريد حذف القيد &quot;{deleteItem?.customer_name}&quot;؟
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
