import { mqttTransport } from "@zodapp/zod-dynamodb-mqtt";
import { afterAll, beforeAll, expect, it } from "vitest";
import { startBroker } from "./test/broker";
import { connect, startApp, tasks } from "./test/app";

let broker: Awaited<ReturnType<typeof startBroker>>;
let app: Awaited<ReturnType<typeof startApp>>;
beforeAll(async () => {
  broker = await startBroker();
  app = await startApp({ transport: () => mqttTransport({ url: broker.url }) });
});
afterAll(async () => {
  await app?.close();
  await broker?.close();
});

it("書き込み → MQTT → Gateway → WebSocket", async () => {
  const c = await connect(app.url);
  c.send({
    type: "subscribe",
    id: 1,
    name: "tasks.all",
    params: { workspaceId: "mq" },
  });
  await c.next((m) => m.type === "ready");
  await app.repository
    .forTable(tasks)
    .create(
      { workspaceId: "mq", taskId: "a" },
      { title: "a", status: "todo", priority: 1, assignee: "u" },
    );
  const change = await c.next((m) => m.type === "change");
  expect(change).toMatchObject({
    change: "ADDED",
    version: 1,
    item: { taskId: "a" },
  });
  c.close();
});
