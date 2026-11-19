// テストの辞書（ESLint のルールが構文木だけを読む。実行はしない）
const defineMessages = <T>(m: T): T => m;

export const en = defineMessages({
  "test.title": "Title",
});

export const ja = {
  "test.title": "タイトル",
  "test.rowCount": ({ count }: { count: number }) => `${count} 件`,
  "test.block": ({ count }: { count: number }) => {
    return `全${count}件`;
  },
  "test.conditional": (p: { inclusive: string; minimum: string }) =>
    p.inclusive === "true" ? `${p.minimum}以上` : `${p.minimum}より大きい`,
  "test.multiline": "1行目\n2行目",
  "test.special": "a */ b \\ c",
  "test.empty": "",
} satisfies Record<string, unknown>;
