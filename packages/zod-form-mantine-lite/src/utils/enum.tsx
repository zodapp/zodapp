import { useMemo } from "react";
import type { z } from "zod";
import { getMeta } from "@zodapp/zod-form";
import { useResolveText } from "@zodapp/zod-form-react/common";
import { type OptionDataType } from "./selectOption";

// 文字列の enum も数値の enum も受け付ける
type EnumSchema = z.ZodEnum<z.core.util.EnumLike>;
type EnumValue = string | number;

/** enum の選択肢 1 つ。value：値。name：label が無いときの名前 */
export type EnumOption = { value: EnumValue; name: string };

/**
 * enum の選択肢と、label が無いときの名前。
 *
 * - object の形で書いた enum（`z.enum({ A: 1 })`・TS enum）は、キーを名前にする。
 *   配列で書いた enum はキーと値が同じなので、名前は値になる
 * - 数値の TS enum の逆引きのキー（`"0": "Red"` の組）は外す。zod が検証に使う値の求め方
 *   （`util.getEnumValues`）と同じく、数の値と同じ数字のキーの組を外す。
 *   検証（safeParse）は使わない（async の refine が付いた enum で、描画中に例外になるため）
 */
export const enumOptionsOf = (enumSchema: EnumSchema): EnumOption[] => {
  const entries = Object.entries(
    (enumSchema.def as { entries?: Record<string, EnumValue> }).entries ?? {},
  );
  const numericValues = entries
    .map(([, value]) => value)
    .filter((value): value is number => typeof value === "number");
  const options: EnumOption[] = [];
  for (const [key, value] of entries) {
    if (numericValues.includes(Number(key))) continue;
    // 同じ値を持つキーが複数あれば、先のキーを名前にする
    if (options.some((option) => option.value === value)) continue;
    options.push({ value, name: key });
  }
  return options;
};

/** enum の選択肢の名前（literal の label。無ければ {@link enumOptionsOf} の名前）と色 */
const enumOptionData = (
  enumSchema: EnumSchema,
  { value, name }: EnumOption,
): OptionDataType => {
  const { schemas } = getMeta(enumSchema) ?? {};
  const key = String(value);
  const literalMeta = schemas?.[key] ? getMeta(schemas[key]) : null;
  return {
    value: key,
    label: literalMeta?.label ?? name,
    color: literalMeta?.color ?? "gray",
  };
};

/** enum の値の表示名と色。選択肢に無い値は undefined */
export const enumOptionDataOf = (
  enumSchema: EnumSchema,
  value: unknown,
): OptionDataType | undefined => {
  const option = enumOptionsOf(enumSchema).find(
    (candidate) => String(candidate.value) === String(value),
  );
  return option ? enumOptionData(enumSchema, option) : undefined;
};

/**
 * enumスキーマのオプションからSelect/MultiSelect用のdata配列を生成するフック。
 * Select の値は文字列なので、数値の選択肢も文字列にして渡す ({@link fromEnumOptionValue} で戻す)
 */
export function useEnumData(enumSchema: EnumSchema): OptionDataType[] {
  const resolveText = useResolveText();
  return useMemo(
    () =>
      enumOptionsOf(enumSchema).map((option) => {
        const data = enumOptionData(enumSchema, option);
        return { ...data, label: resolveText(data.label) ?? data.label };
      }),
    [enumSchema, resolveText],
  );
}

/** フォームの値を Select の値 (文字列) にする。未選択 (undefined / null / 空文字) は null */
export const toEnumOptionValue = (value: unknown): string | null =>
  value === undefined || value === null || value === "" ? null : String(value);

/** Select の値 (文字列) を enum の値 (文字列または数値) に戻す。未選択は undefined */
export const fromEnumOptionValue = (
  enumSchema: EnumSchema,
  optionValue: string | null | undefined,
): EnumValue | undefined => {
  if (optionValue === null || optionValue === undefined || optionValue === "")
    return undefined;
  return (
    enumOptionsOf(enumSchema).find(
      (option) => String(option.value) === optionValue,
    )?.value ?? optionValue
  );
};

/**
 * 選択の欄の選択肢と、フォームの値・Select の値（文字列）の行き来。
 * enum と、literal だけの union（`uiType: "select"` など）で同じ部品を使うためにまとめる。
 */
export type Choices = {
  /** Select / MultiSelect に渡す選択肢 */
  data: OptionDataType[];
  /**
   * フォームの値を Select の値にする。未選択（undefined・null・空文字）は null。
   * 選択肢に無い値は、選択肢のどれとも重ならない文字列にする（data に無いことで見分ける）
   */
  toOption: (value: unknown) => string | null;
  /** Select の値をフォームの値に戻す。未選択や、選択肢に無い Select の値は undefined */
  fromOption: (option: string | null | undefined) => unknown;
  /** 選択肢に undefined がある（undefined の腕）。あれば外側の optional より腕を優先する */
  hasUndefined: boolean;
  /** 選択肢に null がある（null の腕）。あれば外側の nullable より腕を優先する */
  hasNull: boolean;
};

/** Select の値が未選択（× で消した・選択を外した）か */
export const isEmptyOption = (option: string | null | undefined) =>
  option === null || option === undefined || option === "";

