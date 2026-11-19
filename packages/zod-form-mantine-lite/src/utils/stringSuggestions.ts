export type NormalizedStringSuggestion = {
  label: string;
  value: string;
};

type StringSuggestion = string | NormalizedStringSuggestion;

/**
 * suggestions を `{ label, value }` にそろえる。
 * resolve を渡すと、`{ label, value }` の label を辞書で引き直す（文字列だけの候補は値なので訳さない）
 */
export const normalizeStringSuggestions = (
  suggestions: readonly StringSuggestion[] | undefined,
  resolve?: (text: string) => string,
): NormalizedStringSuggestion[] =>
  suggestions?.map((suggestion) =>
    typeof suggestion === "string"
      ? { label: suggestion, value: suggestion }
      : resolve
        ? { ...suggestion, label: resolve(suggestion.label) }
        : suggestion,
  ) ?? [];
