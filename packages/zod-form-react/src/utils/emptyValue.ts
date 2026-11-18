/**
 * 欄を空にするときに書く値。optional なら undefined、nullable だけなら null。
 * 両方（`.optional().nullable()` など）のときは undefined を優先する。
 * どちらでもない（必須の）欄は undefined を書き、「必須」のエラーにする
 */
export const emptyValueOf = ({
  optional,
  nullable,
}: {
  optional?: boolean | undefined;
  nullable?: boolean | undefined;
}): undefined | null => (optional ? undefined : nullable ? null : undefined);