const enumChoices = (enumSchema: EnumSchema): Choices => {
  return {
    data: enumOptionsOf(enumSchema).map((option) =>
      enumOptionData(enumSchema, option),
    ),
    toOption: toEnumOptionValue,
    fromOption: (option) => fromEnumOptionValue(enumSchema, option),
    hasUndefined: false,
    hasNull: false,
  };
};

/**
 * 選択肢の値を探すときの比べ方。NaN の腕（`z.literal(NaN)`）も選べるよう、NaN 同士を等しいとする
 * （0 と -0 は等しいままにする。zod の literal の検証と同じ）
 */
const sameValueZero = (a: unknown, b: unknown) =>
  a === b || (Number.isNaN(a) && Number.isNaN(b));

/** 選択肢に無い値の Select の値（腕の番号と重ならないよう、数字だけにしない） */
const UNLISTED_OPTION_PREFIX = "unlisted:";

/** ラベルが無いときの選択肢の文字（bigint は 10n として、数値の 10 と区別する） */
const defaultLabelOf = (value: unknown) =>
  typeof value === "bigint" ? `${value}n` : String(value);

/**
 * literal だけの union の選択肢。Select とは腕の番号（"0"・"1"…）でやりとりする。
 * 値を複数持つ literal（`z.literal(["a", "b"])`）は、値ごとに "0.0"・"0.1"… にする。
 * 番号は Select の中だけで使い、フォームの値には literal の値をそのまま書く。
 * そのため `literal(10)` と `literal("10")` も区別でき、bigint・boolean・null・undefined も扱える。
 * `z.null()`・`z.undefined()` の腕は、`literal(null)`・`literal(undefined)` と同じに扱う。
 * それ以外の腕は選べないので、選択肢に出さない（警告を出す）
 */
const literalUnionChoices = (unionSchema: z.ZodUnion): Choices => {
  const options = (unionSchema.def.options as z.ZodTypeAny[]).flatMap(
    (arm, index) => {
      const meta = getMeta(arm);
      const values =
        arm.type === "literal"
          ? ((arm.def as { values?: unknown[] }).values ?? [])
          : arm.type === "null"
            ? [null]
            : arm.type === "undefined"
              ? [undefined]
              : undefined;
      if (values === undefined) {
        console.warn(
          `literal union choices: arm #${index + 1} is not a literal, so it is not listed (type: ${arm.type})`,
        );
        return [];
      }
      return values.map((value, valueIndex) => ({
        key: values.length === 1 ? String(index) : `${index}.${valueIndex}`,
        value,
        meta,
      }));
    },
  );
  return {
    data: options.map(({ key, value, meta }) => ({
      value: key,
      label: meta?.label ?? defaultLabelOf(value),
      color: meta?.color ?? "gray",
    })),
    toOption: (value) => {
      const option = options.find((candidate) =>
        sameValueZero(candidate.value, value),
      );
      if (option) return option.key;
      if (value === undefined || value === null || value === "") return null;
      return `${UNLISTED_OPTION_PREFIX}${defaultLabelOf(value)}`;
    },
    fromOption: (option) => {
      if (isEmptyOption(option)) return undefined;
      return options.find((candidate) => candidate.key === option)?.value;
    },
    hasUndefined: options.some((option) => option.value === undefined),
    hasNull: options.some((option) => option.value === null),
  };
};

/**
 * 値を複数持つ literal（`z.literal(["a", "b"])`）の選択肢。Select とは値の番号（"0"・"1"…）でやりとりし、
 * フォームの値には literal の値をそのまま書く（literal だけの union と同じ）。
 * literal の meta の label は欄の名前なので、選択肢の名前には使わない
 */
const literalChoices = (literalSchema: z.ZodLiteral): Choices => {
  const values = (literalSchema.def as { values?: unknown[] }).values ?? [];
  const options = values.map((value, index) => ({ key: String(index), value }));
  return {
    data: options.map(({ key, value }) => ({
      value: key,
      label: defaultLabelOf(value),
      color: "gray",
    })),
    toOption: (value) => {
      const option = options.find((candidate) =>
        sameValueZero(candidate.value, value),
      );
      if (option) return option.key;
      if (value === undefined || value === null || value === "") return null;
      return `${UNLISTED_OPTION_PREFIX}${defaultLabelOf(value)}`;
    },
    fromOption: (option) => {
      if (isEmptyOption(option)) return undefined;
      return options.find((candidate) => candidate.key === option)?.value;
    },
    hasUndefined: options.some((option) => option.value === undefined),
    hasNull: options.some((option) => option.value === null),
  };
};

/** enum・literal だけの union・値を複数持つ literal の選択肢（{@link Choices}） */
export const choicesOf = (schema: z.ZodTypeAny): Choices =>
  schema.type === "union"
    ? literalUnionChoices(schema as z.ZodUnion)
    : schema.type === "literal"
      ? literalChoices(schema as z.ZodLiteral)
      : enumChoices(schema as EnumSchema);

/** {@link choicesOf} を schema ごとに一度だけ作る hook */
export function useChoices(schema: z.ZodTypeAny): Choices {
  const resolveText = useResolveText();
  return useMemo(() => {
    const choices = choicesOf(schema);
    // 選択肢のラベル（meta の label）を辞書で引き直す
    return {
      ...choices,
      data: choices.data.map((option) => ({
        ...option,
        label: resolveText(option.label),
      })),
    };
  }, [schema, resolveText]);
}
