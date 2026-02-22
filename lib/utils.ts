import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Normalize Arabic characters for search (ى↔ي, أ/إ/آ→ا) */
export function normalizeArabic(s: string): string {
  return s.replace(/ى/g, "ي").replace(/[أإآ]/g, "ا");
}

/** Convert Arabic-Indic digits (٠-٩) and extended (۰-۹) to Western digits (0-9) */
export function toEnDigits(s: string): string {
  return s
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/** Remove all whitespace from a string (for space-insensitive search) */
export function noSpaces(s: string): string {
  return s.replace(/\s/g, "");
}

/** Normalize text for search: remove spaces, lowercase, normalize Arabic chars */
function searchNormalize(s: string): string {
  return normalizeArabic(noSpaces(s).toLowerCase());
}

/**
 * Multi-word search: splits the query by spaces and returns true
 * if EVERY word matches at least one of the provided fields.
 * e.g. "زجاجة وردة" → item must contain "زجاجة" AND "وردة" in any field.
 * Single word behaves the same as before.
 * Handles Arabic ي/ى and أ/إ/آ normalization automatically.
 */
export function multiWordMatch(
  query: string,
  ...fields: (string | undefined | null)[]
): boolean {
  const words = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => searchNormalize(w));

  if (words.length === 0) return true;

  // Concatenate all fields into one searchable string
  const combined = fields.map((f) => searchNormalize(f || "")).join(" ");

  // Every word must appear in at least one field
  return words.some((word) => combined.includes(word));
}

/**
 * Relevance score for search results (higher = better match).
 * Scoring logic:
 *   - Name exact match → highest priority
 *   - Barcode/other field exact match → very high priority
 *   - Name starts with a query word → high priority
 *   - Barcode/other field starts with a query word → medium-high priority
 *   - Name contains a query word → medium priority
 *   - Count of matched words across all fields → base score
 *   - More words matched → higher score
 * Handles Arabic ي/ى and أ/إ/آ normalization automatically.
 */
export function multiWordScore(
  query: string,
  name: string | undefined | null,
  ...otherFields: (string | undefined | null)[]
): number {
  const words = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => searchNormalize(w));

  if (words.length === 0) return 0;

  const nameLower = searchNormalize(name || "");
  const allFields = [name, ...otherFields];
  const combined = allFields.map((f) => searchNormalize(f || "")).join(" ");

  let score = 0;

  // Count how many query words match
  const matchedWords = words.filter((w) => combined.includes(w));
  score += matchedWords.length * 10;

  // Bonus for name matches (most important field)
  for (const w of words) {
    if (nameLower === w) {
      score += 100; // exact name match
    } else if (nameLower.startsWith(w)) {
      score += 50; // name starts with word
    } else if (nameLower.includes(w)) {
      score += 25; // name contains word
    }
  }

  // Bonus for other field matches (barcode, id, etc.)
  const otherNormalized = otherFields.map((f) => searchNormalize(f || ""));
  for (const fieldVal of otherNormalized) {
    if (!fieldVal) continue;
    for (const w of words) {
      if (fieldVal === w) {
        score += 80; // exact match on barcode/other field
      } else if (fieldVal.startsWith(w)) {
        score += 30; // starts with on barcode/other field
      }
    }
  }

  // Bonus if ALL words matched (not just some)
  if (matchedWords.length === words.length) {
    score += 30;
  }

  return score;
}
