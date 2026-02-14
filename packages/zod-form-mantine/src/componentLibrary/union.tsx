import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Fieldset, Select, InputWrapper } from "@mantine/core";
import z, { ZodType } from "zod";

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

type UnionSchema = z.ZodUnion<[z.ZodTypeAny, ...z.ZodTypeAny[]]>;

const normalizeValue = (schema: z.ZodTypeAny, value: unknown) => {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : getDefaultValue(schema);
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

  const compiledOptions: {
    profiles: schemaProfile[];
    determinator: (value: unknown) => schemaProfile | undefined;
    selector: (id: string) => schemaProfile | undefined;
    hasDiscriminator: boolean;
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
      };
    }
  }, [schema]);

  const [selectedProfile, setSelectedProfile] = useState<
    schemaProfile | undefined
  >(() => {
    return compiledOptions.determinator(field.value);
  });

  useEffect(() => {
    const matched = compiledOptions.determinator(field.value);
    if (matched && matched !== selectedProfile) {
      setSelectedProfile(matched);
    }
  }, [compiledOptions, field.value, selectedProfile]);

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
          setSelectedProfile(undefined);
          field.onChange(undefined);
          return;
        } else {
          return;
        }
      }
      setSelectedProfile(profile);
      // discriminatorの場合は、ここでdiscriminatorのvalueが設定される
      const normalized = profile.schema
        ? normalizeValue(profile.schema, field.value)
        : undefined;
      field.onChange(normalized ?? undefined);
    },
    [field, compiledOptions],
  );
  return (
    <Fieldset legend={label || undefined} mt={10}>
      {readOnly || field.disabled ? (
        <InputWrapper label={selectorLabel ?? "タイプ"} mt={5}>
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
                defaultValue={field.value}
                required={required}
                readOnly={readOnly}
                label={false}
              />
            }
          >
            <Dynamic
              fieldPath={fieldPath}
              schema={selectedProfile.schema}
              defaultValue={field.value}
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
