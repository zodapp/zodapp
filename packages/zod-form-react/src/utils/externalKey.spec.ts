import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  getMeta,
  zf,
  type DeliveredSchema,
  type ExternalKeyMetaDef,
} from "@zodapp/zod-form";
import type { ExternalKeyResolvers } from "@zodapp/zod-form/externalKey/types";
import {
  createArrayExternalKeyDynamicMeta,
  createExternalKeyDynamicMeta,
} from "./externalKey";

type Subscription = {
  key: string;
  subscribe: (
    emit: (delivered: DeliveredSchema) => void,
    fail: (error: unknown) => void,
  ) => () => void;
};

const setup = () => {
  let deliver:
    | ((options: { label: string; value: string }[]) => void)
    | undefined;
  let reportError: ((error: unknown) => void) | undefined;
  const unsubscribe = vi.fn();
  const resolvers: ExternalKeyResolvers = [
    {
      type: "fake",
      resolver: () => ({
        subscribe: (callback, onError) => {
          deliver = callback;
          reportError = onError;
          return unsubscribe;
        },
      }),
    },
  ];
  const meta = {
    externalKeyConfig: { type: "fake" },
  } as unknown as ExternalKeyMetaDef;
  const dynamicMeta = createExternalKeyDynamicMeta({
    meta,
    resolvers,
    resolverContext: {},
  });
  const subscription = (dynamicMeta.resolve as unknown as () => Subscription)();
  return {
    subscription,
    unsubscribe,
    deliver: (options: { label: string; value: string }[]) =>
      deliver?.(options),
    reportError: (error: unknown) => reportError?.(error),
  };
};

