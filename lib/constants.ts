/* =========================================================
   🏗️ Shared Constants & Helpers
   ========================================================= */

/** Branch display names */
export const BRANCH_LABELS: Record<number, string> = {
  1: "المعرض",
  2: "المخزن",
};

/** Get branch label by ID */
export function getBranchLabel(id: number): string {
  return BRANCH_LABELS[id] || "غير محدد";
}

/** Branch names used in dashboard header */
export const BRANCH_DISPLAY_NAMES: Record<number, string> = {
  1: "فرع القطاعي",
  2: "فرع الجملة",
};

/** Get branch display name for header */
export function getBranchDisplayName(id: number): string {
  return BRANCH_DISPLAY_NAMES[id] || "النظام";
}

/* =========================================================
   📦 Package parse helpers (shared across product dialogs)
   ========================================================= */

/** Parse wholesale package string: "كرتونة 3 دستة" → { qty: "3", type: "دستة" } */
export function parseWholesalePackage(value: string) {
  if (!value) return { qty: "", type: "" };
  const parts = value.split(" ");
  return { qty: parts[1] || "", type: parts[2] || "" };
}

/** Parse retail package string: "3,6 علبة" → { qty: "3", qty2: "6", type: "علبة" } */
export function parseRetailPackage(value: string) {
  if (!value) return { qty: "", qty2: "", type: "" };
  const parts = value.split(" ");
  const qtyPart = parts[0] || "";
  const type = parts[1] || "";
  if (qtyPart.includes(",")) {
    const [q1, q2] = qtyPart.split(",");
    return { qty: q1, qty2: q2, type };
  }
  return { qty: qtyPart, qty2: "", type };
}

/* =========================================================
   📅  Date helpers
   ========================================================= */

/** Get today's date as YYYY-MM-DD */
export function getTodayDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** Format date for Arabic display */
export function formatDateAr(date: string | Date): string {
  return new Date(date).toLocaleDateString("ar-EG");
}
