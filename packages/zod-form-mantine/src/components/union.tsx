import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Fieldset, Select, InputWrapper } from "@mantine/core";
import z from "zod";

import {
  ZodFormInternalProps,
  wrapComponent,
  Switch,
  useValidatePrecedingFields,
  getDefaultValue,
  useZodFormContext,
  useFormValues,
  useRunAsUserEdit,
} from "@zodapp/zod-form-react/common";
import { getMeta } from "@zodapp/zod-form";
import { $ZodDiscriminatedUnionDef } from "zod/v4/core";
import { Suspense } from "react";
import {
  ReadonlyText,
  inputWrapperStyle,
} from "@zodapp/zod-form-mantine-lite/utils";

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

const getArmPropertyKeys = (schema: z.ZodTypeAny): Set<string> => {
  if (schema instanceof z.ZodObject) {
    return new Set(Object.keys(schema.shape));
  }
  if (schema instanceof z.ZodUnion) {
    return new Set(
      (schema.def.options as z.ZodTypeAny[]).flatMap((option) =>
        Array.from(getArmPropertyKeys(option)),
      ),
    );
  }
  return new Set();
};

const stripPropertiesOutsideArm = (
  value: unknown,
  schema: z.ZodTypeAny,
): Record<string, unknown> => {
  if (!isRecord(value)) return {};
  const propertyKeys = getArmPropertyKeys(schema);
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => propertyKeys.has(key)),
  );
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

/**
 * object の腕から、literal の欄（値が 1 つの `ZodLiteral`）を `{ key: value }` で集める。
 * object 以外の腕や、literal の欄を持たない腕は空を返す。
 */
