"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error for debugging (production-safe)
    console.error("[Dashboard Error]", error);
  }, [error]);

  return (
    <div
      dir="rtl"
      className="flex flex-col items-center justify-center min-h-[50vh] gap-4 p-6"
    >
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
        <span className="text-3xl">⚠️</span>
      </div>
      <h2 className="text-xl font-bold">حدث خطأ غير متوقع</h2>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        حدث خطأ أثناء تحميل الصفحة. يمكنك المحاولة مرة أخرى أو العودة للصفحة
        الرئيسية.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset} variant="default">
          إعادة المحاولة
        </Button>
        <Button onClick={() => (window.location.href = "/")} variant="outline">
          الصفحة الرئيسية
        </Button>
      </div>
    </div>
  );
}
