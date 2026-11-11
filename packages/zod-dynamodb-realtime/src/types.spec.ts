import { memoryTransport } from "@zodapp/zod-dynamodb";
import { describe, expect, it } from "vitest";
import { createRealtimeGateway } from "./index";

describe("型", () => {
  it("サーバーの API から作る。subscriptions は書かない", () => {
    const bad = () =>
      createRealtimeGateway({
        api: null as never,
        transport: memoryTransport(),
        // @ts-expect-error 公開する購読は登録簿の live で決まる
        subscriptions: {},
      });
    expect(bad).toThrow(/api is required/);
  });
});
