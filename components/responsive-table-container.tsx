"use client";

import React, { ReactNode } from "react";
import { Card } from "@/components/ui/card";

/**
 * ResponsiveTableContainer - Wrapper يدعم عرض الجدول على desktop والبطاقات على موبايل
 *
 * الاستخدام:
 * <ResponsiveTableContainer
 *   desktop={<Table>...</Table>}
 *   mobile={<MobileTableWrapper>...</MobileTableWrapper>}
 * />
 */
interface ResponsiveTableContainerProps {
  children?: ReactNode;
  desktop?: ReactNode;
  mobile?: ReactNode;
  className?: string;
}

export function ResponsiveTableContainer({
  children,
  desktop,
  mobile,
  className = "",
}: ResponsiveTableContainerProps) {
  return (
    <>
      {/* Desktop View - الظهور على screens أكبر من md */}
      <div className={`hidden md:block ${className}`}>
        {desktop || children}
      </div>

      {/* Mobile View - الظهور على screens أصغر من md */}
      <div className={`block md:hidden ${className}`}>{mobile || children}</div>
    </>
  );
}

/**
 * TableSkeleton - Loading state للجدول على الموبيل
 */
import { Skeleton } from "@/components/ui/skeleton";

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Card key={i} className="p-4">
          <div className="space-y-2">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </Card>
      ))}
    </div>
  );
}
