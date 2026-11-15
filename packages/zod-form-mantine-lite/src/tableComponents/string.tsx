import { Text } from "@mantine/core";
import { ZodFormProps } from "@zodapp/zod-form-react";
import { useSchemaValueAction } from "@zodapp/zod-form-react/common";
import { getMeta } from "@zodapp/zod-form";
import z from "zod";
import { renderComputedValue } from "../utils/renderComputedValue";
import { normalizeStringSuggestions } from "../utils/stringSuggestions";

type StringSchema = z.ZodString;

const StringComponent = ({
  schema,
  defaultValue,
}: ZodFormProps<StringSchema>) => {
  const { formatter, uiType, suggestions } = getMeta(schema, "string") ?? {};
  const raw = typeof defaultValue === "string" ? defaultValue : null;
  const actionWrapper = useSchemaValueAction(schema, raw, false);

  if (raw && formatter) {
    return <>{renderComputedValue(formatter(raw), "table")}</>;
  }

  // uiType: "select" は suggestions のラベルで表示する（無ければ値のまま）
  const label =
    raw && uiType === "select"
      ? (normalizeStringSuggestions(suggestions).find(
          (option) => option.value === raw,
        )?.label ?? raw)
      : raw;

  const content = (
    <Text size="sm" c={label ? undefined : "dimmed"} lineClamp={1}>
      {label ?? "-"}
    </Text>
  );

  return raw && actionWrapper ? <>{actionWrapper(content)}</> : content;
};

export { StringComponent as component };
