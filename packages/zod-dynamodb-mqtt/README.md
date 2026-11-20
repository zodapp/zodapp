# @zodapp/zod-dynamodb-mqtt

[日本語](README.ja.md)

Delivery over MQTT (the specification is [Realtime delivery](../zod-dynamodb/docs/realtime.md)). It connects to anything [MQTT.js](https://github.com/mqttjs/MQTT.js) can connect to, such as Mosquitto and AWS IoT Core.

```ts
import { mqttPublisher, mqttTransport } from "@zodapp/zod-dynamodb-mqtt";

// Writer side: pass it to the repository's listener
const publisher = mqttPublisher({
  url: process.env.MQTT_URL!,
  endpoints,                 // the registry. Publishes to the topics of queries marked live (the same as the Gateway)
  prefix: "my-app",          // the start of topic names (default zod-dynamodb). Match the Gateway
  onPublishError: (e) => logger.warn(e), // default is console.error
});
const repository = createRepository({ ..., listener: publisher });

// Gateway side: pass it to @zodapp/zod-dynamodb-realtime
const transport = mqttTransport({ url: process.env.MQTT_URL!, options: { username, password } });
```

- Topics are `{prefix}/{entity}/{index name}/{hash}`. Queries on the same index share a topic, and the Gateway checks the range condition per subscription
- For each change, it publishes once each to the Before and After topics for the indexes used by queries marked `live` in the registry (QoS 1). Fields are narrowed to the union of the `fields` of the subscriptions on that index
- Publish failures and messages exceeding the size limit (`maxMessageBytes`, default 128KB) are passed to `onPublishError`. The write itself is treated as successful, and clients recover by resyncing
- The start and end of bulk writes (`bulkWrite`) are published to the topic determined by the range (`scope`)
- `mqttTransport` waits for subscriptions up to SUBACK. Redoing subscriptions after reconnecting is done by MQTT.js

For tests and development, you can use [aedes](https://github.com/moscajs/aedes), an MQTT broker that runs in-process.

## License

MIT ([`LICENSE`](../../LICENSE))
