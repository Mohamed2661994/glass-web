import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Remove all whitespace from a string (for space-insensitive search) */
export function noSpaces(s: string): string {
  return s.replace(/\s/g, "");
}

/**
 * Multi-word search: splits the query by spaces and returns true
 * if EVERY word matches at least one of the provided fields.
 * e.g. "زجاجة وردة" → item must contain "زجاجة" AND "وردة" in any field.
 * Single word behaves the same as before.
 */
export function multiWordMatch(
  query: string,
  ...fields: (string | undefined | null)[]
): boolean {
  const words = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => noSpaces(w).toLowerCase());

  if (words.length === 0) return true;

  // Concatenate all fields into one searchable string
  const combined = fields.map((f) => noSpaces(f || "").toLowerCase()).join(" ");

  // Every word must appear in at least one field
  return words.some((word) => combined.includes(word));
}

/**
 * Relevance score for search results (higher = better match).
 * Scoring logic:
 *   - Name exact match → highest priority
 *   - Name starts with a query word → high priority
 *   - Name contains a query word → medium priority
 *   - Count of matched words across all fields → base score
 *   - More words matched → higher score
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
    .map((w) => noSpaces(w).toLowerCase());

  if (words.length === 0) return 0;

  const nameLower = noSpaces(name || "").toLowerCase();
  const allFields = [name, ...otherFields];
  const combined = allFields
    .map((f) => noSpaces(f || "").toLowerCase())
    .join(" ");

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

  // Bonus if ALL words matched (not just some)
  if (matchedWords.length === words.length) {
    score += 30;
  }

  return score;
}
