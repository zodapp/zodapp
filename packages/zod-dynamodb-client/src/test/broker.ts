import { createServer, type Server } from "node:net";
import type { AddressInfo } from "node:net";
import { Aedes } from "aedes";

/** プロセス内の MQTT ブローカー（K8） */
export const startBroker = async () => {
  const broker = await Aedes.createBroker();
  const server: Server = createServer(broker.handle);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `mqtt://127.0.0.1:${port}`,
    broker,
    close: async () => {
      await new Promise<void>((resolve) => broker.close(() => resolve()));
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
};
