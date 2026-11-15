import { describe, expect, it, vi } from "vitest";
import type { DeliveredSchema, ExternalKeyMetaDef } from "@zodapp/zod-form";
import type { ExternalKeyResolvers } from "@zodapp/zod-form/externalKey/types";
import { createExternalKeyDynamicMeta } from "./externalKey";

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
