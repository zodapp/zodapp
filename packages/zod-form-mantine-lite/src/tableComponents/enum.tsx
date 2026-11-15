import { Badge } from "@mantine/core";
import { ZodFormProps } from "@zodapp/zod-form-react";
import { zf, getMeta } from "@zodapp/zod-form";
import { useSchemaValueAction } from "@zodapp/zod-form-react/common";
import { UNLISTED_LABEL, isEnumValueListed } from "../utils/unlisted";

type EnumSchema = ReturnType<typeof zf.enum>;

const EnumComponent = ({ schema, defaultValue }: ZodFormProps<EnumSchema>) => {
  const { schemas } = getMeta(schema) ?? {};
  const value = defaultValue as string | number | undefined;
  const actionWrapper = useSchemaValueAction(
    schema,
    value === undefined || value === null ? null : String(value),
    false,
  );

  if (value === undefined || value === null) {
    return null;
  }

  // 選択肢に無い値は、フォームの欄と同じく「（不正な値）」と出す（生の値は見せない）
  if (!isEnumValueListed(schema, value)) {
    return (
      <Badge color="red" variant="light">
        {UNLISTED_LABEL}
      </Badge>
    );
  }

  const key = String(value);
  const literalMeta = schemas?.[key] ? getMeta(schemas[key]) : null;
  const label = literalMeta?.label ?? key;
  const color = literalMeta?.color ?? "gray";

  const content = (
    <Badge color={color} variant="light">
      {label}
    </Badge>
  );
  return actionWrapper ? <>{actionWrapper(content)}</> : content;
};

export { EnumComponent as component };
