# دليل تطبيق Mobile Responsive Tables

## المقدمة

تم إنشاء مجموعة مكونات وأدوات لجعل الجداول في التطبيق responsive على الأجهزة المحمولة.

## المكونات الرئيسية

### 1. `MobileTableCard` - بطاقة عرض البيانات على الموبيل

**الموقع:** `components/mobile-table-card.tsx`

عرض صف واحد من جدول كبطاقة على الموبيل.

#### الاستخدام:

```tsx
import { MobileTableCard, MobileTableWrapper } from "@/components/mobile-table-card";

<MobileTableWrapper>
  <MobileTableCard
    fields={[
      { label: "#", value: item.id },
      { label: "الاسم", value: item.name },
      { label: "المبلغ", value: item.amount, color: "success" },
      { label: "المتبقي", value: item.remaining, color: item.remaining > 0 ? "danger" : "default" },
    ]}
    onEdit={() => handleEdit(item)}
    onDelete={() => handleDelete(item)}
  />
</MobileTableWrapper>
```

#### Props:

- `fields`: مصفوفة من الحقول
  - `label`: عنوان الحقل
  - `value`: قيمة الحقل (string أو ReactNode)
  - `className`: فئات Tailwind إضافية (اختياري)
  - `color`: لون الشارة ('default', 'success', 'warning', 'danger', 'info') (اختياري)

- `onEdit`: دالة يتم استدعاؤها عند الضغط على زر التعديل (اختياري)
- `onDelete`: دالة يتم استدعاؤها عند الضغط على زر الحذف (اختياري)
- `className`: فئات Tailwind للبطاقة (اختياري)

### 2. `ResponsiveTableContainer` - Wrapper يعرض الجدول أو البطاقات

**الموقع:** `components/responsive-table-container.tsx`

#### الاستخدام:

```tsx
import { ResponsiveTableContainer } from "@/components/responsive-table-container";

<ResponsiveTableContainer
  desktop={
    <Table>
      {/* Desktop table content */}
    </Table>
  }
  mobile={
    <MobileTableWrapper>
      {/* Mobile card content */}
    </MobileTableWrapper>
  }
/>
```

### 3. Hook `useTableResponsive`

**الموقع:** `hooks/use-table-responsive.ts`

لتحديد حجم الشاشة الحالي وتوفير وظائف مساعدة.

#### الاستخدام:

```tsx
import { useTableResponsive, formatCurrency, formatDate } from "@/hooks/use-table-responsive";

const { isMobile, isDesktop } = useTableResponsive();

if (isMobile) {
  // عرض البطاقات
} else {
  // عرض الجدول
}
```

## أمثلة عملية

### مثال 1: تطبيق على صفحة الواردات (cash/in/page.tsx)

```tsx
import { MobileTableCard, MobileTableWrapper } from "@/components/mobile-table-card";
import { ResponsiveTableContainer } from "@/components/responsive-table-container";

// في جزء الجدول:
<ResponsiveTableContainer
  desktop={
    <Table className="text-xs sm:text-sm">
      <TableHeader>
        <TableRow>
          <TableHead className="text-right">رقم القيد</TableHead>
          <TableHead className="text-right">الاسم</TableHead>
          <TableHead className="text-right">المبلغ</TableHead>
          <TableHead className="text-right">النوع</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map(item => (
          <TableRow key={item.id}>
            <TableCell className="font-mono text-xs">{item.cash_in_number}</TableCell>
            <TableCell className="font-semibold">{item.customer_name}</TableCell>
            <TableCell className="font-bold">{item.amount.toLocaleString()} ج</TableCell>
            <TableCell>
              <Badge>{item.source_type}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  }
  mobile={
    <MobileTableWrapper>
      {items.map(item => (
        <MobileTableCard
          key={item.id}
          fields={[
            { label: "رقم القيد", value: item.cash_in_number },
            { label: "الاسم", value: item.customer_name },
            { label: "المبلغ", value: `${item.amount.toLocaleString()} ج`, color: "success" },
            { label: "النوع", value: item.source_type },
          ]}
          onDelete={() => handleDelete(item)}
        />
      ))}
    </MobileTableWrapper>
  }
/>
```

### مثال 2: استخدام الخيار المرن (Hidden Columns)

