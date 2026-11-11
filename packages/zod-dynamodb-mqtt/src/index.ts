/**
 * MQTT での配送（§9.4、K8）。`RealtimeTransport` の MQTT の実装と、書き込み側の発行（`ChangeListener`）。
 * 接続先は Mosquitto、AWS IoT Core など、MQTT.js が接続できるもの。
 */
import {
  createChangePublisher,
  type ChangePublisher,
  type ChangePublisherOptions,
  type RealtimeTransport,
} from "@zodapp/zod-dynamodb";
import mqtt, { type IClientOptions, type MqttClient } from "mqtt";

export type MqttTransportOptions =
  | {
      /** 接続先（`mqtt://`、`mqtts://`、`ws://`、`wss://`） */
      url: string;
      /** MQTT.js の接続の設定（認証、証明書、再接続の間隔など） */
      options?: IClientOptions;
    }
  | {
      /** 接続済みのクライアントを使う。`close()` で閉じる */
      client: MqttClient;
    };

/**
 * MQTT の配送を作る。発行と購読は QoS 1。購読は SUBACK を受けたところで解決する。
 * 再接続のあとの購読のやり直しは MQTT.js が行う。
 */
export const mqttTransport = (
  options: MqttTransportOptions,
): RealtimeTransport & { readonly client: MqttClient } => {
  const client =
    "client" in options
      ? options.client
      : mqtt.connect(options.url, options.options);
  const handlers = new Map<string, (message: string) => void>();
  client.on("message", (topic, payload) => {
    handlers.get(topic)?.(payload.toString("utf8"));
  });
  return {
    client,
    publish: async (topic, message) => {
      await client.publishAsync(topic, message, { qos: 1 });
    },
    subscribe: async (topic, handler) => {
      handlers.set(topic, handler);
      try {
        const granted = await client.subscribeAsync(topic, { qos: 1 });
        const rejected = granted.find((g) => g.qos === 128);
        if (rejected) {
          throw new Error(`subscription to "${topic}" was rejected`);
        }
      } catch (error) {
        handlers.delete(topic);
        throw error;
      }
    },
    unsubscribe: async (topic) => {
      handlers.delete(topic);
      await client.unsubscribeAsync(topic);
    },
    close: async () => {
      handlers.clear();
      await client.endAsync();
    },
  };
};

export type MqttPublisherOptions = Omit<ChangePublisherOptions, "transport"> &
  MqttTransportOptions;

/**
 * 書き込み側の発行（§11）。Repository の `listener` に渡す。
 * 変更ごとに、公開した Subscription の Index のトピックへ、フィールドを絞って発行する（§9.3）。
 *
 * ```ts
 * const publisher = mqttPublisher({ url: process.env.MQTT_URL!, endpoints });
 * const repository = createRepository({ ..., listener: publisher });
 * ```
 */
export const mqttPublisher = (
  options: MqttPublisherOptions,
): ChangePublisher & { readonly client: MqttClient } => {
  const transport = mqttTransport(options);
  return {
    ...createChangePublisher({ ...options, transport }),
    client: transport.client,
  };
};
