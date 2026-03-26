import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Fieldset, Select, InputWrapper } from "@mantine/core";
import z from "zod";

import {
  ZodFormInternalProps,
  wrapComponent,
  Dynamic,
  useValidatePrecedingFields,
  getDefaultValue,
  useZodFormContext,
  useFormValues,
} from "@zodapp/zod-form-react/common";
import { getMeta } from "@zodapp/zod-form";
import { $ZodDiscriminatedUnionDef } from "zod/v4/core";
import { Suspense } from "react";
import { ReadonlyText, inputWrapperStyle } from "@zodapp/zod-form-mantine-lite/utils";

type UnionSchema = z.ZodUnion<[z.ZodTypeAny, ...z.ZodTypeAny[]]>;

const normalizeValue = (schema: z.ZodTypeAny, value: unknown) => {
  const parsed = schema.safeParse(value);
  if (parsed.success) return parsed.data;
  try {
    return getDefaultValue(schema);
  } catch {
    return undefined;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const isDiscriminatedUnion = (
  schema: z.ZodUnion,
): schema is z.ZodDiscriminatedUnion => {
  return (schema.def as $ZodDiscriminatedUnionDef).discriminator !== undefined;
};

/**
 * discriminatedUnion の arm から、指定した discriminator の literal 値を解決する。
 * arm が ZodObject なら shape から直接取り、arm 自体が nested discriminatedUnion なら
 * 全 leaf を traverse して一意な値であることを検証する。
 */
const resolveArmDiscriminatorValue = (
  armSchema: z.ZodTypeAny,
  discriminator: string,
): string => {
  if (armSchema instanceof z.ZodObject) {
    const field = (armSchema as z.ZodObject<z.ZodRawShape>).shape[
      discriminator
    ];
    if (!(field instanceof z.ZodLiteral) || typeof field.value !== "string") {
      throw new Error(
        `discriminatedUnion arm must have a string literal for "${discriminator}"`,
      );
    }
    return field.value;
  }

  if (
    armSchema instanceof z.ZodUnion &&
    isDiscriminatedUnion(armSchema as z.ZodUnion)
  ) {
    const innerOptions = armSchema.def.options as z.ZodTypeAny[];
    const values = innerOptions.map((child) =>
      resolveArmDiscriminatorValue(child, discriminator),
    );
    const unique = [...new Set(values)];
    if (unique.length !== 1) {
      throw new Error(
        `nested discriminatedUnion arm must resolve exactly one value for "${discriminator}", got: ${unique.join(", ")}`,
      );
    }
    return unique[0]!;
  }

  throw new Error(
    `unsupported discriminatedUnion arm schema type for discriminator "${discriminator}"`,
  );
};

type schemaProfile = {
  schema: z.ZodTypeAny | undefined;
  label: string;
  value: string;
  index: number;
};

/**
 * root/nested で異なるフォーム値の取得・更新方法を抽象化する。
 *
 * root (fieldPath === ""): フォーム全体の値を直接扱う
 * nested (fieldPath !== ""): 特定フィールドパスを通じて値を扱う
 */
type ValueAccessor = {
  getValue: () => unknown;
  setValue: (next: unknown, opts?: { dontValidate?: boolean }) => void;
  toAbsolutePath: (relative: readonly string[]) => string;
};

const useValueAccessor = (
  fieldPath: string,
  field: ZodFormInternalProps<UnionSchema>["field"],
): ValueAccessor => {
  const isRoot = fieldPath === "";

  return useMemo((): ValueAccessor => {
    if (isRoot) {
      return {
        getValue: () => field.api.form.state.values,
        setValue: (next, opts) => {
          if (opts?.dontValidate) {
            const current = field.api.form.state.values;
            const merged = isRecord(current) && isRecord(next)
              ? { ...current, ...next }
              : next;
            Object.entries(merged as Record<string, unknown>).forEach(
              ([key, val]) => {
                field.api.form.setFieldValue(key, val as never, {
                  dontValidate: true,
                });
              },
            );
          } else {
            field.api.handleChange(next);
          }
        },
        toAbsolutePath: (relative) =>
          relative.filter(Boolean).join("."),
      };
    }

    return {
      getValue: () => field.api.form.getFieldValue(fieldPath),
      setValue: (next, opts) => {
        if (opts?.dontValidate) {
          field.api.form.setFieldValue(fieldPath, next as never, {
            dontValidate: true,
          });
        } else {
          field.api.handleChange(next);
        }
      },
      toAbsolutePath: (relative) =>
        [fieldPath, ...relative].filter(Boolean).join("."),
    };
  }, [isRoot, fieldPath, field.api]);
};

/**
 * root 用: useFormValues で購読してフォーム全体の値をリアクティブに取得する。
 */
const UnionRootValueProvider = React.memo(function UnionRootValueProvider({
  children,
}: {
  children: (formValue: unknown) => React.ReactNode;
}) {
  const formValues = useFormValues();
  return <>{children(formValues)}</>;
});

/**
 * nested 用: field.api からフィールド値を取得する（wrapComponent の購読で十分）。
 */
const UnionNestedValueProvider = React.memo(function UnionNestedValueProvider({
  fieldPath,
  field,
  children,
}: {
  fieldPath: string;
  field: ZodFormInternalProps<UnionSchema>["field"];
  children: (formValue: unknown) => React.ReactNode;
}) {
  const formValue = field.api.form.getFieldValue(fieldPath);
  return <>{children(formValue)}</>;
});

/**
 * Union の本体ロジック。root/nested 共通で使う。
 */
const UnionBody = React.memo(function UnionBody({
  fieldPath,
  schema,
  required,
  readOnly,
  label,
  selectorLabel,
  field,
  error,
  formValue,
  accessor,
}: {
  fieldPath: string;
  schema: UnionSchema;
  required: boolean | undefined;
  readOnly: boolean | undefined;
  label: string | undefined;
  selectorLabel: string | undefined;
  field: ZodFormInternalProps<UnionSchema>["field"];
  error: ZodFormInternalProps<UnionSchema>["error"];
  formValue: unknown;
  accessor: ValueAccessor;
}) {
  const { loadingComponent: LoadingComponent } = useZodFormContext();
  const { onFocus, ref } = useValidatePrecedingFields(field);

  const compiledOptions: {
    profiles: schemaProfile[];
    determinator: (value: unknown) => schemaProfile | undefined;
    selector: (id: string) => schemaProfile | undefined;
    hasDiscriminator: boolean;
    discriminator?: string;
  } = useMemo(() => {
    const optionSchemas = schema.def.options as z.ZodTypeAny[];
    if (isDiscriminatedUnion(schema)) {
      const discriminator = schema.def.discriminator;
      const profileMap = new Map(
        optionSchemas.map((optionSchema, index) => {
          const key = resolveArmDiscriminatorValue(
            optionSchema,
            discriminator,
          );
          return [
            key,
            {
              schema: optionSchema,
              label: getMeta(optionSchema)?.label ?? ` ${index + 1}`,
              value: key,
              index,
            } satisfies schemaProfile,
          ] as const;
        }),
      );
      const profiles = Array.from(profileMap.values());

      return {
        profiles,
        determinator: (value: unknown) =>
          profileMap.get(
            (value as Record<string, unknown>)?.[discriminator] as string,
          ),
        selector: (id: string) => profileMap.get(id),
        hasDiscriminator: true,
        discriminator,
      };
    } else {
      const profileMap = new Map(
        optionSchemas.map((optionSchema, index) => {
          const key = `${index}` as string;
          return [
            key,
            {
              schema: optionSchema,
              label: getMeta(optionSchema)?.label ?? ` ${index + 1}`,
              value: key,
              index,
            } satisfies schemaProfile,
          ] as const;
        }),
      );
      const profiles = Array.from(profileMap.values());
      return {
        profiles,
        determinator: (value: unknown) =>
          profiles.find((profile) => profile.schema.safeParse(value).success),
        selector: (id: string) => profileMap.get(id),
        hasDiscriminator: false,
        discriminator: undefined,
      };
    }
  }, [schema]);

  const discriminatorFromValue = useMemo(() => {
    if (!compiledOptions.hasDiscriminator || !compiledOptions.discriminator) {
      return undefined;
    }
    if (!isRecord(formValue)) {
      return undefined;
    }
    const value = formValue[compiledOptions.discriminator];
    return typeof value === "string" ? value : undefined;
  }, [compiledOptions, formValue]);

  const [selectedDiscriminator, setSelectedDiscriminator] = useState<
    string | undefined
  >(discriminatorFromValue);

  useEffect(() => {
    if (!compiledOptions.hasDiscriminator) {
      if (selectedDiscriminator !== undefined) {
        setSelectedDiscriminator(undefined);
      }
      return;
    }
    if (
      discriminatorFromValue !== undefined &&
      discriminatorFromValue !== selectedDiscriminator
    ) {
      setSelectedDiscriminator(discriminatorFromValue);
    }
  }, [
    compiledOptions.hasDiscriminator,
    discriminatorFromValue,
    selectedDiscriminator,
  ]);

  const selectedProfile = useMemo(
    () =>
      compiledOptions.hasDiscriminator
        ? compiledOptions.selector(
            selectedDiscriminator ?? discriminatorFromValue ?? "",
          ) ?? compiledOptions.determinator(formValue)
        : compiledOptions.determinator(formValue),
    [
      compiledOptions,
      discriminatorFromValue,
      formValue,
      selectedDiscriminator,
    ],
  );

  const dynamicDefaultValue = useMemo(() => {
    if (
      !compiledOptions.hasDiscriminator ||
      !compiledOptions.discriminator ||
      !selectedDiscriminator
    ) {
      return formValue;
    }
    if (!isRecord(formValue)) {
      return {
        [compiledOptions.discriminator]: selectedDiscriminator,
      };
    }
    return {
      ...formValue,
      [compiledOptions.discriminator]: selectedDiscriminator,
    };
  }, [compiledOptions, formValue, selectedDiscriminator]);

  const prevInjectedRef = useRef<string[]>([]);

  const unionError =
    error && (error as any).code === "invalid_union"
      ? (error as any)
      : undefined;

  const optionIssues =
    unionError && selectedProfile
      ? unionError.errors?.[selectedProfile.index]
      : undefined;

  useEffect(() => {
    const redistributeIssues = (issues: any[] | undefined) => {
      const touched = new Set<string>();

      issues?.forEach((iss) => {
        const name = accessor.toAbsolutePath(
          (iss.path ?? []) as string[],
        );
        if (!name) return;
        touched.add(name);

        field.api.form.setFieldMeta(name, (meta: any) => {
          const nextErrors = [{ message: iss.message, type: iss.code }];
          if (
            Array.isArray(meta?.errors) &&
            meta.errors.length === 1 &&
            meta.errors[0]?.message === iss.message &&
            meta.errors[0]?.type === iss.code
          ) {
            return meta;
          }
          return {
            ...meta,
            errors: nextErrors,
            errorMap: { ...(meta?.errorMap ?? {}), onBlur: nextErrors },
          };
        });
      });

      prevInjectedRef.current
        .filter((p) => !touched.has(p))
        .forEach((p) =>
          field.api.form.setFieldMeta(p, (meta: any) => ({
            ...meta,
            errors: undefined,
            errorMap: { ...(meta?.errorMap ?? {}), onBlur: undefined },
          })),
        );

      prevInjectedRef.current = Array.from(touched);
    };

    redistributeIssues(optionIssues);

    return () => redistributeIssues(undefined);
  }, [optionIssues, accessor, field.api.form]);

  const handleSelect = useCallback(
    (id: string | null) => {
      const profile = id ? compiledOptions.selector(id) : undefined;
      if (!profile) {
        if (compiledOptions.hasDiscriminator) {
          setSelectedDiscriminator(undefined);
          field.onChange(undefined);
          return;
        } else {
          return;
        }
      }
      if (compiledOptions.hasDiscriminator && compiledOptions.discriminator) {
        setSelectedDiscriminator(profile.value);
        const currentValue = accessor.getValue();
        let defaults: Record<string, unknown> = {};
        if (profile.schema) {
          try {
            const dv = getDefaultValue(profile.schema);
            if (isRecord(dv)) defaults = dv as Record<string, unknown>;
          } catch {
            // nested discriminatedUnion など、デフォルト値を生成できない schema はスキップ
          }
        }
        const nextValue = {
          ...defaults,
          ...(isRecord(currentValue) ? currentValue : {}),
          [compiledOptions.discriminator]: profile.value,
        };

        accessor.setValue(nextValue, { dontValidate: true });
        return;
      }

      const normalized = profile.schema
        ? normalizeValue(profile.schema, formValue)
        : undefined;
      field.onChange(normalized ?? undefined);
    },
    [field, compiledOptions, formValue, accessor],
  );
  return (
    <Fieldset legend={label || undefined} mt={10}>
      {readOnly || field.disabled ? (
        <InputWrapper label={selectorLabel ?? "タイプ"} style={inputWrapperStyle}>
          <ReadonlyText>{selectedProfile?.label}</ReadonlyText>
        </InputWrapper>
      ) : (
        <Select
          ref={ref}
          data={compiledOptions.profiles}
          value={selectedProfile?.value}
          onChange={handleSelect}
          onBlur={field.onBlur}
          onFocus={onFocus}
          label={selectorLabel ?? "タイプ"}
          error={undefined}
          required={required !== false}
          disabled={readOnly || field.disabled}
          allowDeselect={required === false}
          clearable={required === false}
        />
      )}
      {selectedProfile?.schema && (
        <div style={{ marginTop: 15, minHeight: 20, marginBottom: 15 }}>
          <Suspense
            fallback={
              <LoadingComponent
                fieldPath={fieldPath}
                schema={selectedProfile.schema}
                defaultValue={dynamicDefaultValue}
                required={required}
                readOnly={readOnly}
                label={false}
              />
            }
          >
            <Dynamic
              key={selectedProfile.value}
              fieldPath={fieldPath}
              schema={selectedProfile.schema}
              defaultValue={dynamicDefaultValue}
              required={required}
              readOnly={readOnly}
              label={false}
            />
          </Suspense>
        </div>
      )}
    </Fieldset>
  );
});

/**
 * UnionComponent: root/nested で購読元を分岐し、共通の UnionBody に委譲する。
 *
 * root (fieldPath === ""): useFormValues でフォーム全体を購読
 * nested: wrapComponent 内の useZodField 購読で十分
 */
const UnionComponent = wrapComponent(function UnionComponentImplement({
  fieldPath,
  schema,
  required,
  readOnly,
  label: labelFromParent,
  field,
  error, // eslint-disable-line @typescript-eslint/no-unused-vars
}: ZodFormInternalProps<UnionSchema>) {
  const { label: labelFromMeta, selectorLabel } = getMeta(schema) ?? {};
  const label = labelFromParent ?? labelFromMeta;
  const isRoot = fieldPath === "";
  const accessor = useValueAccessor(fieldPath, field);

  const commonProps = {
    fieldPath,
    schema,
    required,
    readOnly,
    label,
    selectorLabel,
    field,
    error,
    accessor,
  };

  if (isRoot) {
    return (
      <UnionRootValueProvider>
        {(formValue) => <UnionBody {...commonProps} formValue={formValue} />}
      </UnionRootValueProvider>
    );
  }

  return (
    <UnionNestedValueProvider fieldPath={fieldPath} field={field}>
      {(formValue) => <UnionBody {...commonProps} formValue={formValue} />}
    </UnionNestedValueProvider>
  );
});

export { UnionComponent as component };
