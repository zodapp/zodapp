import { Suspense, memo, useCallback, useEffect, useState } from 'react';
import { Code, LoadingOverlay, Loader, Stack } from '@mantine/core';
import { Switch, ZodFormContextProvider } from '@zodapp/zod-form-mantine';
import type { ExternalKeyResolvers, FileResolvers } from '@zodapp/zod-form';
import type { RegisteredResolverContext } from '@zodapp/zod-form/resolverContext/types';
import type {
  MediaResolvers,
  ExternalKeyActionResolver,
  CollectionReferenceActionEntry
} from '@zodapp/zod-form-react';
import type { z } from 'zod';

/**
 * ドット区切りパスでネストされた値を immutable に更新する。
 *
 * 例: setNestedValue({ a: { b: 1 } }, "a.b", 2) => { a: { b: 2 } }
 */
export const setNestedValue = (
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> => {
  if (path === '') return value as Record<string, unknown>;

  const keys = path.split('.');
  const result = { ...obj };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = result;

  for (let i = 0; i < keys.length - 1; i++) {
    current[keys[i]!] = { ...current[keys[i]!] };
    current = current[keys[i]!];
  }

  current[keys[keys.length - 1]!] = value;
  return result;
};

type ReactiveAutoFormProps<T extends z.ZodObject<z.ZodRawShape>> = {
  schema: T;
  defaultValues?: Partial<z.input<T>>;
  /**
   * フィールド値の確定時に呼ばれるコールバック。
   * 親側で Firestore への保存等を行う。
   * 内部では楽観更新で即座に UI に反映し、次の defaultValues 変更で正式に同期される。
   */
  onFieldChange?: (fieldPath: string, value: unknown) => void;
  isLoading?: boolean;
  showPreview?: boolean;
  externalKeyResolvers?: ExternalKeyResolvers;
  externalKeyActionResolver?: ExternalKeyActionResolver;
  fileResolvers?: FileResolvers;
  mediaResolvers?: MediaResolvers;
  resolverContext?: RegisteredResolverContext;
  collectionReferenceActions?: readonly CollectionReferenceActionEntry[];
  readOnly?: boolean;
};

const ReactiveAutoFormInner = <T extends z.ZodObject<z.ZodRawShape>>({
  schema,
  defaultValues,
  onFieldChange,
  isLoading = false,
  showPreview = false,
  externalKeyResolvers,
  externalKeyActionResolver,
  fileResolvers,
  mediaResolvers,
  resolverContext,
  collectionReferenceActions,
  readOnly = false
}: ReactiveAutoFormProps<T>) => {
  const [values, setValues] = useState<Record<string, unknown>>(
    () => (defaultValues ?? {}) as Record<string, unknown>
  );

  // 外部からの defaultValues 変更（Firestoreリスナー等）を反映
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 外部 defaultValues の変更を内部の楽観更新 state に同期する
    setValues((defaultValues ?? {}) as Record<string, unknown>);
  }, [defaultValues]);

  const handleFieldChange = useCallback(
    (fieldPath: string, value: unknown) => {
      // 楽観更新: 内部stateを即座に反映
      setValues((prev) => setNestedValue(prev, fieldPath, value));
      // 親に通知（Firestore保存用）
      onFieldChange?.(fieldPath, value);
    },
    [onFieldChange]
  );

  return (
    <Suspense fallback={<Loader />}>
      <LoadingOverlay visible={isLoading} />
      <ZodFormContextProvider
        merge
        externalKeyResolvers={externalKeyResolvers}
        externalKeyActionResolver={externalKeyActionResolver}
        fileResolvers={fileResolvers}
        mediaResolvers={mediaResolvers}
        resolverContext={resolverContext}
        collectionReferenceActions={collectionReferenceActions}
        onFieldChange={handleFieldChange}
      >
        <Stack gap="md">
          <Switch
            fieldPath=""
            schema={schema}
            defaultValue={values as z.input<T>}
            readOnly={readOnly}
          />

          {showPreview && (
            <Code block style={{ maxHeight: 200, overflow: 'auto' }}>
              {JSON.stringify(
                values,
                (_key, v) => {
                  if (typeof v === 'bigint') {
                    return v.toString();
                  }
                  return v;
                },
                2
              )}
            </Code>
          )}
        </Stack>
      </ZodFormContextProvider>
    </Suspense>
  );
};

export const ReactiveAutoForm = memo(ReactiveAutoFormInner) as typeof ReactiveAutoFormInner;
