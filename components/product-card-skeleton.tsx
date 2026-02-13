import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ProductCardSkeleton() {
  return (
    <div className="rounded-2xl border p-5 space-y-4 animate-pulse">
      <div className="h-5 bg-muted rounded w-1/2" />
      <div className="h-4 bg-muted rounded w-1/3" />
      <div className="h-10 bg-muted rounded-xl" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-14 bg-muted rounded-xl" />
        <div className="h-14 bg-muted rounded-xl" />
      </div>
      <div className="h-20 bg-muted rounded-xl" />
      <div className="h-8 bg-muted rounded w-24 ml-auto" />
    </div>
  );
}
