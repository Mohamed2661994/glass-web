'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Trash2, Edit2 } from 'lucide-react';

interface DataField {
  label: string;
  value: React.ReactNode;
  className?: string;
  color?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

interface MobileTableCardProps {
  fields: DataField[];
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
}

/**
 * MobileTableCard - يعرض بيانات صف الجدول كبطاقة على الموبيل
 * استخدمها مع: hidden md:table-row و md:hidden لعرض الجدول على desktop والبطاقات على موبايل
 */
export function MobileTableCard({
  fields,
  onEdit,
  onDelete,
  className = '',
}: MobileTableCardProps) {
  return (
    <Card className={`p-4 space-y-3 md:hidden ${className}`}>
      {/* Row counter or main identifier */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-muted-foreground">
          {fields[0]?.label}
        </span>
        <span className="text-lg font-semibold">{fields[0]?.value}</span>
      </div>

      {/* Data fields */}
      <div className="space-y-2">
        {fields.slice(1).map((field, index) => (
          <div key={index} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground font-medium">{field.label}</span>
            <div className={field.className}>
              {typeof field.value === 'string' && field.color ? (
                <Badge
                  variant={
                    field.color === 'success'
                      ? 'default'
                      : field.color === 'danger'
                        ? 'destructive'
                        : 'secondary'
                  }
                  className={
                    field.color === 'success'
                      ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                      : field.color === 'danger'
                        ? 'bg-red-500/10 text-red-700 dark:text-red-400'
                        : ''
                  }
                >
                  {field.value}
                </Badge>
              ) : (
                <span className="font-medium">{field.value}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      {(onEdit || onDelete) && (
        <div className="flex gap-2 pt-2 border-t">
          {onEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              className="flex-1"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              تعديل
            </Button>
          )}
          {onDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onDelete}
              className="flex-1"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              حذف
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

/**
 * Mobile Table Wrapper - يحتوي على التعليقات والهيكل العام
 */
export function MobileTableWrapper({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-3 md:space-y-0 ${className}`}>
      {children}
    </div>
  );
}
