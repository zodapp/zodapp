import { Suspense, useMemo, useEffect, memo } from "react";
import { Code, Loader, Stack } from "@mantine/core";
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
import debounce from "lodash/debounce";

import "./zod-errormap.ja";

type AutoSearchProps<T extends z.ZodObject<z.ZodRawShape>> = {
  schema: T;
  defaultValues?: Partial<z.input<T>>;
  onChange?: (data: z.output<T>) => void;
  debounceMs?: number;
  showPreview?: boolean;
  externalKeyResolvers?: ExternalKeyResolvers;
  fileResolvers?: FileResolvers;
  mediaResolvers?: MediaResolvers;
};

const AutoSearchInner = <T extends z.ZodObject<z.ZodRawShape>>({
  schema,
  defaultValues,
  onChange,
  debounceMs = 100,
  showPreview = false,
  externalKeyResolvers,
  fileResolvers,
  mediaResolvers,
}: AutoSearchProps<T>) => {
  const initialValues = useMemo(
    () => (defaultValues ?? {}) as z.input<T>,
    [defaultValues],
  );

  const form = useZodForm({
    defaultValues: initialValues,
    validators: {
      onChange: schema,
      onBlur: schema,
    },
  });

  // debounce化したonChange関数
  const debouncedOnChange = useMemo(
    () => (onChange ? debounce(onChange, debounceMs) : undefined),
    [onChange, debounceMs],
  );

  // form.store.subscribeで値の変更を監視
  useEffect(() => {
    if (!debouncedOnChange) return;

    const unsubscribe = form.store.subscribe(() => {
      debouncedOnChange(form.state.values as z.output<T>);
    });

    return () => {
      unsubscribe();
      debouncedOnChange.cancel();
    };
  }, [form, debouncedOnChange]);

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

export const AutoSearch = memo(AutoSearchInner) as typeof AutoSearchInner;
