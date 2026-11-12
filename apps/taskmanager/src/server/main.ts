/**
 * サーバー：Express（登録簿の router とサーバーだけのルート）、Realtime Gateway、MQTT ブローカー。
 *
 * ローカルでは MQTT ブローカー（aedes）をこのプロセスの中で起動し、変更の発行と Gateway の購読は
 * MQTT でそこにつなぐ。本番では IOT_ENDPOINT に AWS IoT Core を指定する（MQTT_URL で別のブローカーも使える）。
 */
import type { IncomingMessage } from "node:http";
import { createServer as createTcpServer } from "node:net";
import { Aedes } from "aedes";
import express, { type ErrorRequestHandler } from "express";
import { router as registryRouter } from "@zodapp/zod-dynamodb-express";
import { mqttPublisher, mqttTransport } from "@zodapp/zod-dynamodb-mqtt";
import { createServerApi } from "@zodapp/zod-dynamodb-node";
import { createS3FileRouter } from "@zodapp/zod-form-s3-node";
import { createRealtimeGateway } from "@zodapp/zod-dynamodb-realtime";
import { canWriteTask, endpoints, isMember, type Auth } from "../shared";
import {
  authExpiresAt,
  createAuthContext,
  tokenOf,
  tokenOfMessage,
  UnauthenticatedError,
} from "./auth";
import { createDynamoClient } from "./dynamo";
import { config } from "./env";
import { connectIotCore } from "./iot";
import { setupLocal } from "./local";
import { createAppRepository } from "./repository";
import {
  changedMembers,
  subscribeRevocations,
  writeRevocations,
} from "./revocations";
import { createAppRoutes } from "./routes";
import { createFileSigner, createS3Client, workspaceOfKey } from "./s3";

const MQTT_PREFIX = "taskmanager";

const startBroker = async () => {
  const broker = await Aedes.createBroker();
  const server = createTcpServer(broker.handle);
  await new Promise<void>((resolve) =>
    server.listen(config.mqtt.port, "127.0.0.1", resolve),
  );
  console.log(`[mqtt] aedes on :${config.mqtt.port}`);
  return {
    url: `mqtt://127.0.0.1:${config.mqtt.port}`,
    close: async () => {
      await new Promise<void>((resolve) => broker.close(() => resolve()));
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
};

const main = async () => {
  const dynamodb = createDynamoClient();
  const files = createFileSigner(createS3Client());
  if (process.env.LOCAL_SETUP !== "0") await setupLocal({ dynamodb, files });

  const { iotEndpoint } = config.mqtt;
  const broker =
    config.mqtt.url || iotEndpoint ? undefined : await startBroker();
  const mqttUrl = config.mqtt.url ?? broker?.url;
  /** 発行と購読で、別々のクライアントを使う */
  const connection = async (name: string) =>
    iotEndpoint
      ? {
          client: await connectIotCore({
            endpoint: iotEndpoint,
            region: config.dynamodb.region,
            name: `${MQTT_PREFIX}-${name}`,
          }),
        }
      : { url: mqttUrl! };

  // 書き込み側：Repository の変更を、live を付けたクエリのトピックに発行する
  const publisher = mqttPublisher({
    ...(await connection("publisher")),
    endpoints,
    prefix: MQTT_PREFIX,
  });
  const repository = createAppRepository({
    dynamodb,
    listener: {
      onChanges: async (changes) => {
        await publisher.onChanges?.(changes);
        // メンバーが変わったら（追加・ロールの変更・削除）、revocations に書く。
        // すべての台が購読していて、その人の接続の認証コンテキストを作り直す（./revocations.ts）
        const emails = changedMembers(changes);
        if (emails.length > 0) await writeRevocations(repository, emails);
      },
      onBatchMarker: (marker) => publisher.onBatchMarker?.(marker),
    },
  });
  // 認証の情報は ID トークンの文字列。コンテキストの期限は、操作の認可のたびに確かめる。
  // Realtime Gateway は、期限の前にトークンからコンテキストを作り直す
  const serverApi = createServerApi(endpoints, {
    repository,
    credential: tokenOf,
    context: createAuthContext(repository),
    expiresAt: authExpiresAt,
  });
  /** 登録簿に載せないルートでも、同じ認証コンテキストと期限の確認を使う */
  const resolveAuth = async (req: IncomingMessage) => {
    const auth = (await serverApi.contextOf(req)) as Auth;
    serverApi.checkContext(auth);
    return auth;
  };

  const app = express();
  app.use(express.json({ limit: "2mb" }));
  app.get("/api/health", (_req, res) => {
    // E2E が、認証の期限を縮めて起動しているかを確かめる
    res.json({
      ok: true,
      authMaxAgeSeconds: config.auth.maxAgeSeconds ?? null,
    });
  });
  app.use("/api", createAppRoutes({ repository, resolveAuth }));
  // ファイル：署名付き URL を発行し、ブラウザが S3 に直接 PUT / GET する。
  // 所属するワークスペースのキー（workspaces/{id}/...）だけを読み書きできる
  app.use(
    "/api",
    createS3FileRouter<Auth>({
      signer: files,
      context: async (req) => {
        const auth = await resolveAuth(req);
        return auth.userId ? auth : undefined;
      },
      canUpload: (auth, { key }) => {
        const workspaceId = workspaceOfKey(key);
        return !!workspaceId && canWriteTask(auth, workspaceId);
      },
      canRead: (auth, { key }) => {
        const workspaceId = workspaceOfKey(key);
        return !!workspaceId && isMember(auth, workspaceId);
      },
    }),
  );
  app.use(
    "/api",
    registryRouter(serverApi, {
      onError: (error) => console.error("[api]", error),
    }),
  );
  const onError: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof UnauthenticatedError) {
      res.status(401).json({ code: "UNAUTHENTICATED", message: error.message });
      return;
    }
    console.error("[api]", error);
    res.status(500).json({ code: "INTERNAL", message: "internal error" });
  };
  app.use(onError);

  const realtime = createRealtimeGateway({
    api: serverApi,
    transport: mqttTransport(await connection("gateway")),
    prefix: MQTT_PREFIX,
    // ブラウザがトークンを更新したら、接続を保ったまま入れ替える
    credentialOf: tokenOfMessage,
    // ほかのサイトの画面からの接続を拒否する（Origin ヘッダーのないブラウザ以外のクライアントは通る）
    origin: config.appOrigins,
  });
  const gateway = realtime;
  // revocations の購読は、Gateway とは別の配送の接続で行う
  const revocationTransport = mqttTransport(await connection("revocations"));
  const revocations = await subscribeRevocations({
    transport: revocationTransport,
    prefix: MQTT_PREFIX,
    realtime,
  });
  const server = app.listen(config.port, () =>
    console.log(
      `[server] http://localhost:${config.port}/api (realtime: /api/realtime)`,
    ),
  );
  gateway.attach(server, { path: "/api/realtime" });

  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    // 片付けが終わらなくても（keep-alive の接続など）、少し待ったら終える。
    // tsx watch の再起動で、古いプロセスが MQTT のポートを持ったまま残らないようにする
    setTimeout(() => process.exit(0), 2000).unref();
    await revocations.close();
    await revocationTransport.close();
    await gateway.close();
    await publisher.close?.();
    const closed = new Promise<void>((resolve) =>
      server.close(() => resolve()),
    );
    server.closeAllConnections();
    await closed;
    await broker?.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
