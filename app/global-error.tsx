"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Global Error]", error);
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body className="flex flex-col items-center justify-center min-h-screen gap-4 p-6 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white">
        <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
          <span className="text-3xl">❌</span>
        </div>
        <h2 className="text-xl font-bold">حدث خطأ في النظام</h2>
        <p className="text-sm text-zinc-500 text-center max-w-md">
          نعتذر عن هذا الخطأ. يمكنك المحاولة مرة أخرى.
        </p>
        <Button onClick={reset}>إعادة المحاولة</Button>
      </body>
    </html>
  );
}
