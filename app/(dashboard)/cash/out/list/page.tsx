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
import { useAuth } from "@/app/context/auth-context";
import { hasPermission } from "@/lib/permissions";
import {
  MobileTableCard,
  MobileTableWrapper,
} from "@/components/mobile-table-card";
import { ResponsiveTableContainer } from "@/components/responsive-table-container";

interface CashOutItem {
  id: number;
  name: string;
  amount: number;
  notes: string | null;
  transaction_date: string;
  permission_number: string;
  entry_type: "expense" | "purchase" | "supplier_payment";
}

export default function CashOutListPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState<CashOutItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchName, setSearchName] = useState("");
  const todayStr = useMemo(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  }, []);
  const [fromDate, setFromDate] = useState(todayStr);
  const [toDate, setToDate] = useState(todayStr);
  const canEditCashOut = hasPermission(user, "cash_out_edit");
  const canDeleteCashOut = hasPermission(user, "cash_out_delete");

  const [deleteItem, setDeleteItem] = useState<CashOutItem | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (fromDate) params.from_date = fromDate;
      if (toDate) params.to_date = toDate;
      if (searchName.trim()) params.search_name = searchName.trim();
      const { data } = await api.get("/cash/out", { params });
      setData(data.data || []);
    } catch {
      toast.error("فشل تحميل المنصرفات");
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, searchName]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetchData();
    }, 300);

    return () => window.clearTimeout(timer);
  }, [fetchData]);

  const filtered = useMemo(() => {
    return data.filter((item) => {
      if (
        searchName.trim() &&
        !noSpaces(item.name)
          .toLowerCase()
          .includes(noSpaces(searchName).toLowerCase())
      )
        return false;
      return true;
    });
  }, [data, searchName]);

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      await api.delete(`/cash/out/${deleteItem.id}`);
      toast.success("تم الحذف");
      setDeleteItem(null);
      fetchData();
    } catch {
      toast.error("فشل الحذف");
    }
  };

  const formatDate = (s: string) => {
    const d = s.substring(0, 10).split("-");
    return `${d[2]}/${d[1]}/${d[0]}`;
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4" dir="rtl">
      <h1 className="text-xl font-bold">عرض المنصرف</h1>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <Input
            placeholder="🔍 بحث بالاسم"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
          />
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
          {(searchName || fromDate || toDate) && (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-500"
              onClick={() => {
                setSearchName("");
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
                    <TableHead className="text-right">رقم الإذن</TableHead>
                    <TableHead className="text-right">الاسم</TableHead>
                    <TableHead className="text-right">النوع</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">ملاحظات</TableHead>
                    <TableHead className="text-right">إجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 7 }).map((_, j) => (
                          <TableCell key={j}>
                            <Skeleton className="h-4 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center py-8 text-muted-foreground"
                      >
                        لا يوجد منصرفات
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-mono text-xs">
                          {item.permission_number}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {item.name}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              item.entry_type === "expense"
                                ? "destructive"
                                : item.entry_type === "supplier_payment"
                                  ? "secondary"
                                  : "default"
                            }
                          >
                            {item.entry_type === "expense"
                              ? "مصروفات"
                              : item.entry_type === "supplier_payment"
                                ? "دفعة مورد"
                                : "مشتريات"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-red-500 font-bold">
                          {Math.round(item.amount).toLocaleString()} ج
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatDate(item.transaction_date)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                          {item.notes || "—"}
                        </TableCell>
                        <TableCell>
                          {canEditCashOut || canDeleteCashOut ? (
                            <div className="flex gap-2">
                              {canEditCashOut && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() =>
                                    router.push(`/cash/out?edit=${item.id}`)
                                  }
                                >
                                  <Pencil className="h-4 w-4 text-blue-500" />
                                </Button>
                              )}
                              {canDeleteCashOut && (
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
                  لا يوجد منصرفات
                </p>
              ) : (
                <MobileTableWrapper className="p-4">
                  {filtered.map((item) => (
                    <MobileTableCard
                      key={item.id}
                      fields={[
                        { label: "رقم الإذن", value: item.permission_number },
                        { label: "الاسم", value: item.name },
                        {
                          label: "النوع",
                          value: (
                            <Badge
                              variant={
                                item.entry_type === "expense"
                                  ? "destructive"
                                  : item.entry_type === "supplier_payment"
                                    ? "secondary"
                                    : "default"
                              }
                            >
                              {item.entry_type === "expense"
                                ? "مصروفات"
                                : item.entry_type === "supplier_payment"
                                  ? "دفعة مورد"
                                  : "مشتريات"}
                            </Badge>
                          ),
                        },
                        {
                          label: "المبلغ",
                          value: `${Math.round(item.amount).toLocaleString()} ج`,
                          color: "danger",
                        },
                        {
                          label: "التاريخ",
                          value: formatDate(item.transaction_date),
                        },
                        { label: "ملاحظات", value: item.notes || "—" },
                      ]}
                      onEdit={
                        canEditCashOut
                          ? () => router.push(`/cash/out?edit=${item.id}`)
                          : undefined
                      }
                      onDelete={
                        canDeleteCashOut
                          ? () => setDeleteItem(item)
                          : undefined
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
              هل تريد حذف المنصرف &quot;{deleteItem?.name}&quot;؟
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
