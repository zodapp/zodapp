import {
  defineContext,
  defineEndpoints,
  physicalTable,
  tableConfig,
  topicForSubscriber,
  topicMessageCodec,
} from "@zodapp/zod-dynamodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { mqttPublisher, mqttTransport } from "./index";
import { startBroker } from "./test/broker";

let broker: Awaited<ReturnType<typeof startBroker>>;
beforeAll(async () => {
  broker = await startBroker();
});
afterAll(async () => {
  await broker?.close();
});

/** 購読して（SUBACK を待って）、最初のメッセージを待つ Promise を返す */
const nextMessage = async (
  transport: ReturnType<typeof mqttTransport>,
  topic: string,
) => {
  let resolve!: (message: string) => void;
  const message = new Promise<string>((r) => (resolve = r));
  await transport.subscribe(topic, resolve);
  return { message };
};

describe("MQTT の配送", () => {
  it("SUBACK の後に発行したメッセージが届き、解除の後は届かない", async () => {
    const a = mqttTransport({ url: broker.url });
    const b = mqttTransport({ url: broker.url });
    const received: string[] = [];
    await a.subscribe("t/1", (m) => received.push(m));
    await b.publish("t/1", "hello");
    await expect.poll(() => received).toEqual(["hello"]);
    await a.unsubscribe("t/1");
    await b.publish("t/1", "again");
    await new Promise((r) => setTimeout(r, 50));
    expect(received).toEqual(["hello"]);
    await a.close();
    await b.close();
  });

  it("mqttPublisher：変更を Subscription のトピックに発行する", async () => {
    const tasks = tableConfig({
      table: physicalTable({ name: "app", primary: { pk: "PK", sk: "SK" } }),
      entity: "Task",
      item: z.object({
        workspaceId: z.string(),
        taskId: z.string(),
        dueAt: z.date(),
      }),
      create: z.object({}),
      key: { partition: ["workspaceId"], sort: ["taskId"] },
    });
    const q = defineContext<undefined>().createOps(tasks, (o) => ({
      all: o.query({
        params: z.object({ ws: z.string() }),
        authorize: () => true,
        where: (p) => ({ partition: { workspaceId: p.ws } }),
      }),
    }));
    const endpoints = defineEndpoints({ tasks: [{ op: q.all, live: true }] });
    const sub = endpoints.entries[0]!.subscription!;
    const listener = mqttTransport({ url: broker.url });
    const topic = await topicForSubscriber(sub, { ws: "w" }, undefined, {
      prefix: "app",
    });
    const { message } = await nextMessage(listener, topic);
    const publisher = mqttPublisher({
      url: broker.url,
      prefix: "app",
      endpoints,
    });
    const dueAt = new Date("2026-01-01T00:00:00Z");
    await publisher.onChanges!([
      {
        entity: "Task",
        key: { workspaceId: "w", taskId: "t" },
        before: null,
        after: { workspaceId: "w", taskId: "t", dueAt },
        version: 1,
        origin: { kind: "single", id: "o" },
      },
    ]);
    const decoded = topicMessageCodec(tasks).decode(await message);
    expect(decoded).toMatchObject({
      type: "change",
      after: { workspaceId: "w", taskId: "t", dueAt },
      version: 1,
    });
    await publisher.close();
    await listener.close();
  });
});
