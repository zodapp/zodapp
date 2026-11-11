/**
 * AWS IoT Core への MQTT の接続（本番）。
 *
 * 証明書は使わず、実行環境の IAM の認証情報（ECS のタスクロールなど）で SigV4 の署名をした
 * `wss://{endpoint}/mqtt` につなぐ。署名付き URL には期限があるので、少し前に作り直しておき、
 * MQTT.js が（再）接続するたびに最新のものを使う（`transformWsUrl`）。
 */
import { randomUUID } from "node:crypto";
import { Sha256 } from "@aws-crypto/sha256-js";
import { defaultProvider } from "@aws-sdk/credential-provider-node";
import { SignatureV4 } from "@smithy/signature-v4";
import mqtt, { type MqttClient } from "mqtt";

/** 署名付き URL の期限。期限の前に作り直す */
const URL_EXPIRES_SECONDS = 15 * 60;
const URL_REFRESH_MS = 5 * 60_000;

const credentialsProvider = defaultProvider();

const presign = async (endpoint: string, region: string) => {
  const { sessionToken, ...credentials } = await credentialsProvider();
  // IoT Core は、一時的な認証情報のトークンを署名に含めず、署名のあとに付ける決まり
  const signer = new SignatureV4({
    service: "iotdevicegateway",
    region,
    credentials,
    sha256: Sha256,
  });
  const signed = await signer.presign(
    {
      method: "GET",
      protocol: "wss:",
      hostname: endpoint,
      path: "/mqtt",
      headers: { host: endpoint },
      query: {},
    },
    { expiresIn: URL_EXPIRES_SECONDS },
  );
  const query = new URLSearchParams(signed.query as Record<string, string>);
  if (sessionToken) query.set("X-Amz-Security-Token", sessionToken);
  return `wss://${endpoint}/mqtt?${query.toString()}`;
};

/**
 * 署名付き URL で IoT Core につないだ MQTT.js のクライアントを作る。
 * `name` はクライアント ID の頭（IAM のポリシーで `client/{name}-*` に絞るため）。
 */
export const connectIotCore = async (options: {
  endpoint: string;
  region: string;
  name: string;
}): Promise<MqttClient> => {
  const { endpoint, region, name } = options;
  let url = await presign(endpoint, region);
  const refresh = setInterval(() => {
    presign(endpoint, region).then(
      (next) => {
        url = next;
      },
      (error) => console.error("[iot] failed to presign", error),
    );
  }, URL_REFRESH_MS);
  refresh.unref();
  const client = mqtt.connect(url, {
    clientId: `${name}-${randomUUID()}`,
    protocolVersion: 4,
    clean: true,
    reconnectPeriod: 2000,
    transformWsUrl: () => url,
  });
  client.on("end", () => clearInterval(refresh));
  client.on("error", (error) => console.error(`[iot] ${name}:`, error));
  return client;
};
