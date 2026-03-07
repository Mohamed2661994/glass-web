'use client';

/**
 * Mobile Responsive Tables Demo
 * ==========================
 * 
 * هذه الصفحة توضح كيفية استخدام المكونات الجديدة
 * قم بزيارة هذه الصفحة واختبرها على الموبيل والـ desktop
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, Edit2, Smartphone, Monitor } from 'lucide-react';
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
import { useTableResponsive } from '@/hooks/use-table-responsive';

// Sample data
const SAMPLE_DATA = [
  {
    id: 1,
    name: 'محمد أحمد',
    amount: 1500,
    status: 'active' as const,
    date: '07/03/2026',
    type: 'سند دفع',
    notes: 'دفعة أولى من الفاتورة',
  },
  {
    id: 2,
    name: 'فاطمة علي',
    amount: 2300,
    status: 'pending' as const,
    date: '06/03/2026',
    type: 'وارد عادي',
    notes: 'تحويل من حساب آخر',
  },
  {
    id: 3,
    name: 'أحمد محمود',
    amount: 850,
    status: 'active' as const,
    date: '05/03/2026',
    type: 'فاتورة',
    notes: 'باقي الدفعة السابقة',
  },
  {
    id: 4,
    name: 'ليلى إبراهيم',
    amount: 3200,
    status: 'inactive' as const,
    date: '04/03/2026',
    type: 'فرقات خصم',
    notes: 'تصحيح الخصم السابق',
  },
];

export default function MobileResponsiveDemo() {
  const { isMobile, isDesktop } = useTableResponsive();
  const [isLoading, setIsLoading] = useState(false);

  const handleEdit = (item: (typeof SAMPLE_DATA)[0]) => {
    alert(`تعديل: ${item.name}`);
  };

  const handleDelete = (item: (typeof SAMPLE_DATA)[0]) => {
    alert(`حذف: ${item.name}`);
  };

  return (
    <div className="container mx-auto p-4 max-w-7xl space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold">Demo: Mobile Responsive Tables</h1>
          {isMobile && (
            <Badge className="flex gap-1 bg-blue-600">
              <Smartphone className="h-3 w-3" />
              Mobile
            </Badge>
          )}
          {isDesktop && (
            <Badge className="flex gap-1 bg-green-600">
              <Monitor className="h-3 w-3" />
              Desktop
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground">
          غيّر حجم نافذة المتصفح أو افتح على الموبيل لرؤية التصميم المتجاوب
        </p>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Monitor className="h-4 w-4" />
              Desktop View
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              يظهر جدول عادي مع جميع الأعمدة على الشاشات الكبيرة (768px وأكثر)
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Smartphone className="h-4 w-4" />
              Mobile View
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              تظهر بطاقات بجميع البيانات مع أزرار التعديل والحذف على الشاشات الصغيرة
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Demo */}
      <Card>
        <CardHeader>
          <CardTitle>جدول حركات الخزنة</CardTitle>
          <CardDescription>
            جرّب تغيير حجم النافذة لرؤية التصميم المتجاوب
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveTableContainer
            desktop={
              <Table className="text-xs sm:text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">#</TableHead>
                    <TableHead className="text-right">الاسم</TableHead>
                    <TableHead className="text-right">المبلغ</TableHead>
                    <TableHead className="text-right">النوع</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right hidden lg:table-cell">التاريخ</TableHead>
                    <TableHead className="text-right hidden lg:table-cell">ملاحظات</TableHead>
                    <TableHead className="text-right">إجراء</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {SAMPLE_DATA.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs py-2">{item.id}</TableCell>
                      <TableCell className="font-semibold py-2">{item.name}</TableCell>
                      <TableCell className="font-bold py-2">
                        {item.amount.toLocaleString()} ج
                      </TableCell>
                      <TableCell className="py-2">{item.type}</TableCell>
                      <TableCell className="py-2">
                        <Badge
                          variant={
                            item.status === 'active'
                              ? 'default'
                              : item.status === 'pending'
                                ? 'secondary'
                                : 'outline'
                          }
                        >
                          {item.status === 'active'
                            ? 'نشط'
                            : item.status === 'pending'
                              ? 'قيد الانتظار'
                              : 'غير نشط'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs py-2 hidden lg:table-cell">
                        {item.date}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[100px] truncate py-2 hidden lg:table-cell">
                        {item.notes}
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleEdit(item)}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleDelete(item)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            }
            mobile={
              <MobileTableWrapper>
                {SAMPLE_DATA.map((item) => (
                  <MobileTableCard
                    key={item.id}
                    fields={[
                      { label: '#', value: item.id },
                      { label: 'الاسم', value: item.name },
                      {
                        label: 'المبلغ',
                        value: `${item.amount.toLocaleString()} ج`,
                        color: 'info',
                      },
                      { label: 'النوع', value: item.type },
                      {
                        label: 'الحالة',
                        value:
                          item.status === 'active'
                            ? 'نشط'
                            : item.status === 'pending'
                              ? 'قيد الانتظار'
                              : 'غير نشط',
                        color:
                          item.status === 'active'
                            ? 'success'
                            : item.status === 'pending'
                              ? 'warning'
                              : 'danger',
                      },
                      { label: 'التاريخ', value: item.date },
                      { label: 'ملاحظات', value: item.notes },
                    ]}
                    onEdit={() => handleEdit(item)}
                    onDelete={() => handleDelete(item)}
                  />
                ))}
              </MobileTableWrapper>
            }
          />
        </CardContent>
      </Card>

      {/* Loading State Demo */}
      <Card>
        <CardHeader>
          <CardTitle>حالة التحميل</CardTitle>
          <CardDescription>
            اضغط على الزر لرؤية حالة التحميل
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={() => {
              setIsLoading(true);
              setTimeout(() => setIsLoading(false), 3000);
            }}
            disabled={isLoading}
          >
            {isLoading ? 'جاري التحميل...' : 'محاكاة التحميل'}
          </Button>
          {isLoading && <TableSkeleton rows={4} />}
        </CardContent>
      </Card>

      {/* Features List */}
      <Card>
        <CardHeader>
          <CardTitle>المزايا</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span>عرض جدول عادي على Desktop والبطاقات على Mobile</span>
            </li>
            <li className="flex gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span>أزرار تعديل وحذف متوفرة على كلا العرضين</span>
            </li>
            <li className="flex gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span>معالجة الحالات المختلفة (النشط، قيد الانتظار، غير النشط)</span>
            </li>
            <li className="flex gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span>تصميم responsive يعمل على جميع أحجام الشاشات</span>
            </li>
            <li className="flex gap-2">
              <span className="text-green-600 font-bold">✓</span>
              <span>دعم القوائم والشارات والألوان</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
