import React from "react";

/**
 * Highlights occurrences of `query` within `text`.
 * Returns a React node with <mark> tags around matched parts.
 * If query is empty, returns the text as-is.
 */
export function highlightText(
  text: string | number | null | undefined,
  query: string,
): React.ReactNode {
  if (!text && text !== 0) return "-";
  const str = String(text);
  if (!query || !query.trim()) return str;

  const q = query.trim().toLowerCase();
  const lowerStr = str.toLowerCase();
  const idx = lowerStr.indexOf(q);

  if (idx === -1) return str;

  const before = str.slice(0, idx);
  const match = str.slice(idx, idx + q.length);
  const after = str.slice(idx + q.length);

  return (
    <>
      {before}
      <mark className="bg-yellow-200 dark:bg-yellow-700 rounded-sm px-0.5">
        {match}
      </mark>
      {after}
    </>
  );
}
