"use client";

import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function OfflinePage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-background p-4"
      dir="rtl"
    >
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center text-center gap-6 py-12 px-6">
          {/* Icon */}
          <div className="rounded-full bg-orange-100 dark:bg-orange-900/30 p-6">
            <WifiOff className="h-12 w-12 text-orange-600 dark:text-orange-400" />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">لا يوجد اتصال بالإنترنت</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              يبدو إن الاتصال بالإنترنت انقطع. تأكد من اتصالك وحاول مرة تانية.
            </p>
          </div>

          {/* Retry */}
          <Button
            size="lg"
            className="gap-2 w-full max-w-xs"
            onClick={() => {
              window.location.href = "/";
            }}
          >
            <RefreshCw className="h-4 w-4" />
            إعادة المحاولة
          </Button>

          {/* Tip */}
          <p className="text-xs text-muted-foreground">
            الصفحات اللي فتحتها قبل كده ممكن تكون متاحة من الكاش.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
