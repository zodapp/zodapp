/**
 * デモページの「動きを試す」の枠。
 * 遅延の分け方・取得を失敗させるスイッチ・選択肢を届け直すボタンなど、
 * フォームの外から動きを起こす操作をここにまとめ、フォームの欄と見分けられるようにする
 */
import type { ReactNode } from "react";
import { Fieldset, Stack, Text } from "@mantine/core";
import { useMsg } from "@zodapp/i18n-messages-react";

const ResolvedText = ({ text }: { text: string }) => {
  const msg = useMsg();
  return <>{msg.resolve(text)}</>;
};

const TryBehaviorLegend = () => {
  const msg = useMsg();
  return (
    <>{msg("formDemo.shared.tryBehavior.legend" /* i18n: 動きを試す */)}</>
  );
};

export const TryBehavior = ({
  description,
  children,
}: {
  /** 何を試せるか（人が読む説明） */
  description?: ReactNode;
  children: ReactNode;
}) => (
  <Fieldset legend={<TryBehaviorLegend />} data-testid="try-behavior">
    <Stack gap="sm">
      {description && (
        <Text size="sm" c="dimmed">
          {typeof description === "string" ? (
            <ResolvedText text={description} />
          ) : (
            description
          )}
        </Text>
      )}
      {children}
    </Stack>
  </Fieldset>
);
