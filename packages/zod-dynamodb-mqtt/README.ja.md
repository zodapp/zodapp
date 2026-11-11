# @zodapp/zod-dynamodb-mqtt

MQTT での配送です（設計は [docs/design.md](../../docs/zod-dynamodb/design.md) の §9.3、§9.4、§11）。接続先は、Mosquitto、AWS IoT Core など、[MQTT.js](https://github.com/mqttjs/MQTT.js) が接続できるものです。

```ts
import { mqttPublisher, mqttTransport } from "@zodapp/zod-dynamodb-mqtt";

// 書き込み側：Repository の listener に渡す
const publisher = mqttPublisher({
  url: process.env.MQTT_URL!,
  endpoints,                 // 登録簿。live を付けたクエリのトピックに発行する（Gateway と同じもの）
  prefix: "my-app",          // トピック名の先頭（既定は zod-dynamodb）。Gateway と揃える
  onPublishError: (e) => logger.warn(e), // 既定は console.error
});
const repository = createRepository({ ..., listener: publisher });

// Gateway 側：@zodapp/zod-dynamodb-realtime に渡す
const transport = mqttTransport({ url: process.env.MQTT_URL!, options: { username, password } });
```

- トピックは `{prefix}/{エンティティ}/{Index 名}/{ハッシュ}` です。同じ Index の上のクエリはトピックを共有し、範囲の条件は Gateway が購読ごとに判定します
- 変更ごとに、登録簿で `live` を付けたクエリが使う Index について、Before と After のトピックへ 1 回ずつ発行します（QoS 1）。フィールドは、その Index の Subscription の `fields` の和に絞ります
- 発行の失敗と、メッセージの大きさの上限（`maxMessageBytes`、既定 128KB）の超過は `onPublishError` に渡します。書き込み自体は成功として扱い、Client は再同期で回復します
- 一括での書き込み（`bulkWrite`）の開始・終了は、範囲（`scope`）から決まるトピックに発行します
- `mqttTransport` は購読を SUBACK まで待ちます。再接続のあとの購読のやり直しは MQTT.js が行います

テストと開発には、プロセス内で動く MQTT ブローカーの [aedes](https://github.com/moscajs/aedes) が使えます。
