"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface PullToRefreshProps {
  children: React.ReactNode;
  className?: string;
}

export function PullToRefresh({ children, className }: PullToRefreshProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pulling, setPulling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef(0);
  const isPullingRef = useRef(false);

  const THRESHOLD = 80; // px to trigger refresh
  const MAX_PULL = 120;

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const container = containerRef.current;
    if (!container || refreshing) return;

    // Only activate when scrolled to top
    if (container.scrollTop <= 0) {
      startYRef.current = e.touches[0].clientY;
      isPullingRef.current = true;
    }
  }, [refreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPullingRef.current || refreshing) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - startYRef.current;

    if (diff > 0) {
      const distance = Math.min(diff * 0.5, MAX_PULL);
      setPullDistance(distance);
      setPulling(true);

      // Prevent default scroll when pulling
      if (distance > 10) {
        e.preventDefault();
      }
    }
  }, [refreshing]);

  const handleTouchEnd = useCallback(() => {
    if (!isPullingRef.current) return;
    isPullingRef.current = false;

    if (pullDistance >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPullDistance(50); // keep indicator visible

      // Reload the page
      window.location.reload();
    } else {
      setPulling(false);
      setPullDistance(0);
    }
  }, [pullDistance, refreshing]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const progress = Math.min(pullDistance / THRESHOLD, 1);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Pull indicator */}
      <div
        className="absolute left-0 right-0 flex justify-center z-10 pointer-events-none transition-transform duration-200"
        style={{
          transform: `translateY(${pulling || refreshing ? pullDistance - 40 : -40}px)`,
          opacity: pulling || refreshing ? 1 : 0,
        }}
      >
        <div className="bg-background border rounded-full p-2 shadow-md">
          <RefreshCw
            className={cn(
              "h-5 w-5 text-muted-foreground transition-transform",
              refreshing && "animate-spin"
            )}
            style={{
              transform: refreshing ? undefined : `rotate(${progress * 360}deg)`,
            }}
          />
        </div>
      </div>

      {/* Content with pull offset */}
      <div
        className="min-h-full"
        style={{
          transform: pulling || refreshing ? `translateY(${pullDistance}px)` : undefined,
          transition: pulling ? "none" : "transform 0.3s ease",
        }}
      >
        {children}
      </div>
    </div>
  );
}
