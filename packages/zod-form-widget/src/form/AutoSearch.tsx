import { previewReplacer } from './previewReplacer';
import { Suspense, useMemo, useEffect, useState, memo } from 'react';
import { Code, Loader, Stack } from '@mantine/core';
import {
  componentLibrary,
  Switch,
  FormProvider,
  ZodFormContextProvider,
  ValidatePrecedingFieldsProvider,
  FormRuntime,
  useZodForm,
  UnsupportedSchemaNotice
} from '@zodapp/zod-form-mantine';
import type { ExternalKeyResolvers, FileResolvers } from '@zodapp/zod-form';
import type { RegisteredResolverContext } from '@zodapp/zod-form/resolverContext/types';
import type {
  MediaResolvers,
  ValueActionResolver,
  CollectionReferenceActionEntry
} from '@zodapp/zod-form-react';
import type { z } from 'zod';
// Node の ESM から読めるように拡張子まで書く（lodash は exports を持たない）
import debounce from 'lodash/debounce.js';

type AutoSearchProps<T extends z.ZodTypeAny> = {
  schema: T;
  defaultValues?: z.input<T> | Partial<z.input<T>>;
  onChange?: (data: z.output<T>) => void;
  debounceMs?: number;
  showPreview?: boolean;
  externalKeyResolvers?: ExternalKeyResolvers;
  valueActionResolver?: ValueActionResolver;
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
  valueActionResolver,
  fileResolvers,
  mediaResolvers,
  resolverContext,
  collectionReferenceActions
}: AutoSearchProps<T>) => {
  const initialValues = useMemo(() => (defaultValues ?? {}) as z.input<T>, [defaultValues]);

  // validator は FormRuntime で包む。zod の文言を辞書のキー（zod.*）にし、
  // 実行時に決まる schema（zf.dynamic）の登録先でも検証する。
  // 包んだ validator は standard schema の形なので、TanStack Form 1.33 以降の
  // validators の型（RejectPromiseValidator<T>）にもそのまま渡せる。
  const [runtime] = useState(() => new FormRuntime());
  const validator = useMemo(() => runtime.wrapValidator<z.input<T>>(schema), [runtime, schema]);

  const form = useZodForm({
    defaultValues: initialValues,
    validators: {
      onChange: validator,
      onBlur: validator
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
        notFoundComponent={UnsupportedSchemaNotice}
        componentLibrary={componentLibrary}
        externalKeyResolvers={externalKeyResolvers}
        valueActionResolver={valueActionResolver}
        fileResolvers={fileResolvers}
        mediaResolvers={mediaResolvers}
        resolverContext={resolverContext}
        collectionReferenceActions={collectionReferenceActions}
      >
        <FormProvider form={form} runtime={runtime}>
          <ValidatePrecedingFieldsProvider>
            <Stack gap="md">
              <Switch fieldPath="" schema={schema} />

              {/* デモ・デバッグ用: リアクティブに現在の値を表示 */}
              {showPreview && (
                <Code block style={{ maxHeight: 200, overflow: 'auto' }}>
                  {JSON.stringify(
                    formValues,
                    previewReplacer,
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
