import { Suspense, useMemo, useState, useEffect, memo } from 'react';
import { Button, Code, Group, Loader, Stack } from '@mantine/core';
import {
  componentLibrary,
  Dynamic,
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

type AutoFormProps<T extends z.ZodTypeAny> = {
  schema: T;
  defaultValues?: z.input<T> | Partial<z.input<T>>;
  onSubmit?: (data: z.output<T>) => void;
  onCancel?: (data: z.input<T>) => void;
  isLoading?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  showPreview?: boolean;
  externalKeyResolvers?: ExternalKeyResolvers;
  externalKeyActionResolver?: ExternalKeyActionResolver;
  fileResolvers?: FileResolvers;
  mediaResolvers?: MediaResolvers;
  resolverContext?: RegisteredResolverContext;
  collectionReferenceActions?: readonly CollectionReferenceActionEntry[];
  readOnly?: boolean;
};

const AutoFormInner = <T extends z.ZodTypeAny>({
  schema,
  defaultValues,
  onSubmit,
  onCancel,
  isLoading = false,
  submitLabel = '保存',
  cancelLabel = 'キャンセル',
  showPreview = false,
  externalKeyResolvers,
  externalKeyActionResolver,
  fileResolvers,
  mediaResolvers,
  resolverContext,
  collectionReferenceActions,
  readOnly = false
}: AutoFormProps<T>) => {
  const initialValues = useMemo(() => (defaultValues ?? {}) as z.input<T>, [defaultValues]);

  const form = useZodForm({
    defaultValues: initialValues,
    validators: {
      onChange: schema,
      onBlur: schema,
      onSubmit: schema
    },
    onSubmit: ({ value }) => {
      if (onSubmit) {
        onSubmit(value as z.output<T>);
      }
    }
  });

  // デバッグ用: リアクティブに現在の値を購読
  const [formValues, setFormValues] = useState(() => form.state.values);
  useEffect(() => {
    if (!showPreview) return;
    const unsubscribe = form.store.subscribe(() => {
      setFormValues(form.state.values);
    });
    return () => unsubscribe();
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
              <Dynamic fieldPath="" schema={schema} readOnly={readOnly} />

              {!readOnly && (
                <Group justify="flex-end" mt="md">
                  {onCancel && (
                    <Button
                      variant="default"
                      onClick={() => onCancel(form.state.values)}
                      disabled={isLoading}
                    >
                      {cancelLabel}
                    </Button>
                  )}
                  <Button
                    onClick={async () => {
                      await form.handleSubmit();
                      console.log('form.state', form.state);
                      if (import.meta.env.NODE_ENV === 'development' && !form.state.isValid) {
                        console.warn('[AutoForm] バリデーションエラー:', form.getAllErrors());
                      }
                    }}
                    type="button"
                    loading={isLoading}
                  >
                    {submitLabel}
                  </Button>
                </Group>
              )}
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

export const AutoForm = memo(AutoFormInner) as typeof AutoFormInner;
