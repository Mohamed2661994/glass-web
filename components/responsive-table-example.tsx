'use client';

/**
 * مثال عملي كامل لتطبيق Mobile Responsive Table
 * 
 * يمكنك نسخ هذا المثال وتعديله حسب احتياجات كل صفحة
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Edit2 } from 'lucide-react';
import { MobileTableCard, MobileTableWrapper } from '@/components/mobile-table-card';
import { ResponsiveTableContainer, TableSkeleton } from '@/components/responsive-table-container';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// مثال على البيانات
interface DataItem {
  id: number;
  name: string;
  amount: number;
  status: 'active' | 'inactive';
  date: string;
  notes: string;
}

interface ResponsiveTableExampleProps {
  data: DataItem[];
  isLoading?: boolean;
  onEdit?: (item: DataItem) => void;
  onDelete?: (item: DataItem) => void;
}

/**
 * مثال على Component يستخدم ResponsiveTableContainer
 * 
 * يعرض:
 * - Desktop: جدول عادي
 * - Mobile: بطاقات
 */
export function ResponsiveTableExample({
  data,
  isLoading = false,
  onEdit,
  onDelete,
}: ResponsiveTableExampleProps) {
  if (isLoading) {
    return <TableSkeleton rows={5} />;
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        لا توجد بيانات
      </div>
    );
  }

  return (
    <ResponsiveTableContainer
      desktop={
        <Table className="text-xs sm:text-sm">
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">#</TableHead>
              <TableHead className="text-right">الاسم</TableHead>
              <TableHead className="text-right">المبلغ</TableHead>
              <TableHead className="text-right">الحالة</TableHead>
              <TableHead className="text-right hidden md:table-cell">التاريخ</TableHead>
              <TableHead className="text-right hidden lg:table-cell">الملاحظات</TableHead>
              <TableHead className="text-right">إجراء</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-xs py-2">{item.id}</TableCell>
                <TableCell className="font-semibold py-2">{item.name}</TableCell>
                <TableCell className="font-bold py-2">
                  {item.amount.toLocaleString()} ج.م
                </TableCell>
                <TableCell className="py-2">
                  <Badge
                    variant={item.status === 'active' ? 'default' : 'secondary'}
                  >
                    {item.status === 'active' ? 'نشط' : 'غير نشط'}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs hidden md:table-cell py-2">
                  {item.date}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[100px] truncate hidden lg:table-cell py-2">
                  {item.notes}
                </TableCell>
                <TableCell className="py-2">
                  <div className="flex gap-1">
                    {onEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onEdit(item)}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => onDelete(item)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
      mobile={
        <MobileTableWrapper>
          {data.map((item) => (
            <MobileTableCard
              key={item.id}
              fields={[
                { label: '#', value: item.id },
                { label: 'الاسم', value: item.name },
                {
                  label: 'المبلغ',
                  value: `${item.amount.toLocaleString()} ج.م`,
                  color: 'info',
                },
                {
                  label: 'الحالة',
                  value: item.status === 'active' ? 'نشط' : 'غير نشط',
                  color:
                    item.status === 'active'
                      ? 'success'
                      : 'warning',
                },
                { label: 'التاريخ', value: item.date },
                { label: 'الملاحظات', value: item.notes },
              ]}
              onEdit={onEdit ? () => onEdit(item) : undefined}
              onDelete={onDelete ? () => onDelete(item) : undefined}
            />
          ))}
        </MobileTableWrapper>
      }
    />
  );
}

/**
 * مثال على الاستخدام في صفحة
 */
export function ExamplePage() {
  const [data] = useState<DataItem[]>([
    {
      id: 1,
      name: 'منتج أول',
      amount: 1500,
      status: 'active',
      date: '07/03/2026',
      notes: 'ملاحظة تجريبية',
    },
    {
      id: 2,
      name: 'منتج ثاني',
      amount: 2300,
      status: 'inactive',
      date: '06/03/2026',
      notes: 'ملاحظة أخرى',
    },
  ]);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">مثال Responsive Table</h1>
      <ResponsiveTableExample
        data={data}
        onEdit={(item) => console.log('Edit:', item)}
        onDelete={(item) => console.log('Delete:', item)}
      />
    </div>
  );
}
