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
  const indicatorRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);
  const [refreshing, setRefreshing] = useState(false);

  const startYRef = useRef(0);
  const isPullingRef = useRef(false);
  const pullDistanceRef = useRef(0);
  // Only allow pull if the PREVIOUS touch ended while already at top
  const readyRef = useRef(false);

  const THRESHOLD = 80;
  const MAX_PULL = 120;

  // Direct DOM updates — no React re-renders during scroll
  const updateVisuals = useCallback((distance: number) => {
    const indicator = indicatorRef.current;
    const content = contentRef.current;
    const icon = iconRef.current;
    if (!indicator || !content || !icon) return;

    if (distance > 0) {
      indicator.style.transform = `translateY(${distance - 40}px)`;
      indicator.style.opacity = "1";
      content.style.transform = `translateY(${distance}px)`;
      content.style.transition = "none";
      const progress = Math.min(distance / THRESHOLD, 1);
      icon.style.transform = `rotate(${progress * 360}deg)`;
    } else {
      indicator.style.transform = "translateY(-40px)";
      indicator.style.opacity = "0";
      content.style.transform = "";
      content.style.transition = "transform 0.3s ease";
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Mark ready when user is settled at the top (scroll ends at 0)
    const handleScroll = () => {
      readyRef.current = container.scrollTop <= 0;
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (refreshing) return;
      // Only allow pull if already at top AND previous gesture ended at top
      if (container.scrollTop <= 0 && readyRef.current) {
        startYRef.current = e.touches[0].clientY;
        isPullingRef.current = true;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPullingRef.current || refreshing) return;

      const diff = e.touches[0].clientY - startYRef.current;

      if (diff > 0) {
        const distance = Math.min(diff * 0.5, MAX_PULL);
        pullDistanceRef.current = distance;
        updateVisuals(distance);

        if (distance > 10) {
          e.preventDefault();
        }
      } else {
        if (pullDistanceRef.current === 0) {
          isPullingRef.current = false;
        }
      }
    };

    const handleTouchEnd = () => {
      // Update ready state: mark ready only if we ended at top
      readyRef.current = container.scrollTop <= 0;

      if (!isPullingRef.current) return;
      isPullingRef.current = false;

      const distance = pullDistanceRef.current;
      pullDistanceRef.current = 0;

      if (distance >= THRESHOLD) {
        setRefreshing(true);
        const indicator = indicatorRef.current;
        const content = contentRef.current;
        if (indicator) {
          indicator.style.transform = "translateY(10px)";
          indicator.style.opacity = "1";
        }
        if (content) {
          content.style.transform = "translateY(50px)";
          content.style.transition = "transform 0.3s ease";
        }
        window.location.reload();
      } else {
        updateVisuals(0);
      }
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    container.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    container.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });

    // Initialize: if page starts at top, pull is ready
    readyRef.current = container.scrollTop <= 0;

    return () => {
      container.removeEventListener("scroll", handleScroll);
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [refreshing, updateVisuals]);

  return (
    <div ref={containerRef} className={cn("relative", className)} style={{ overscrollBehaviorY: "contain" }}>
      {/* Pull indicator */}
      <div
        ref={indicatorRef}
        className="absolute left-0 right-0 flex justify-center z-10 pointer-events-none"
        style={{ transform: "translateY(-40px)", opacity: 0 }}
      >
        <div className="bg-background border rounded-full p-2 shadow-md">
          <div ref={iconRef}>
            <RefreshCw
              className={cn(
                "h-5 w-5 text-muted-foreground",
                refreshing && "animate-spin",
              )}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div ref={contentRef} className="min-h-full">
        {children}
      </div>
    </div>
  );
}
