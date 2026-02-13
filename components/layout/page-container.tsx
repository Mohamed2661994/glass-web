"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageContainerProps {
  children: ReactNode;
  className?: string;

  /**
   * sm  → فورمات صغيرة
   * md  → فواتير / صفحات إدخال (المناسب لك)
   * lg  → صفحات عادية
   * xl  → داشبوردات كبيرة
   * full → بدون قيود
   */
  size?: "sm" | "md" | "lg" | "xl" | "full";
}

/* ================= WIDTH PRESETS ================= */

const sizes = {
  sm: "max-w-[640px]",
  md: "max-w-[780px]", // 👈 الأفضل للفواتير
  lg: "max-w-[980px]",
  xl: "max-w-[1200px]",
  full: "max-w-none",
};

/* ================= COMPONENT ================= */

export function PageContainer({
  children,
  className,
  size = "lg",
}: PageContainerProps) {
  return (
    <div className="w-full flex justify-center">
      <div className={cn("w-full px-4", sizes[size], className)}>
        {children}
      </div>
    </div>
  );
}
