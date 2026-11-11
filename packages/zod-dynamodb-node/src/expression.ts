import type { AttributeValue } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";

export const marshallValue = (value: unknown): AttributeValue =>
  marshall(
    { v: value },
    { removeUndefinedValues: true, convertClassInstanceToMap: false },
  ).v!;

/**
 * 式のプレースホルダー（`#n0` / `:v0`）を払い出す。
 */
export class ExpressionContext {
  readonly names: Record<string, string> = {};
  readonly values: Record<string, AttributeValue> = {};
  private nameIds = new Map<string, string>();
  private valueCount = 0;

  name(attribute: string): string {
    let id = this.nameIds.get(attribute);
    if (!id) {
      id = `#n${this.nameIds.size}`;
      this.nameIds.set(attribute, id);
      this.names[id] = attribute;
    }
    return id;
  }

  /** 保存できる形に変換済みの値を受け取る */
  value(value: unknown): string {
    const id = `:v${this.valueCount++}`;
    this.values[id] = marshallValue(value);
    return id;
  }

  /** DynamoDBのリクエストに渡す形 */
  toInput(): {
    ExpressionAttributeNames?: Record<string, string>;
    ExpressionAttributeValues?: Record<string, AttributeValue>;
  } {
    return {
      ...(Object.keys(this.names).length
        ? { ExpressionAttributeNames: this.names }
        : {}),
      ...(Object.keys(this.values).length
        ? { ExpressionAttributeValues: this.values }
        : {}),
    };
  }
}

/** 条件式をANDでつなぐ。空なら `undefined` */
export const and = (
  ...conditions: (string | undefined)[]
): string | undefined => {
  const parts = conditions.filter((c): c is string => !!c);
  if (parts.length === 0) return undefined;
  return parts.map((c) => (parts.length > 1 ? `(${c})` : c)).join(" AND ");
};

export type UpdateActions = {
  set: Map<string, unknown>;
  remove: Set<string>;
  add: Map<string, number>;
};

export const emptyActions = (): UpdateActions => ({
  set: new Map(),
  remove: new Set(),
  add: new Map(),
});

export const buildUpdateExpression = (
  ctx: ExpressionContext,
  actions: UpdateActions,
): string => {
  const clauses: string[] = [];
  if (actions.set.size) {
    clauses.push(
      "SET " +
        [...actions.set]
          .map(([attr, v]) => `${ctx.name(attr)} = ${ctx.value(v)}`)
          .join(", "),
    );
  }
  if (actions.remove.size) {
    clauses.push(
      "REMOVE " + [...actions.remove].map((a) => ctx.name(a)).join(", "),
    );
  }
  if (actions.add.size) {
    clauses.push(
      "ADD " +
        [...actions.add]
          .map(([attr, v]) => `${ctx.name(attr)} ${ctx.value(v)}`)
          .join(", "),
    );
  }
  return clauses.join(" ");
};

/**
 * 保存されている属性（unmarshall済み）に、更新と同じ変更をJS上で適用する（§6.4のAfter）。
 */
export const applyActions = (
  raw: Record<string, unknown>,
  actions: UpdateActions,
): Record<string, unknown> => {
  const out: Record<string, unknown> = { ...raw };
  for (const [attr, v] of actions.set) out[attr] = v;
  for (const attr of actions.remove) delete out[attr];
  for (const [attr, v] of actions.add) {
    const current = out[attr];
    out[attr] = (typeof current === "number" ? current : 0) + v;
  }
  return out;
};
