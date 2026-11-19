import { Button, Group, Text, Loader } from "@mantine/core";
import { getMeta } from "@zodapp/zod-form";
import { ZodFormProps } from "@zodapp/zod-form-react";
import {
  useExternalKeyAction,
  useExternalKeyOptions,
} from "@zodapp/zod-form-react/utils/externalKey";
import { externalKeyDisplayLabel } from "../utils/unlisted";
import type z from "zod";
import { useMsg } from "../messages/useMsg";
import { useUnlistedLabel } from "../utils/unlistedLabel";

type ExternalKeySchema = z.ZodString;

const ExternalKeyComponent = ({
  schema,
  defaultValue,
}: ZodFormProps<ExternalKeySchema>) => {
  const value = typeof defaultValue === "string" ? defaultValue : null;
  const { options, isLoading, retry } = useExternalKeyOptions(schema);
  const actionWrapper = useExternalKeyAction(schema, value, false);
  const msg = useMsg();
  const unlistedLabel = useUnlistedLabel();

  if (isLoading) {
    return <Loader size="xs" />;
  }

  // 取得に失敗したら、そのセルに再試行のボタンを出す
  if (retry) {
    return (
      <Group gap={4} wrap="nowrap" data-dynamic-status="error">
        <Text size="sm" c="dimmed">
          {msg(
            "zodFormMantineLite.fetchFailed" /* i18n: 取得できませんでした */,
          )}
        </Text>
        <Button
          size="compact-xs"
          variant="light"
          onClick={(event) => {
            // 行を押したときの動き（行を開くなど）を起こさない
            event.stopPropagation();
            retry();
          }}
        >
          {msg("zodFormMantineLite.retry" /* i18n: 再試行 */)}
        </Button>
      </Group>
    );
  }

  if (!value) {
    return (
      <Text size="sm" c="dimmed">
        -
      </Text>
    );
  }

  // 選択肢に無い値は、フォームの欄と同じく「（不正な値）」と出す（allowUnlisted なら値のまま）
  const allowUnlisted = getMeta(schema, "externalKey")?.allowUnlisted === true;
  const label = externalKeyDisplayLabel(
    options,
    value,
    allowUnlisted,
    unlistedLabel,
  );
  const content = (
    <Text size="sm" lineClamp={1}>
      {label}
    </Text>
  );

  return actionWrapper ? actionWrapper(content) : content;
};

export { ExternalKeyComponent as component };
