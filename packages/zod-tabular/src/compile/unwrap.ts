import z from "zod";

/**
 * optional / nullable / default / effects / catch / brand / pipe / readonly
 * などのラッパー型を剥がして基底型を返す。
 */
export function unwrap(schema: z.ZodType): z.ZodType {
  let current: z.ZodType = schema;
  while (true) {
    if (current instanceof z.ZodOptional) {
      current = current.unwrap() as z.ZodType;
    } else if (current instanceof z.ZodNullable) {
      current = current.unwrap() as z.ZodType;
    } else if (current instanceof z.ZodDefault) {
      current = current.removeDefault() as z.ZodType;
    } else if (current instanceof z.ZodReadonly) {
      current = current.unwrap() as z.ZodType;
    } else {
      break;
    }
  }
  return current;
}
