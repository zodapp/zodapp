export type NormalizedStringSuggestion = {
  label: string;
  value: string;
};

type StringSuggestion = string | NormalizedStringSuggestion;

export const normalizeStringSuggestions = (
  suggestions: readonly StringSuggestion[] | undefined,
): NormalizedStringSuggestion[] =>
  suggestions?.map((suggestion) =>
    typeof suggestion === "string"
      ? { label: suggestion, value: suggestion }
      : suggestion,
  ) ?? [];
