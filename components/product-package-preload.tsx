"use client";

import { useEffect } from "react";
import { warmProductPackageMap } from "@/lib/product-package-cache";

export function ProductPackagePreload() {
  useEffect(() => {
    warmProductPackageMap();
  }, []);

  return null;
}
