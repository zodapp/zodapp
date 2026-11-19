import { useResolvedMeta } from "@zodapp/zod-form-react/common";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Fieldset, Select, InputWrapper } from "@mantine/core";
import { useStore } from "@tanstack/react-form";
import z from "zod";

import {
  ZodFormInternalProps,
  wrapComponent,
  Switch,
  ContainerMarker,
  useValidatePrecedingFields,
  getDefaultValue,
  useZodFormContext,
  useFormValues,
  useRunAsUserEdit,
  isPendingIssue,
  emptyValueOf,
  emptinessOf,
} from "@zodapp/zod-form-react/common";
import { getMeta } from "@zodapp/zod-form";
import { unrecognizedKeysMessage } from "./unrecognizedKeys";
import { ownsContainerMarker } from "./container";
import { $ZodDiscriminatedUnionDef } from "zod/v4/core";
import { Suspense } from "react";
import {
  ReadonlyText,
  inputWrapperStyle,
} from "@zodapp/zod-form-mantine-lite/utils";
import { useResolveText } from "@zodapp/zod-form-react/common";
import { useMsg } from "../messages/useMsg";

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

/**
 * 腕を切り替えるとき、ほかの腕にしか無いキーを消す。
 * どの腕にも無いキーは残す（intersection で、同じ値を union と並べた object が持つ欄）
 */
const stripPropertiesOfOtherArms = (
  value: unknown,
  schema: z.ZodTypeAny,
  unionSchema: z.ZodTypeAny,
): Record<string, unknown> => {
  if (!isRecord(value)) return {};
  const propertyKeys = getArmPropertyKeys(schema);
  const allArmKeys = getArmPropertyKeys(unionSchema);
  return Object.fromEntries(
    Object.entries(value).filter(
      ([key]) => propertyKeys.has(key) || !allArmKeys.has(key),
    ),
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

/** invalid_union の腕ごとの issue（path はその union の値からの相対） */
type ArmIssue = { path?: unknown; message?: string; code?: string };

/** 腕の issue が union 自身を指すか（path が []） */
const isRootIssue = (iss: ArmIssue | undefined): boolean =>
  !Array.isArray(iss?.path) || iss.path.length === 0;

/**
 * union が、選んだ腕のエラーを書く先（TanStack Form の errorMap の枠）。
 *
 * - `meta.errors` は errorMap の値を並べ直したものなので、errors には直接書かず、枠に書く
 * - AutoForm などの検証は onChange・onBlur・onSubmit の枠を使い、検証のたびに上書き・消去する。
 *   部品も値の変更で onBlur を消す。onMount は値を書くたびに TanStack が消す（setFieldValue）。
 *   onServer はフォームの検証のたびに消える。
 *   onDynamic は、既定の検証の流れ（defaultValidationLogic）では TanStack が読み書きしない
 * - 値は issue の配列。書いた union ごとの印を付け、union は自分が書いたものだけを足し引きする
 *   （同じ欄に入れ子の union が書き、子の欄にも外の union と子の union が書くため）
 */
const ARM_ERROR_SLOT = "onDynamic";

/** union が errorMap に書いた issue */
type WrittenIssue = ArmIssue & {
  /**
   * 自分の欄に書いた union（部品ごとの印）。同じ欄の内側の union は、この印で読む
   */
  writtenBy?: object;
  /**
   * 子の欄に振り分けた union（部品ごとの印）。読む側から見ると、検証が出したものと同じく
   * 印のない issue として扱う（子の欄の union は、印のない invalid_union を読む）
   */
  distributedBy?: object;
};

const isWrittenIssue = (
  issue: unknown,
): issue is WrittenIssue & { writtenBy: object } =>
  typeof issue === "object" &&
  issue !== null &&
  (issue as WrittenIssue).writtenBy !== undefined;

const isUnionIssue = (
  issue: unknown,
): issue is ArmIssue & { errors?: unknown } =>
  typeof issue === "object" &&
  issue !== null &&
  (issue as ArmIssue).code === "invalid_union";

/** 欄の path をそろえる（`a[0].b` と `a.0.b` を同じにする） */
const normalizeFieldPath = (fieldPath: string): string =>
  fieldPath
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean)
    .join(".");

/**
 * 欄のエラーから、この union が読む invalid_union を選ぶ。
 * - `errorToken` を受け取っている（同じ欄の外側の union の腕である）：すぐ外側の union が書いたものだけ
 * - 受け取っていない：`writtenBy` の無い最初のもの
 *   （検証が出したもの。別の欄の外側の union が振り分けたもの（distributedBy）も、ここでは無いものとして扱う）
 */
const pickUnionIssue = (
  errors: readonly unknown[],
  errorToken: object | undefined,
) =>
  errorToken
    ? errors.find(
        (issue) =>
          isUnionIssue(issue) &&
          isWrittenIssue(issue) &&
          issue.writtenBy === errorToken,
      )
    : errors.find((issue) => isUnionIssue(issue) && !isWrittenIssue(issue));

const isUnrecognizedKeysIssue = (
  issue: unknown,
): issue is { code: "unrecognized_keys"; keys: string[]; message?: string } =>
  typeof issue === "object" &&
  issue !== null &&
  (issue as { code?: unknown }).code === "unrecognized_keys";

/** 書く issue の比べ方（同じなら書き直さず、store を揺らさない） */
const issueKey = (issue: unknown): string => {
  const { writtenBy: _w, distributedBy: _d, ...rest } = issue as WrittenIssue;
  // issue には bigint（`z.bigint().min(1n)` の minimum など）が入りうるので、文字にして比べる
  return JSON.stringify(rest, (_key, value) =>
    typeof value === "bigint" ? `${value}n` : value,
  );
};

const sameIssues = (a: readonly unknown[], b: readonly unknown[]): boolean =>
  a.length === b.length &&
  a.every((issue, index) => issueKey(issue) === issueKey(b[index]));

const listOf = (slot: unknown): unknown[] =>
  Array.isArray(slot) ? slot : slot === undefined ? [] : [slot];

/**
 * 欄の errorMap の {@link ARM_ERROR_SLOT} のうち、`isMine` に当たるものを `issues` に入れ替える。
 * ほかの union が書いたものは残す。同じ内容なら書かない
 */
const replaceWrittenIssues = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any,
  name: string,
  isMine: (issue: unknown) => boolean,
  issues: readonly unknown[],
) => {
  const meta = form.getFieldMeta(name);
  const current = listOf(meta?.errorMap?.[ARM_ERROR_SLOT]);
  if (sameIssues(current.filter(isMine), issues)) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form.setFieldMeta(name, (prev: any) => {
    const others = listOf(prev?.errorMap?.[ARM_ERROR_SLOT]).filter(
      (iss) => !isMine(iss),
    );
    const next = [...others, ...issues];
    return {
      ...prev,
      errorMap: {
        ...(prev?.errorMap ?? {}),
        [ARM_ERROR_SLOT]: next.length > 0 ? next : undefined,
      },
    };
  });
};

