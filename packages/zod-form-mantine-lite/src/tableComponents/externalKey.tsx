import { Text, Loader } from "@mantine/core";
import { getMeta } from "@zodapp/zod-form";
import { ZodFormProps } from "@zodapp/zod-form-react";
import {
  useExternalKeyAction,
  useExternalKeyOptions,
} from "@zodapp/zod-form-react/utils/externalKey";
import { externalKeyDisplayLabel } from "../utils/unlisted";
import type z from "zod";

type ExternalKeySchema = z.ZodString;

const ExternalKeyComponent = ({
  schema,
  defaultValue,
}: ZodFormProps<ExternalKeySchema>) => {
  const value = typeof defaultValue === "string" ? defaultValue : null;
  const { options, isLoading } = useExternalKeyOptions(schema);
  const actionWrapper = useExternalKeyAction(schema, value, false);

  if (isLoading) {
    return <Loader size="xs" />;
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
  const label = externalKeyDisplayLabel(options, value, allowUnlisted);
  const content = (
    <Text size="sm" lineClamp={1}>
      {label}
    </Text>
  );

  return actionWrapper ? actionWrapper(content) : content;
};

export { ExternalKeyComponent as component };
