import { z } from "zod";
import { DefinitionError } from "./errors";

type FieldRule = {
  /** 残すフィールド。`undefined` ならすべて残す */
  keep: ReadonlySet<string> | undefined;
  /** 必ずあるフィールド。それ以外は省略できる */
  required: ReadonlySet<string> | undefined;
};

const narrow = (schema: z.ZodType, rule: FieldRule): z.ZodType => {
  const def = (schema as unknown as { _zod: { def: Record<string, unknown> } })
    ._zod.def;
  switch (def.type) {
    case "object": {
      const shape = (schema as z.ZodObject).shape as Record<string, z.ZodType>;
      const next: Record<string, z.ZodType> = {};
      for (const [field, fieldSchema] of Object.entries(shape)) {
        if (rule.keep && !rule.keep.has(field)) continue;
        next[field] =
          rule.required && !rule.required.has(field)
            ? fieldSchema.optional()
            : fieldSchema;
      }
      return z.object(next);
    }
    case "union": {
      const discriminator = def.discriminator as string | undefined;
      // 判別子は常に残す。残さないと、絞った選択肢どうしの区別がつかず、
      // 別の選択肢に一致してその選択肢にないフィールドが落ちることがある
      const inner =
        discriminator !== undefined && rule.keep
          ? { ...rule, keep: new Set([...rule.keep, discriminator]) }
          : rule;
      const options = (def.options as z.ZodType[]).map((o) => narrow(o, inner));
      return options.length === 1
        ? options[0]!
        : z.union(options as [z.ZodType, z.ZodType, ...z.ZodType[]]);
    }
    case "intersection":
      return z.intersection(
        narrow(def.left as z.ZodType, rule),
        narrow(def.right as z.ZodType, rule),
      );
    default:
      throw new DefinitionError(
        `cannot narrow an item schema of type "${String(def.type)}"; use objects, unions and intersections`,
      );
  }
};

/**
 * itemのSchemaから、一部のフィールドだけを持つ出力のSchemaを作る（§7.3）。
 * 射影（`select: "projection"`）や `fields` で絞った結果の検証と変換に使う。
 */
export const narrowItemSchema = (
  schema: z.ZodType,
  rule: {
    keep?: ReadonlySet<string>;
    required?: ReadonlySet<string>;
  },
): z.ZodType => narrow(schema, { keep: rule.keep, required: rule.required });

/** itemのSchemaの、判別子のあるunionの判別子のフィールド（`fields` で絞っても常に返す） */
export const discriminatorsOf = (schema: z.ZodType): string[] => {
  const def = (schema as unknown as { _zod: { def: Record<string, unknown> } })
    ._zod.def;
  switch (def.type) {
    case "union":
      return [
        ...(typeof def.discriminator === "string" ? [def.discriminator] : []),
        ...(def.options as z.ZodType[]).flatMap(discriminatorsOf),
      ];
    case "intersection":
      return [
        ...discriminatorsOf(def.left as z.ZodType),
        ...discriminatorsOf(def.right as z.ZodType),
      ];
    default:
      return [];
  }
};
