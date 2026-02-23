"use client";

import { useCallback, useEffect, useState } from "react";
import api from "@/services/api";
import { multiWordMatch } from "@/lib/utils";
import { PageContainer } from "@/components/layout/page-container";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Factory, Pencil, Trash2, Plus, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { useRealtime } from "@/hooks/use-realtime";

interface Manufacturer {
  id: number;
  name: string;
  percentage: number;
  created_at: string;
}

export default function ManufacturersPage() {
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Manufacturer | null>(null);
  const [formName, setFormName] = useState("");
  const [formPercentage, setFormPercentage] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Manufacturer | null>(null);

  const fetchManufacturers = useCallback(async () => {
    try {
      const res = await api.get("/admin/manufacturers");
      setManufacturers(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error("فشل تحميل المصانع");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchManufacturers();
  }, [fetchManufacturers]);

  useRealtime("data:products", fetchManufacturers);

  const filtered = manufacturers.filter((m) => multiWordMatch(search, m.name));

  const openAdd = () => {
    setEditing(null);
    setFormName("");
    setFormPercentage("");
    setDialogOpen(true);
  };

  const openEdit = (m: Manufacturer) => {
    setEditing(m);
    setFormName(m.name);
    setFormPercentage(String(m.percentage || 0));
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error("اسم المصنع مطلوب");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/admin/manufacturers/${editing.id}`, {
          name: formName.trim(),
          percentage: Number(formPercentage) || 0,
        });
        toast.success("تم تعديل المصنع");
      } else {
        await api.post("/admin/manufacturers", {
          name: formName.trim(),
          percentage: Number(formPercentage) || 0,
        });
        toast.success("تم إضافة المصنع");
      }
      setDialogOpen(false);
      fetchManufacturers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "حدث خطأ");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/admin/manufacturers/${deleteTarget.id}`);
      toast.success("تم حذف المصنع");
      setDeleteTarget(null);
      fetchManufacturers();
    } catch {
      toast.error("فشل حذف المصنع");
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center min-h-[40vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="space-y-4">
        {/* Header */}
        <h1 className="text-2xl font-bold">المصانع</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث عن مصنع..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-9"
            />
          </div>
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4 ml-2" />
            إضافة مصنع
          </Button>
        </div>

        {/* Count */}
        <p className="text-sm text-muted-foreground">
          عدد المصانع: {filtered.length}
        </p>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-3 text-right">#</th>
                    <th className="p-3 text-right">اسم المصنع</th>
                    <th className="p-3 text-center">النسبة %</th>
                    <th className="p-3 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="p-8 text-center text-muted-foreground"
                      >
                        لا توجد مصانع
                      </td>
                    </tr>
                  ) : (
                    filtered.map((m, idx) => (
                      <tr key={m.id} className="border-b hover:bg-muted/50">
                        <td className="p-3">{idx + 1}</td>
                        <td className="p-3 font-medium">{m.name}</td>
                        <td className="p-3 text-center">
                          {m.percentage || 0}%
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(m)}
                            >
                              <Pencil className="h-4 w-4 text-blue-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteTarget(m)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "تعديل مصنع" : "إضافة مصنع جديد"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>اسم المصنع</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="اسم المصنع"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>النسبة المئوية %</Label>
              <Input
                type="number"
                value={formPercentage}
                onChange={(e) => setFormPercentage(e.target.value)}
                placeholder="0"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
              {editing ? "تعديل" : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المصنع</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف المصنع &quot;{deleteTarget?.name}&quot;؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-center gap-3 sm:justify-center">
            <AlertDialogAction onClick={handleDelete}>
              نعم، احذف
            </AlertDialogAction>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
