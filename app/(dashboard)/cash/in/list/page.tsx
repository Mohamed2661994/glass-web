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
                            <Badge variant={sourceBadgeVariant(item.source_type)}>
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
                      onEdit={() => router.push(`/cash/in/edit/${item.id}`)}
                      onDelete={() => setDeleteItem(item)}
                    />
                  ))}
                </MobileTableWrapper>
              )
            }
          />
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
