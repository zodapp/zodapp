import { Suspense, memo, useCallback, useEffect, useState } from "react";
import { Code, Loader, Stack } from "@mantine/core";
import {
  Dynamic,
  ZodFormContextProvider,
} from "@zodapp/zod-form-mantine";
import { reactiveComponentLibrary } from "@zodapp/zod-form-mantine/reactiveComponentLibrary";
import type { ExternalKeyResolvers } from "@zodapp/zod-form";
import type { z } from "zod";

import "./zod-errormap.ja";

/**
 * ドット区切りパス（tanstack 形式）でネストされた値を immutable に更新する。
 *
 * 例: setNestedValue({ a: { b: 1 } }, "a.b", 2) => { a: { b: 2 } }
 */
const setNestedValue = (
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> => {
  if (path === "") return value as Record<string, unknown>;

  const keys = path.split(".");
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
  showPreview?: boolean;
  externalKeyResolvers?: ExternalKeyResolvers;
};

const ReactiveAutoFormInner = <T extends z.ZodObject<z.ZodRawShape>>({
  schema,
  defaultValues,
  showPreview = false,
  externalKeyResolvers,
}: ReactiveAutoFormProps<T>) => {
  const [values, setValues] = useState<Record<string, unknown>>(
    () => (defaultValues ?? {}) as Record<string, unknown>,
  );

  useEffect(() => {
    setValues((defaultValues ?? {}) as Record<string, unknown>);
  }, [defaultValues]);

  const onFieldChange = useCallback(
    (fieldPath: string, value: unknown) => {
      setValues((prev) => setNestedValue(prev, fieldPath, value));
    },
    [],
  );

  return (
    <Suspense fallback={<Loader />}>
      <ZodFormContextProvider
        componentLibrary={reactiveComponentLibrary}
        externalKeyResolvers={externalKeyResolvers}
        onFieldChange={onFieldChange}
      >
        <Stack gap="md">
          <Dynamic
            fieldPath=""
            schema={schema}
            defaultValue={values as z.input<T>}
          />

          {showPreview && (
            <Code block style={{ maxHeight: 200, overflow: "auto" }}>
              {JSON.stringify(values, null, 2)}
            </Code>
          )}
        </Stack>
      </ZodFormContextProvider>
    </Suspense>
  );
};

export const ReactiveAutoForm = memo(
  ReactiveAutoFormInner,
) as typeof ReactiveAutoFormInner;
