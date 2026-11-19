import { Badge } from "@mantine/core";
import { ZodFormProps } from "@zodapp/zod-form-react";
import { zf } from "@zodapp/zod-form";
import { useSchemaValueAction } from "@zodapp/zod-form-react/common";
import { enumOptionDataOf } from "../utils/enum";
import { useUnlistedLabel } from "../utils/unlistedLabel";
import { useResolveText } from "@zodapp/zod-form-react/common";

type EnumSchema = ReturnType<typeof zf.enum>;

const EnumComponent = ({ schema, defaultValue }: ZodFormProps<EnumSchema>) => {
  const value = defaultValue as string | number | undefined;
  const actionWrapper = useSchemaValueAction(
    schema,
    value === undefined || value === null ? null : String(value),
    false,
  );
  const unlistedLabel = useUnlistedLabel();
  const resolveText = useResolveText();

  if (value === undefined || value === null) {
    return null;
  }

  const option = enumOptionDataOf(schema, value);
  // 選択肢に無い値は、フォームの欄と同じく「（不正な値）」と出す（生の値は見せない）
  if (!option) {
    return (
      <Badge color="red" variant="light">
        {unlistedLabel}
      </Badge>
    );
  }

  const label = resolveText(option.label) ?? option.label;
  const color = option.color ?? "gray";

  const content = (
    <Badge color={color} variant="light">
      {label}
    </Badge>
  );
  return actionWrapper ? <>{actionWrapper(content)}</> : content;
};

export { EnumComponent as component };