const EMPTY_ERRORS: readonly unknown[] = [];

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
  optional,
  nullable,
  readOnly,
  label,
  selectorLabel,
  hideSelector,
  readOnlySelector,
  field,
  fieldErrors,
  showError,
  formValue,
  accessor,
  hideError,
  errorToken,
  flat,
}: {
  /** 同じ path のエラーを祖先（intersection）が出す。腕の部品に渡す */
  hideError: boolean | undefined;
  /** 同じ欄で、すぐ外側の union の writer */
  errorToken: object | undefined;
  /** uiType: "flat"：Fieldset（とその legend）を出さず、腕を選ぶ欄と腕の欄だけを並べる */
  flat: boolean;
  fieldPath: string;
  schema: UnionSchema;
  optional: boolean | undefined;
  nullable: boolean | undefined;
  readOnly: boolean | undefined;
  label: string | false | undefined;
  selectorLabel: string | undefined;
  hideSelector: boolean | undefined;
  readOnlySelector: boolean | undefined;
  field: ZodFormInternalProps<UnionSchema>["field"];
  /** 欄のエラーすべて（invalid_union を含む。表示してよいときだけ） */
  fieldErrors: readonly unknown[];
  /** エラーを表示してよいか（触ったか送信したか） */
  showError: boolean;
  formValue: unknown;
  accessor: ValueAccessor;
}) {
  const { loadingComponent: LoadingComponent } = useZodFormContext();
  const { onFocus, ref } = useValidatePrecedingFields(field);
  const msg = useMsg();
  const resolveText = useResolveText();

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
              label:
                resolveText(getMeta(optionSchema)?.label) ?? ` ${index + 1}`,
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
              label:
                resolveText(getMeta(optionSchema)?.label) ?? ` ${index + 1}`,
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
  }, [schema, resolveText]);

  /**
   * discriminator のない保存値では、zod は invalid_union を [union の欄, discriminator] に出す。
   * その欄は描かれないので、union が読んで腕を選ぶ欄に出す
   */
  const discriminatorPath = compiledOptions.discriminator
    ? field.api.name === ""
      ? compiledOptions.discriminator
      : `${field.api.name}.${compiledOptions.discriminator}`
    : undefined;
  const rawDiscriminatorErrors = useStore(field.api.form.store, (state: any) =>
    discriminatorPath === undefined
      ? EMPTY_ERRORS
      : (state.fieldMeta?.[discriminatorPath]?.errors ?? EMPTY_ERRORS),
  );
  const hasDiscriminatorError =
    showError &&
    (rawDiscriminatorErrors as unknown[])
      .flat()
      .some((issue) => issue !== undefined && !isPendingIssue(issue));

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

  /** この union の印。書いたものに付け、自分が書いたものだけを足し引きする */
  const [writer] = useState(() => ({}));
  const ownPath = normalizeFieldPath(fieldPath);
  const unionError = useMemo(
    () => pickUnionIssue(fieldErrors, errorToken) as any,
    [fieldErrors, errorToken],
  );

  const optionIssues =
    unionError && selectedProfile
      ? unionError.errors?.[selectedProfile.index]
      : undefined;

  /** この union の欄の path（segment の並び） */
  const ownSegments = useMemo(
    () => (ownPath === "" ? [] : ownPath.split(".")),
    [ownPath],
  );

  /**
   * invalid_union でないエラー（discriminatedUnion の選んだ腕の issue など）。
   * 欄のエラーの path はフォームの値からの path なので、この union の値からの path に直す。
   * この union の欄より下を指さないもの（union 自身を指すものなど）は振り分けない
   */
  const directIssues = useMemo(() => {
    // 欄のエラーのうち invalid_union でない最初のもの（wrapComponent の error は
    // hideError・errorToken で選ばれるので使わない）
    const error = fieldErrors.find((issue) => !isUnionIssue(issue));
    if (
      unionError ||
      !error ||
      // union が書いた・振り分けた issue は振り分けない
      isWrittenIssue(error) ||
      (error as WrittenIssue).distributedBy !== undefined ||
      !Array.isArray((error as any).path)
    ) {
      return undefined;
    }
    const path = (error as any).path as PropertyKey[];
    const isUnder =
      path.length > ownSegments.length &&
      ownSegments.every((segment, index) => String(path[index]) === segment);
    return isUnder
      ? [{ ...(error as object), path: path.slice(ownSegments.length) }]
      : undefined;
  }, [fieldErrors, unionError, ownSegments]);

  const distributableIssues = useMemo(
    () => optionIssues ?? directIssues,
    [directIssues, optionIssues],
  );

  /**
   * 選んだ腕のエラーのうち union 自身を指すもの（path が []。プリミティブの腕が空・型違いのとき、
   * 腕が union のときなど）。union と同じ欄に描かれる腕の部品に出すため、invalid_union を残したまま、
   * 同じ欄の {@link ARM_ERROR_SLOT} にこの union の印を付けて足す。
   * 腕が union なら、その invalid_union も足し、同じ欄の腕の union は受け取った印でそれを読む。
   * 自分が書いたものは自分では読まない（印の付いたものは、外側の同じ欄の union の印のときだけ読む）
   */
  const ownArmIssues = useMemo((): WrittenIssue[] => {
    if (!unionError || !selectedProfile) return [];
    return (Array.isArray(optionIssues) ? (optionIssues as ArmIssue[]) : [])
      .filter(isRootIssue)
      .map((iss) => ({
        ...iss,
        // 欄の issue と同じく、path はフォームの値からの path
        path: unionError.path,
        writtenBy: writer,
      }));
  }, [unionError, selectedProfile, optionIssues, writer]);

  /**
   * 選んだ腕のエラーのうち、子の欄を指すもの（object の腕の子の欄）。
   * issue はまるごと（code・errors を落とさずに）渡す。子の欄の union が invalid_union を読むため
   */
  const childIssues = useMemo(
    () =>
      (Array.isArray(distributableIssues)
        ? (distributableIssues as ArmIssue[])
        : []
      ).filter((iss) => !isRootIssue(iss)),
    [distributableIssues],
  );

  // field.api は、欄の meta が変わるたびに別の object になる（TanStack の useField）。
  // 書くと field.api が変わり、それで書き直すと止まらないので、変わらない form と欄の名前で書く
  const form = field.api.form;
  const fieldName = field.api.name;
  /**
   * union の欄の値が変わったら（腕の子の欄の入力でも変わる）、union の欄の onBlur のエラーを消す。
   * object の腕の子の欄の型のエラー（空の数値など）は、zod が union の欄の invalid_union に入れる。
   * 欄を離れたときの検証の結果（onBlur）は次に欄を離れるまで残るので、消さないと、子の欄を直しても
   * 古い invalid_union から子の欄にエラーを振り分け続ける。wrapComponent が自分の欄でしているのと同じ
   */
  const lastValueRef = useRef(formValue);
  useEffect(() => {
    if (Object.is(lastValueRef.current, formValue)) return;
    lastValueRef.current = formValue;
    queueMicrotask(() => {
      const meta = form.getFieldMeta(fieldName);
      if (!meta?.errorMap?.onBlur) return;
      form.setFieldMeta(fieldName, (prev: any) => ({
        ...prev,
        errorMap: { ...prev.errorMap, onBlur: undefined },
        errorSourceMap: { ...prev.errorSourceMap, onBlur: undefined },
      }));
    });
  }, [formValue, form, fieldName]);

  useEffect(() => {
    const isMine = (iss: unknown) =>
      isWrittenIssue(iss) && iss.writtenBy === writer;
    replaceWrittenIssues(form, fieldName, isMine, ownArmIssues);
    // 腕が変わった・invalid_union が消えた・外れたときは、自分が書いたものだけ消す
    return () => replaceWrittenIssues(form, fieldName, isMine, []);
  }, [ownArmIssues, form, fieldName, writer]);

  useEffect(() => {
    const isMine = (iss: unknown) =>
      typeof iss === "object" &&
      iss !== null &&
      (iss as WrittenIssue).distributedBy === writer;
    const byName = new Map<string, WrittenIssue[]>();
    childIssues.forEach((iss) => {
      const relative = (iss.path ?? []) as string[];
      const name = accessor.toAbsolutePath(relative);
      if (!name) return;
      const list = byName.get(name) ?? [];
      list.push({
        ...iss,
        // 欄の issue と同じく、path はフォームの値からの path（errors の中は書き換えない）
        path: [...ownSegments, ...relative],
        distributedBy: writer,
      });
      byName.set(name, list);
    });
    const names = Array.from(byName.keys());
    names.forEach((name) =>
      replaceWrittenIssues(form, name, isMine, byName.get(name)!),
    );
    prevInjectedRef.current
      .filter((name) => !byName.has(name))
      .forEach((name) => replaceWrittenIssues(form, name, isMine, []));
    prevInjectedRef.current = names;
  }, [childIssues, accessor, form, writer, unionError]);

  // 外れたときは、振り分けたものを消す
  useEffect(
    () => () => {
      const isMine = (iss: unknown) =>
        typeof iss === "object" &&
        iss !== null &&
        (iss as WrittenIssue).distributedBy === writer;
      prevInjectedRef.current.forEach((name) =>
        replaceWrittenIssues(form, name, isMine, []),
      );
      prevInjectedRef.current = [];
    },
    [form, writer],
  );

  /**
   * 同じ欄に、外側の部品が出す issue（invalid_union でないもの）があるか。
   * hideError のとき、これがあれば「選択してください」は重ねて出さない（外側が出す）
   */
  const hasIssueForAncestor = fieldErrors.some((issue) => !isUnionIssue(issue));
  const yieldsToAncestor = Boolean(hideError) && hasIssueForAncestor;

  /**
   * 自分の欄の unrecognized_keys（writtenBy の無いもの）。腕の部品には渡らない
   * （isDisplayedIssue）ので、union が腕を選ぶ欄に出す。hideError のときは外側が出す
   */
  const unrecognizedKeysError = useMemo(() => {
    if (hideError) return undefined;
    const issue = fieldErrors.find(
      (iss) => isUnrecognizedKeysIssue(iss) && !isWrittenIssue(iss),
    ) as { keys?: string[]; message?: string } | undefined;
    if (!issue) return undefined;
    return (
      unrecognizedKeysMessage(schema, issue.keys ?? [], msg) ??
      msg.resolve(issue.message)
    );
  }, [fieldErrors, hideError, schema, msg]);

  /**
   * 腕が未選択で検証に落ちているとき（必須の union が空のとき、値がどの腕にも合わず
   * 推定できないとき）は、腕を選ぶ欄に「選択してください」を出す。
   * どちらも、この union が読む invalid_union があり、腕が選ばれていない状態になる。
   * hideError で、同じ欄に外側が出す issue があるときは出さない（値が空のとき、外側の
   * intersection が「必ず入力してください。」を出すので重なる）。discriminator の欄のエラーからは出す。
   * 出す時機は fieldErrors と同じ（触ったか送信したか）
   */
  const selectorError = selectedProfile
    ? unrecognizedKeysError
    : compiledOptions.hasDiscriminator
      ? // discriminatedUnion は、値が undefined・null のとき invalid_union ではなく
        // invalid_type を union の欄に出す。腕が未選択で欄にエラーがあれば、code を問わず出す
        hasDiscriminatorError || (fieldErrors.length > 0 && !yieldsToAncestor)
        ? msg("zodFormMantine.union.unselected" /* i18n: 選択してください */)
        : undefined
      : unionError && !yieldsToAncestor
        ? msg("zodFormMantine.union.unselected" /* i18n: 選択してください */)
        : undefined;

  const runAsUserEdit = useRunAsUserEdit();
  const emptyValue = emptyValueOf({ optional, nullable });
  const handleSelect = useCallback(
    (id: string | null) => {
      const setValueWithoutValidation = (nextValue: unknown) => {
        // 腕の切り替えは利用者の編集として記録する
        runAsUserEdit(() =>
          accessor.setValue(nextValue, { dontValidate: true }),
        );
        queueMicrotask(() => {
          // フォーム全体のエラー（form.state.errorMap）も消す。standard schema の検証では、
          // フォーム全体のエラーにも欄ごとのエラーが入る。値を検証せずに書くと、腕を選ぶ前の
          // 検証（腕を選ぶ欄を離れたときの onBlur など）の結果が残り、canSubmit が false のままになって、
          // TanStack Form が初めの送信を検証せずに止める。次の検証で入れ直される
          const formErrorMap = field.api.form.state.errorMap;
          if (formErrorMap?.onChange || formErrorMap?.onBlur) {
            field.api.form.setErrorMap({
              onChange: undefined,
              onBlur: undefined,
            });
          }
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
        Boolean(optional || nullable) &&
        compiledOptions.hasDiscriminator &&
        id === selectedProfile?.value
      ) {
        setSelectedDiscriminator(undefined);
        setValueWithoutValidation(emptyValue);
        return;
      }

      const profile = id ? compiledOptions.selector(id) : undefined;
      if (!profile) {
        if (compiledOptions.hasDiscriminator) {
          setSelectedDiscriminator(undefined);
          setValueWithoutValidation(emptyValue);
          return;
        }
        // discriminator のない union：× で、覚えた腕を消して空にする。
        // 必須の union では外さない（× は出さないが、Mantine は選択中の腕を選び直すと null で呼ぶ）
        if (optional || nullable) {
          setSelectedPlainArm(undefined);
          setValueWithoutValidation(emptyValue);
        }
        return;
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
            ? stripPropertiesOfOtherArms(currentValue, profile.schema, schema)
            : {}),
          [compiledOptions.discriminator]: profile.value,
        };

        setValueWithoutValidation(nextValue);
        return;
      }

      // discriminator のない union：選んだ腕を覚え、値は検証せずに書く。
      // 値がまだ腕の検証に通らなくても、覚えた腕の入力欄を出し続ける。
      // 腕の既定の値が undefined なら空の値（nullable だけの union では null）にする
      setSelectedPlainArm(profile.value);
      const armValue = profile.schema
        ? normalizeValue(profile.schema, formValue)
        : undefined;
      // どの腕にも無いキー（intersection で、同じ値を union と並べた object が持つ欄）は残す
      const normalized =
        isRecord(armValue) && isRecord(formValue)
          ? {
              ...Object.fromEntries(
                Object.entries(formValue).filter(
                  ([key]) => !getArmPropertyKeys(schema).has(key),
                ),
              ),
              ...armValue,
            }
          : armValue;
      setValueWithoutValidation(
        normalized === undefined ? emptyValue : normalized,
      );
    },
    [
      field,
      compiledOptions,
      formValue,
      accessor,
      optional,
      nullable,
      emptyValue,
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
            label={
              selectorLabel ??
              msg("zodFormMantine.union.selectorLabel" /* i18n: タイプ */)
            }
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
            label={
              selectorLabel ??
              msg("zodFormMantine.union.selectorLabel" /* i18n: タイプ */)
            }
            error={selectorError}
            required={!(optional || nullable)}
            disabled={selectorIsReadOnly}
            allowDeselect={Boolean(optional || nullable)}
            clearable={Boolean(optional || nullable)}
          />
        ))}
      {selectedProfile?.schema && (
        // 腕の欄の入れ物。高さを固定せず（欄の無い腕では何も出さない）、下は入力欄と同じ 5px 空ける
        <div style={{ marginTop: 1, marginBottom: 5 }}>
          <Suspense
            fallback={
              <LoadingComponent
                fieldPath={fieldPath}
                schema={selectedProfile.schema}
                defaultValue={dynamicDefaultValue}
                outer={undefined}
                readOnly={readOnly}
                label={false}
                hideError={hideError}
                errorToken={writer}
              />
            }
          >
            <Switch
              key={selectedProfile.value}
              fieldPath={fieldPath}
              schema={selectedProfile.schema}
              defaultValue={dynamicDefaultValue}
              outer={undefined}
              readOnly={readOnly}
              label={false}
              // 同じ path のエラーを祖先（intersection）が出すときは、腕にも出させない
              hideError={hideError}
              // 腕がまた union なら、この union が書いた invalid_union を読む
              errorToken={writer}
            />
          </Suspense>
        </div>
      )}
      {ownsContainerMarker({ hideError, errorToken }) && (
        <ContainerMarker fieldPath={fieldPath} />
      )}
    </>
  );

  if (!label || flat) {
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
  outer,
  readOnly,
  label: labelFromParent,
  field,
  isTouched,
  hideError,
  errorToken,
}: ZodFormInternalProps<UnionSchema>) {
  const { optional, nullable } = emptinessOf(outer);
  const {
    label: labelFromMeta,
    selectorLabel,
    hideSelector,
    readOnlySelector,
    uiType,
  } = useResolvedMeta(schema) ?? {};
  const label = labelFromParent ?? labelFromMeta;
  const isRoot = fieldPath === "";
  const accessor = useValueAccessor(fieldPath, field);
  // wrapComponent の error は invalid_union を除くので、union は欄のエラーをすべて読む。
  // 表示してよい（触った・送信した）ときだけ使う（wrapComponent と同じ）
  const rawErrors = useStore(
    field.api.store,
    (state: any) => state.meta.errors,
  );
  const showError = isTouched || field.api.form.state.isSubmitted;
  const fieldErrors = useMemo(
    () =>
      showError
        ? (rawErrors as unknown[])
            .flat()
            .filter((issue) => !isPendingIssue(issue))
        : EMPTY_ERRORS,
    [rawErrors, showError],
  );

  const commonProps = {
    fieldPath,
    schema,
    optional,
    nullable,
    readOnly,
    label,
    selectorLabel,
    hideSelector,
    readOnlySelector,
    field,
    fieldErrors,
    showError,
    accessor,
    hideError,
    errorToken,
    flat: uiType === "flat",
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
