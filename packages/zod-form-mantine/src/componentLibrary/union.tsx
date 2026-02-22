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
} from "@zodapp/zod-form-react/common";
import { getMeta } from "@zodapp/zod-form";
import { $ZodDiscriminatedUnionDef } from "zod/v4/core";
import { Suspense } from "react";
import { ReadonlyText } from "./utils/text";
import { inputWrapperStyle } from "./utils/styles";

type UnionSchema = z.ZodUnion<[z.ZodTypeAny, ...z.ZodTypeAny[]]>;

const normalizeValue = (schema: z.ZodTypeAny, value: unknown) => {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : getDefaultValue(schema);
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const isDiscriminatedUnion = (
  schema: z.ZodUnion,
): schema is z.ZodDiscriminatedUnion => {
  return (schema.def as $ZodDiscriminatedUnionDef).discriminator !== undefined;
};

type schemaProfile = {
  schema: z.ZodTypeAny | undefined;
  label: string;
  value: string;
  index: number;
};

const UnionComponent = wrapComponent(function UnionComponentImplement({
  fieldPath,
  schema,
  required,
  readOnly,
  label: labelFromParent,
  field,
  error, // eslint-disable-line @typescript-eslint/no-unused-vars
}: ZodFormInternalProps<UnionSchema>) {
  const { loadingComponent: LoadingComponent } = useZodFormContext();

  const { onFocus, ref } = useValidatePrecedingFields(field);
  const { label: labelFromMeta, selectorLabel } = getMeta(schema) ?? {};
  const label = labelFromParent ?? labelFromMeta;
  const formValue = fieldPath
    ? field.api.form.getFieldValue(fieldPath)
    : field.api.form.state.values;

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
          const _optionSchema = optionSchema as z.ZodObject<z.ZodRawShape>;
          const discriminatorSchema = _optionSchema.shape[
            discriminator
          ] as z.ZodLiteral<string>;
          const key = discriminatorSchema.value;
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

  // 非判別 union のときだけ invalid_union を再配布
  useEffect(() => {
    const redistributeIssues = (issues: any[] | undefined) => {
      const touched = new Set<string>();

      issues?.forEach((iss) => {
        const absPath = [
          ...(fieldPath ? [fieldPath] : []),
          ...((iss.path ?? []) as string[]),
        ].filter(Boolean);
        const name = absPath.join(".");
        touched.add(name);

        field.api.form.setFieldMeta(name, (meta: any) => {
          const nextErrors = [{ message: iss.message, type: iss.code }];
          if (
            Array.isArray(meta?.errors) &&
            meta.errors.length === 1 &&
            meta.errors[0]?.message === iss.message &&
            meta.errors[0]?.type === iss.code
          ) {
            return meta; // 変化なしならスキップ
          }
          return {
            ...meta,
            errors: nextErrors,
            errorMap: { ...(meta?.errorMap ?? {}), onBlur: nextErrors },
          };
        });
      });

      // 触っていないものを掃除
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
  }, [optionIssues, fieldPath, field.api.form]);

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
      // discriminatedUnion は全体再正規化を避け、discriminator フィールドのみ直接更新する。
      // 既存データを保持したまま discriminator だけ差し替える（strip 前提）。
      if (compiledOptions.hasDiscriminator && compiledOptions.discriminator) {
        setSelectedDiscriminator(profile.value);
        const currentValue = fieldPath
          ? field.api.form.getFieldValue(fieldPath)
          : field.api.form.state.values;
        const defaults =
          profile.schema && isRecord(getDefaultValue(profile.schema))
            ? (getDefaultValue(profile.schema) as Record<string, unknown>)
            : {};
        const nextValue = {
          ...defaults,
          ...(isRecord(currentValue) ? currentValue : {}),
          [compiledOptions.discriminator]: profile.value,
        };

        if (fieldPath) {
          field.api.form.setFieldValue(fieldPath, nextValue as never, {
            dontValidate: true,
          });
          return;
        }

        const fallbackValue = isRecord(field.value)
          ? {
              ...field.value,
              [compiledOptions.discriminator]: profile.value,
            }
          : {
              [compiledOptions.discriminator]: profile.value,
            };
        field.onChange(fallbackValue ?? undefined);
        return;
      }

      const normalized = profile.schema
        ? normalizeValue(profile.schema, formValue)
        : undefined;
      field.onChange(normalized ?? undefined);
    },
    [field, compiledOptions, fieldPath, formValue],
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

export { UnionComponent as component };
