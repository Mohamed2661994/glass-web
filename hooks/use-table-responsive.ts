"use client";

import { useEffect, useState } from "react";

/**
 * useTableResponsive - Hook لإدارة الـ responsive layout
 * يساعد في تحديد حجم الشاشة الحالي
 */
export function useTableResponsive() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check initial screen size
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();

    // Listen for resize events
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return {
    isMobile,
    isDesktop: !isMobile,
  };
}

/**
 * Utility functions للبيانات
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("ar-EG", {
    style: "currency",
    currency: "EGP",
  }).format(value);
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("ar-EG");
}

export function truncateText(text: string, length: number = 20): string {
  return text.length > length ? text.substring(0, length) + "..." : text;
}
