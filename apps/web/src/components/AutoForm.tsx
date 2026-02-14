import { Suspense, useMemo, memo } from "react";
import { Button, Code, Group, Loader, Stack } from "@mantine/core";
import {
  componentLibrary,
  Dynamic,
  FormProvider,
  ZodFormContextProvider,
  ValidatePrecedingFieldsProvider,
  useZodForm,
} from "@zodapp/zod-form-mantine";
import type { ExternalKeyResolvers, FileResolvers } from "@zodapp/zod-form";
import type { MediaResolvers } from "@zodapp/zod-form-react";
import type { z } from "zod";

import "./zod-errormap.ja";

type AutoFormProps<T extends z.ZodObject<z.ZodRawShape>> = {
  schema: T;
  defaultValues?: Partial<z.input<T>>;
  onSubmit?: (data: z.output<T>) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  showPreview?: boolean;
  externalKeyResolvers?: ExternalKeyResolvers;
  fileResolvers?: FileResolvers;
  mediaResolvers?: MediaResolvers;
};

const AutoFormInner = <T extends z.ZodObject<z.ZodRawShape>>({
  schema,
  defaultValues,
  onSubmit,
  onCancel,
  isLoading = false,
  submitLabel = "保存",
  cancelLabel = "キャンセル",
  showPreview = false,
  externalKeyResolvers,
  fileResolvers,
  mediaResolvers,
}: AutoFormProps<T>) => {
  const initialValues = useMemo(
    () => (defaultValues ?? {}) as z.input<T>,
    [defaultValues],
  );

  const form = useZodForm({
    defaultValues: initialValues,
    validators: {
      onChange: schema,
      onBlur: schema,
      onSubmit: schema,
    },
    onSubmit: ({ value }) => {
      if (onSubmit) {
        onSubmit(value as z.output<T>);
      }
    },
  });

  return (
    <Suspense fallback={<Loader />}>
      <ZodFormContextProvider
        componentLibrary={componentLibrary}
        externalKeyResolvers={externalKeyResolvers}
        fileResolvers={fileResolvers}
        mediaResolvers={mediaResolvers}
      >
        <FormProvider form={form}>
          <ValidatePrecedingFieldsProvider>
            <Stack gap="md">
              <Dynamic fieldPath="" schema={schema} />

              <Group justify="flex-end" mt="md">
                {onCancel && (
                  <Button
                    variant="default"
                    onClick={onCancel}
                    disabled={isLoading}
                  >
                    {cancelLabel}
                  </Button>
                )}
                <Button
                  onClick={async () => {
                    await form.handleSubmit();
                    if (
                      import.meta.env.NODE_ENV === "development" &&
                      !form.state.isValid
                    ) {
                      console.warn(
                        "[AutoForm] バリデーションエラー:",
                        form.getAllErrors(),
                      );
                    }
                  }}
                  type="button"
                  loading={isLoading}
                >
                  {submitLabel}
                </Button>
              </Group>
              {/* デモ・デバッグ用: リアクティブに現在の値を表示 */}
              {showPreview && (
                <form.Subscribe selector={(state) => state.values}>
                  {(values) => (
                    <Code block style={{ maxHeight: 200, overflow: "auto" }}>
                      {JSON.stringify(
                        values,
                        (_key, value) => {
                          if (typeof value === "bigint") {
                            return value.toString();
                          }
                          return value;
                        },
                        2,
                      )}
                    </Code>
                  )}
                </form.Subscribe>
              )}
            </Stack>
          </ValidatePrecedingFieldsProvider>
        </FormProvider>
      </ZodFormContextProvider>
    </Suspense>
  );
};

export const AutoForm = memo(AutoFormInner) as typeof AutoFormInner;
