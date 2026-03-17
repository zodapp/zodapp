import { Text, Loader } from "@mantine/core";
import { ZodFormProps } from "@zodapp/zod-form-react";
import {
  useExternalKeyAction,
  useExternalKeyOptions,
} from "@zodapp/zod-form-react/utils/externalKey";
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

  const label = options?.find((o) => o.value === value)?.label ?? value;
  const content = (
    <Text size="sm" lineClamp={1}>
      {label}
    </Text>
  );

  return actionWrapper ? actionWrapper(content) : content;
};

export { ExternalKeyComponent as component };
