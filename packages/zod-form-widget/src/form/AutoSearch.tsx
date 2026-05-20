import { Suspense, useMemo, useEffect, useState, memo } from 'react';
import { Code, Loader, Stack } from '@mantine/core';
import {
  componentLibrary,
  Switch,
  FormProvider,
  ZodFormContextProvider,
  ValidatePrecedingFieldsProvider,
  useZodForm
} from '@zodapp/zod-form-mantine';
import type { ExternalKeyResolvers, FileResolvers } from '@zodapp/zod-form';
import type { RegisteredResolverContext } from '@zodapp/zod-form/resolverContext/types';
import type {
  MediaResolvers,
  ExternalKeyActionResolver,
  CollectionReferenceActionEntry
} from '@zodapp/zod-form-react';
import type { z } from 'zod';
import debounce from 'lodash/debounce';

type AutoSearchProps<T extends z.ZodTypeAny> = {
  schema: T;
  defaultValues?: z.input<T> | Partial<z.input<T>>;
  onChange?: (data: z.output<T>) => void;
  debounceMs?: number;
  showPreview?: boolean;
  externalKeyResolvers?: ExternalKeyResolvers;
  externalKeyActionResolver?: ExternalKeyActionResolver;
  fileResolvers?: FileResolvers;
  mediaResolvers?: MediaResolvers;
  resolverContext?: RegisteredResolverContext;
  collectionReferenceActions?: readonly CollectionReferenceActionEntry[];
};

const AutoSearchInner = <T extends z.ZodTypeAny>({
  schema,
  defaultValues,
  onChange,
  debounceMs = 100,
  showPreview = false,
  externalKeyResolvers,
  externalKeyActionResolver,
  fileResolvers,
  mediaResolvers,
  resolverContext,
  collectionReferenceActions
}: AutoSearchProps<T>) => {
  const initialValues = useMemo(() => (defaultValues ?? {}) as z.input<T>, [defaultValues]);

  const form = useZodForm({
    defaultValues: initialValues,
    validators: {
      onChange: schema,
      onBlur: schema
    }
  });

  // debounce化したonChange関数
  const debouncedOnChange = useMemo(
    () => (onChange ? debounce(onChange, debounceMs) : undefined),
    [onChange, debounceMs]
  );

  // form.store.subscribeで値の変更を監視
  useEffect(() => {
    if (!debouncedOnChange) return;

    const subscription = form.store.subscribe(() => {
      debouncedOnChange(form.state.values as z.output<T>);
    });

    return () => {
      subscription.unsubscribe();
      debouncedOnChange.cancel();
    };
  }, [form, debouncedOnChange]);

  // デバッグ用: リアクティブに現在の値を購読
  const [formValues, setFormValues] = useState(() => form.state.values);
  useEffect(() => {
    if (!showPreview) return;
    const subscription = form.store.subscribe(() => {
      setFormValues(form.state.values);
    });
    return () => subscription.unsubscribe();
  }, [form, showPreview]);

  return (
    <Suspense fallback={<Loader />}>
      <ZodFormContextProvider
        componentLibrary={componentLibrary}
        externalKeyResolvers={externalKeyResolvers}
        externalKeyActionResolver={externalKeyActionResolver}
        fileResolvers={fileResolvers}
        mediaResolvers={mediaResolvers}
        resolverContext={resolverContext}
        collectionReferenceActions={collectionReferenceActions}
      >
        <FormProvider form={form}>
          <ValidatePrecedingFieldsProvider>
            <Stack gap="md">
              <Switch fieldPath="" schema={schema} />

              {/* デモ・デバッグ用: リアクティブに現在の値を表示 */}
              {showPreview && (
                <Code block style={{ maxHeight: 200, overflow: 'auto' }}>
                  {JSON.stringify(
                    formValues,
                    (_key, value) => {
                      if (typeof value === 'bigint') {
                        return value.toString();
                      }
                      return value;
                    },
                    2
                  )}
                </Code>
              )}
            </Stack>
          </ValidatePrecedingFieldsProvider>
        </FormProvider>
      </ZodFormContextProvider>
    </Suspense>
  );
};

export const AutoSearch = memo(AutoSearchInner) as typeof AutoSearchInner;