const getArmLiteralFields = (schema: z.ZodTypeAny): Record<string, unknown> => {
  if (!(schema instanceof z.ZodObject)) return {};
  const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
  return Object.fromEntries(
    Object.entries(shape).flatMap(([key, field]) =>
      field instanceof z.ZodLiteral && field.values.size === 1
        ? [[key, field.value] as const]
        : [],
    ),
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
            field.api.form.baseStore.setState((state) => ({
              ...state,
              values: next,
            }));
          } else {
            field.api.handleChange(next);
          }
        },
        toAbsolutePath: (relative) => relative.filter(Boolean).join("."),
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
  hideSelector,
  readOnlySelector,
  field,
  error,
  formValue,
  accessor,
}: {
  fieldPath: string;
  schema: UnionSchema;
  required: boolean | undefined;
  readOnly: boolean | undefined;
  label: string | false | undefined;
  selectorLabel: string | undefined;
  hideSelector: boolean | undefined;
  readOnlySelector: boolean | undefined;
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
    /**
     * discriminator のない union で、どの腕にも通らない値から、
     * literal の欄が一致する腕を 1 つに絞れたらそれを返す。
     */
    guessByLiteral?: (value: unknown) => schemaProfile | undefined;
    hasDiscriminator: boolean;
    discriminator?: string;
  } = useMemo(() => {
    const optionSchemas = schema.def.options as z.ZodTypeAny[];
    if (isDiscriminatedUnion(schema)) {
      const discriminator = schema.def.discriminator;
      const profileMap = new Map(
        optionSchemas.map((optionSchema, index) => {
          const key = resolveArmDiscriminatorValue(optionSchema, discriminator);
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
      const literalFieldsByProfile = profiles
        .map((profile) => ({
          profile,
          literals: Object.entries(getArmLiteralFields(profile.schema)),
        }))
        .filter(({ literals }) => literals.length > 0);
      return {
        profiles,
        determinator: (value: unknown) =>
          profiles.find((profile) => profile.schema.safeParse(value).success),
        selector: (id: string) => profileMap.get(id),
        guessByLiteral: (value: unknown) => {
          if (!isRecord(value)) return undefined;
          const matched = literalFieldsByProfile.filter(({ literals }) =>
            literals.every(([key, literal]) => value[key] === literal),
          );
          return matched.length === 1 ? matched[0]!.profile : undefined;
        },
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
    if (discriminatorFromValue !== selectedDiscriminator) {
      setSelectedDiscriminator(discriminatorFromValue);
    }
  }, [
    compiledOptions.hasDiscriminator,
    discriminatorFromValue,
    selectedDiscriminator,
  ]);

  /**
   * discriminator のない union で、覚えている腕（current）と値から、表示する腕を決める。
   * - 覚えている腕に値が通る → そのまま（ほかの腕にも通っても切り替えない）
   * - 覚えている腕には通らず、ほかの腕に通る → 通った最初の腕
   * - どの腕にも通らない → 覚えている腕のまま（入力の途中）。覚えていなければ literal の欄で推定する
   */
  const resolvePlainArm = useCallback(
    (value: unknown, current: string | undefined): string | undefined => {
      if (compiledOptions.hasDiscriminator) return undefined;
      const currentProfile =
        current !== undefined ? compiledOptions.selector(current) : undefined;
      if (currentProfile?.schema?.safeParse(value).success) {
        return currentProfile.value;
      }
      const matched = compiledOptions.determinator(value);
      if (matched) return matched.value;
      if (currentProfile) return currentProfile.value;
      return compiledOptions.guessByLiteral?.(value)?.value;
    },
    [compiledOptions],
  );

  const [selectedPlainArm, setSelectedPlainArm] = useState<string | undefined>(
    () => resolvePlainArm(formValue, undefined),
  );

  useEffect(() => {
    setSelectedPlainArm((prev) => resolvePlainArm(formValue, prev));
  }, [formValue, resolvePlainArm]);

  const selectedProfile = useMemo(
    () =>
      compiledOptions.hasDiscriminator
        ? (compiledOptions.selector(
            selectedDiscriminator ?? discriminatorFromValue ?? "",
          ) ?? compiledOptions.determinator(formValue))
        : compiledOptions.selector(
            resolvePlainArm(formValue, selectedPlainArm) ?? "",
          ),
    [
      compiledOptions,
      discriminatorFromValue,
      formValue,
      selectedDiscriminator,
      selectedPlainArm,
      resolvePlainArm,
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

  const directIssues = useMemo(
    () =>
      !unionError &&
      error &&
      Array.isArray((error as any).path) &&
      (error as any).path.length > 0
        ? [error]
        : undefined,
    [error, unionError],
  );

  const distributableIssues = useMemo(
    () => optionIssues ?? directIssues,
    [directIssues, optionIssues],
  );

  useEffect(() => {
    const redistributeIssues = (issues: any[] | undefined) => {
      const touched = new Set<string>();

      issues?.forEach((iss) => {
        const name = accessor.toAbsolutePath((iss.path ?? []) as string[]);
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

    redistributeIssues(distributableIssues);

    return () => redistributeIssues(undefined);
  }, [distributableIssues, accessor, field.api.form]);

  const runAsUserEdit = useRunAsUserEdit();
  const handleSelect = useCallback(
    (id: string | null) => {
      const setValueWithoutValidation = (nextValue: unknown) => {
        // 腕の切り替えは利用者の編集として記録する
        runAsUserEdit(() =>
          accessor.setValue(nextValue, { dontValidate: true }),
        );
        queueMicrotask(() => {
          const errorMap = field.api.state.meta.errorMap;
          if (!errorMap?.onChange && !errorMap?.onBlur) return;
          field.api.setMeta((prev) => ({
            ...prev,
            errorMap: {
              ...prev.errorMap,
              onChange: undefined,
              onBlur: undefined,
            },
            errorSourceMap: {
              ...prev.errorSourceMap,
              onChange: undefined,
              onBlur: undefined,
            },
          }));
        });
      };

      if (
        id &&
        required === false &&
        compiledOptions.hasDiscriminator &&
        id === selectedProfile?.value
      ) {
        setSelectedDiscriminator(undefined);
        setValueWithoutValidation(undefined);
        return;
      }

      const profile = id ? compiledOptions.selector(id) : undefined;
      if (!profile) {
        if (compiledOptions.hasDiscriminator) {
          setSelectedDiscriminator(undefined);
          setValueWithoutValidation(undefined);
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
          ...(profile.schema
            ? stripPropertiesOutsideArm(currentValue, profile.schema)
            : {}),
          [compiledOptions.discriminator]: profile.value,
        };

        setValueWithoutValidation(nextValue);
        return;
      }

      // discriminator のない union：選んだ腕を覚え、値は検証せずに書く。
      // 値がまだ腕の検証に通らなくても、覚えた腕の入力欄を出し続ける。
      setSelectedPlainArm(profile.value);
      const normalized = profile.schema
        ? normalizeValue(profile.schema, formValue)
        : undefined;
      setValueWithoutValidation(normalized ?? undefined);
    },
    [
      field,
      compiledOptions,
      formValue,
      accessor,
      required,
      selectedProfile,
      runAsUserEdit,
    ],
  );
  const shouldHideSelector = hideSelector === true;
  const selectorIsReadOnly = readOnly || readOnlySelector || field.disabled;

  const content = (
    <>
      {!shouldHideSelector &&
        (selectorIsReadOnly ? (
          <InputWrapper
            label={selectorLabel ?? "タイプ"}
            labelElement="div"
            style={inputWrapperStyle}
          >
            <ReadonlyText>{selectedProfile?.label}</ReadonlyText>
          </InputWrapper>
        ) : (
          <Select
            ref={ref}
            data={compiledOptions.profiles}
            value={selectedProfile?.value ?? null}
            onChange={handleSelect}
            onBlur={field.onBlur}
            onFocus={onFocus}
            label={selectorLabel ?? "タイプ"}
            error={undefined}
            required={required !== false}
            disabled={selectorIsReadOnly}
            allowDeselect={required === false}
            clearable={required === false}
          />
        ))}
      {selectedProfile?.schema && (
        <div style={{ marginTop: 1, minHeight: 20, marginBottom: 15 }}>
          <Suspense
            fallback={
              <LoadingComponent
                fieldPath={fieldPath}
                schema={selectedProfile.schema}
                defaultValue={dynamicDefaultValue}
                required={undefined}
                readOnly={readOnly}
                label={false}
              />
            }
          >
            <Switch
              key={selectedProfile.value}
              fieldPath={fieldPath}
              schema={selectedProfile.schema}
              defaultValue={dynamicDefaultValue}
              required={undefined}
              readOnly={readOnly}
              label={false}
            />
          </Suspense>
        </div>
      )}
    </>
  );

  if (!label) {
    return content;
  }

  return (
    <Fieldset legend={label} mt={10}>
      {content}
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
  const {
    label: labelFromMeta,
    selectorLabel,
    hideSelector,
    readOnlySelector,
  } = getMeta(schema) ?? {};
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
    hideSelector,
    readOnlySelector,
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