describe("createExternalKeyDynamicMeta", () => {
  it("resolver の onError を、dynamic の fail につなぐ", () => {
    const { subscription, reportError } = setup();
    const emit = vi.fn();
    const fail = vi.fn();
    subscription.subscribe(emit, fail);
    const error = new Error("失敗");
    reportError(error);
    expect(fail).toHaveBeenCalledWith(error);
    expect(emit).not.toHaveBeenCalled();
  });

  it("失敗のあとに選択肢が届けば、同じ購読のまま schema を届ける", () => {
    const { subscription, deliver, reportError, unsubscribe } = setup();
    const emit = vi.fn();
    const fail = vi.fn();
    const off = subscription.subscribe(emit, fail);
    reportError(new Error("失敗"));
    deliver([{ label: "A", value: "a" }]);
    expect(emit).toHaveBeenCalledTimes(1);
    const delivered = emit.mock.calls[0]![0] as DeliveredSchema;
    expect(delivered.schema.safeParse("a").success).toBe(true);
    expect(delivered.schema.safeParse("b").success).toBe(false);
    off();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe("選択肢が 0 件のときの emptyMessage", () => {
  const schemaOf = (
    meta: Record<string, unknown>,
    options: { label: string; value: string }[],
  ) => {
    let deliver:
      | ((options: { label: string; value: string }[]) => void)
      | undefined;
    const resolvers: ExternalKeyResolvers = [
      {
        type: "fake",
        resolver: () => ({
          subscribe: (callback) => {
            deliver = callback;
            return () => {};
          },
        }),
      },
    ];
    const dynamicMeta = createExternalKeyDynamicMeta({
      meta: {
        externalKeyConfig: { type: "fake" },
        ...meta,
      } as unknown as ExternalKeyMetaDef,
      resolvers,
      resolverContext: {},
    });
    const subscription = (
      dynamicMeta.resolve as unknown as () => Subscription
    )();
    const emit = vi.fn();
    subscription.subscribe(emit, vi.fn());
    deliver?.(options);
    return (emit.mock.calls[0]![0] as DeliveredSchema).schema;
  };

  it("0 件で emptyMessage があれば、空の値のエラーはその文言になる", () => {
    const schema = schemaOf(
      { emptyMessage: "先に都道府県を選んでください" },
      [],
    );
    const result = schema.safeParse(undefined);
    expect(result.success).toBe(false);
    expect(result.error!.issues[0]!.message).toBe(
      "先に都道府県を選んでください",
    );
  });

  it("0 件で emptyMessage があっても、optional で包めば空の値は通る", () => {
    const schema = schemaOf(
      { emptyMessage: "先に都道府県を選んでください" },
      [],
    );
    expect(schema.optional().safeParse(undefined).success).toBe(true);
  });

  it("選択肢があるときや emptyMessage が無いときは、エラーの文言を変えない", () => {
    const withOptions = schemaOf(
      { emptyMessage: "先に都道府県を選んでください" },
      [{ label: "A", value: "a" }],
    );
    expect(withOptions.safeParse(undefined).error!.issues[0]!.message).not.toBe(
      "先に都道府県を選んでください",
    );
    const withoutMessage = schemaOf({}, []);
    expect(withoutMessage.safeParse(undefined).success).toBe(false);
  });
});

describe("createArrayExternalKeyDynamicMeta（複数選択）", () => {
  const element = (meta: Record<string, unknown> = {}) =>
    zf.string().register(zf.externalKey.registry, {
      label: "メンバー",
      externalKeyConfig: { type: "fake" },
      ...meta,
    } as never);

  const deliveredOf = (
    schema: z.ZodArray<z.ZodString>,
    options: { label: string; value: string }[],
  ) => {
    let deliver:
      | ((options: { label: string; value: string }[]) => void)
      | undefined;
    const resolvers: ExternalKeyResolvers = [
      {
        type: "fake",
        resolver: () => ({
          subscribe: (callback) => {
            deliver = callback;
            return () => {};
          },
        }),
      },
    ];
    const dynamicMeta = createArrayExternalKeyDynamicMeta({
      schema,
      resolvers,
      resolverContext: {},
    });
    const subscription = (
      dynamicMeta.resolve as unknown as () => Subscription
    )();
    const emit = vi.fn();
    const fail = vi.fn();
    subscription.subscribe(emit, fail);
    deliver?.(options);
    return {
      schema: (emit.mock.calls[0]?.[0] as DeliveredSchema | undefined)
        ?.schema as z.ZodTypeAny,
      fail,
    };
  };

  const options = [
    { label: "A", value: "a" },
    { label: "B", value: "b" },
  ];

  it("選択肢の enum を配列で包み、選択肢に無い要素を誤りにする", () => {
    const schema = zf
      .array(element())
      .register(zf.array.registry, { uiType: "multipleExternalKey" });
    const delivered = deliveredOf(schema, options).schema;
    expect(delivered.type).toBe("array");
    expect(delivered.safeParse(["a", "b"]).success).toBe(true);
    expect(delivered.safeParse(["a", "x"]).success).toBe(false);
    expect(delivered.safeParse(undefined).success).toBe(false);
    const elementSchema = (delivered as z.ZodArray<z.ZodTypeAny>).element;
    expect(elementSchema.type).toBe("enum");
  });

  it("元の配列の meta（label など）を引き継ぎ、uiType を複数選択の enum の部品にする", () => {
    const schema = zf
      .array(element({ unlisted: "keep" }))
      .register(zf.array.registry, {
        label: "メンバーたち",
        uiType: "multipleExternalKey",
        width: 150,
      });
    const delivered = deliveredOf(schema, options).schema;
    expect(getMeta(delivered)).toMatchObject({
      label: "メンバーたち",
      uiType: "multipleEnum",
      width: 150,
      typeName: "array",
    });
    // 選択肢の扱いは要素の meta から引き継ぐ
    const elementSchema = (delivered as z.ZodArray<z.ZodTypeAny>).element;
    expect(getMeta(elementSchema)).toMatchObject({ unlisted: "keep" });
    // 元の schema の meta は変えない
    expect(getMeta(schema)).toMatchObject({ uiType: "multipleExternalKey" });
  });

  it("元の配列の min / max / length を引き継ぐ", () => {
    const ranged = zf
      .array(element())
      .min(1)
      .max(2)
      .register(zf.array.registry, { uiType: "multipleExternalKey" });
    const rangedSchema = deliveredOf(ranged, options).schema;
    expect(rangedSchema.safeParse([]).success).toBe(false);
    expect(rangedSchema.safeParse(["a"]).success).toBe(true);
    expect(rangedSchema.safeParse(["a", "b", "a"]).success).toBe(false);

    const fixed = zf
      .array(element())
      .length(2)
      .register(zf.array.registry, { uiType: "multipleExternalKey" });
    const fixedSchema = deliveredOf(fixed, options).schema;
    expect(fixedSchema.safeParse(["a"]).success).toBe(false);
    expect(fixedSchema.safeParse(["a", "b"]).success).toBe(true);
  });

  it("allowUnlisted なら、選択肢に無い要素も通す（string の配列で、選択肢は suggestions）", () => {
    const schema = zf
      .array(element({ allowUnlisted: true }))
      .register(zf.array.registry, { uiType: "multipleExternalKey" });
    const delivered = deliveredOf(schema, options).schema;
    expect(delivered.safeParse(["a", "x"]).success).toBe(true);
    const elementSchema = (delivered as z.ZodArray<z.ZodTypeAny>).element;
    expect(getMeta(elementSchema)).toMatchObject({
      uiType: "select",
      suggestions: options,
    });
  });

  it("要素に externalKeyConfig が無ければ誤りにする", () => {
    expect(() =>
      createArrayExternalKeyDynamicMeta({
        schema: z.array(z.string()),
        resolvers: [],
        resolverContext: {},
      }),
    ).toThrow(/externalKeyConfig/);
  });
});