إذا كنت تريد فقط إخفاء بعض الأعمدة على الموبيل وعدم تغيير الهيكل:

```tsx
<Table className="text-xs sm:text-sm">
  <TableHeader>
    <TableRow>
      <TableHead className="text-right">رقم الفاتورة</TableHead>
      <TableHead className="text-right">العميل</TableHead>
      <TableHead className="text-right hidden md:table-cell">البريد الإلكتروني</TableHead>
      <TableHead className="text-right">الإجمالي</TableHead>
      <TableHead className="text-right hidden lg:table-cell">الملاحظات</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {items.map(item => (
      <TableRow key={item.id}>
        <TableCell>{item.id}</TableCell>
        <TableCell>{item.customer}</TableCell>
        <TableCell className="hidden md:table-cell">{item.email}</TableCell>
        <TableCell>{item.total}</TableCell>
        <TableCell className="hidden lg:table-cell text-xs">{item.notes}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

## Tailwind Breakpoints

```
sm: 640px
md: 768px
lg: 1024px
xl: 1280px
2xl: 1536px
```

### الفئات الموصى بها:

- `hidden md:table-cell` - إخفاء على الموبيل، عرض على desktop
- `block md:hidden` - عرض على الموبيل فقط
- `text-xs md:text-sm lg:text-base` - حجم الخط responsive

## الصفحات التي تحتاج التحديث

### صفحات بالجداول:

1. **app/(dashboard)/cash/in/page.tsx** - الواردات
2. **app/(dashboard)/cash/in/list/page.tsx** - قائمة الواردات
3. **app/(dashboard)/cash/in/discount-diffs/page.tsx** - فروق الخصومات
4. **app/(dashboard)/suppliers/page.tsx** - الموردين
5. **app/(dashboard)/customers/page.tsx** - العملاء
6. **app/(dashboard)/products/page.tsx** - المنتجات
7. **app/(dashboard)/invoices/page.tsx** - الفواتير
8. **app/(dashboard)/reports/\**/page.tsx** - التقارير
9. **app/(dashboard)/stock-transfer/page.tsx** - تحويلات المخزن
10. **app/(dashboard)/transfers/by-date/page.tsx** - التحويلات حسب التاريخ

### استراتيجية التطبيق:

يمكن تطبيق الحل بثلاث طرق حسب تعقيد الصفحة:

1. **الطريقة البسيطة**: استخدام `hidden md:table-cell` لإخفاء الأعمدة غير الضرورية
2. **الطريقة الوسيطة**: استخدام `ResponsiveTableContainer` مع نفس البيانات
3. **الطريقة المتقدمة**: استخدام `MobileTableCard` لعرض مخصص على الموبيل

## CSS Utilities

يمكنك استخدام الـ CSS utilities من `lib/responsive-table.css`:

```css
/* Classes متاحة: */
.hide-mobile /* hidden md:table-cell */
.show-mobile /* block md:hidden */
.table-cell-responsive /* Responsive padding */
.text-responsive /* Responsive font size */
.mobile-card-row /* Card-like appearance */
.mobile-label /* Label styling for mobile */
.mobile-value /* Value styling for mobile */
```

## أفضل الممارسات

1. **تجربة المستخدم**: اختبر على أحجام شاشات مختلفة
2. **الأداء**: استخدم `useMemo` للبيانات المعقدة
3. **الأيقونات**: استخدم أيقونات صغيرة على الموبيل
4. **الألوان**: استخدم الألوان للتمييز بين الحالات (نجاح، خطأ، إلخ)
5. **التنقل**: أضف زرار التعديل والحذف بسهولة على الموبيل

## الاختبار

لاختبار الـ responsive design:

```bash
# في DevTools (F12 في المتصفح):
1. اضغط على Ctrl+Shift+M لفتح Mobile View
2. تأكد من أن الجداول تظهر كبطاقات
3. اختبر على أحجام شاشات مختلفة (320px, 480px, 768px, etc.)
```

## الخطوات التالية

1. استيراد المكونات الجديدة
2. تطبيق على صفحة واحدة أولاً
3. اختبار على الموبيل والـ desktop
4. تطبيق على الصفحات الأخرى تدريجياً
5. التأكد من التوافقية مع جميع المتصفحات
