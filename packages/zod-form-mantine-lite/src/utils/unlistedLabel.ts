import { useMsg } from "../messages/useMsg";

/**
 * 値が選択肢に無いときに、ID などの生の値の代わりに出す文言（「（不正な値）」）。
 * フォームの欄と表のセルで同じ文言にする
 */
export const useUnlistedLabel = (): string =>
  useMsg()("zodFormMantineLite.unlisted" /* i18n: （不正な値） */);
