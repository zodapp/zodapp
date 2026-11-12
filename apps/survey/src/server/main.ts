/**
 * サーバー：Express（登録簿の router とサーバーだけのルート）と Realtime Gateway。
 *
 * MQTT_URL があれば、変更の発行と Gateway の購読を MQTT（AWS IoT Core など）でつなぐ。
 * なければ（ローカル）、ブローカーを立てずに、プロセスの中の配送（memoryTransport）でつなぐ。
 * プロセスの中の配送は、発行する側と Gateway が同じプロセスにいるときだけ使える（サーバーが 1 台のとき）。
 */
import type { IncomingMessage } from "node:http";
import express, { type ErrorRequestHandler } from "express";
import {
  createChangePublisher,
  memoryTransport,
  type ChangePublisher,
  type RealtimeTransport,
} from "@zodapp/zod-dynamodb";
import { router as registryRouter } from "@zodapp/zod-dynamodb-express";
import { mqttPublisher, mqttTransport } from "@zodapp/zod-dynamodb-mqtt";
import { createServerApi } from "@zodapp/zod-dynamodb-node";
import {
  createRealtimeGateway,
  type RealtimeGateway,
} from "@zodapp/zod-dynamodb-realtime";
import { endpoints, type Auth } from "../shared";
import {
  authExpiresAt,
  createAuthContext,
  tokenOf,
  tokenOfMessage,
  UnauthenticatedError,
} from "./auth";
import { createDynamoClient } from "./dynamo";
import { config } from "./env";
import { setupLocal } from "./local";
import { createAppRepository } from "./repository";
import { createAppRoutes } from "./routes";

const MQTT_PREFIX = "survey";

/** 変更の発行と、Gateway の購読に使う配送 */
const createRealtimeTransport = (): {
  publisher: ChangePublisher;
  gatewayTransport: RealtimeTransport;
} => {
  if (config.mqtt.url) {
    console.log(`[realtime] mqtt ${config.mqtt.url}`);
    return {
      publisher: mqttPublisher({ url: config.mqtt.url, endpoints, prefix: MQTT_PREFIX }),
      gatewayTransport: mqttTransport({ url: config.mqtt.url }),
    };
  }
  // 発行と購読に同じインスタンスを渡す。発行したメッセージは、同じプロセスの Gateway に届く
  console.log("[realtime] in-process (memoryTransport)");
  const recorded = memoryTransport();
  // memoryTransport は発行したメッセージを published に記録し続ける（テストで確かめるため）。
  // サーバーでは記録が要らないので、発行のたびに捨て、メモリが増え続けないようにする
  const transport: RealtimeTransport = {
    ...recorded,
    publish: async (topic, message) => {
      await recorded.publish(topic, message);
      recorded.published.length = 0;
    },
  };
  return {
    publisher: createChangePublisher({ transport, endpoints, prefix: MQTT_PREFIX }),
    gatewayTransport: transport,
  };
};

const main = async () => {
  const dynamodb = createDynamoClient();
  if (process.env.LOCAL_SETUP !== "0") await setupLocal({ dynamodb });

  // 書き込み側：Repository の変更を、live を付けたクエリのトピックに発行する
  const { publisher, gatewayTransport } = createRealtimeTransport();
  let realtime: RealtimeGateway | undefined;
  const repository = createAppRepository({
    dynamodb,
    listener: {
      onChanges: async (changes) => {
        await publisher.onChanges?.(changes);
        // メンバーが変わったら（追加・ロールの変更・削除）、その人の Realtime の接続の
        // 認証コンテキストを作り直す。外された人の開いている購読は FORBIDDEN で止まる
        const emails = new Set(
          changes
            .filter((c) => c.entity === "Member")
            .map((c) => String(c.key.email).toLowerCase()),
        );
        if (emails.size > 0) {
          await realtime?.revalidate((ctx: Auth) => emails.has(ctx.email));
        }
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

  realtime = createRealtimeGateway({
    api: serverApi,
    transport: gatewayTransport,
    prefix: MQTT_PREFIX,
    // ブラウザがトークンを更新したら、接続を保ったまま入れ替える
    credentialOf: tokenOfMessage,
    // ほかのサイトの画面からの接続を拒否する（Origin ヘッダーのないブラウザ以外のクライアントは通る）
    origin: config.appOrigins,
  });
  const gateway = realtime;
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
    // tsx watch の再起動で、古いプロセスがポートを持ったまま残らないようにする
    setTimeout(() => process.exit(0), 2000).unref();
    await gateway.close();
    await publisher.close?.();
    const closed = new Promise<void>((resolve) =>
      server.close(() => resolve()),
    );
    server.closeAllConnections();
    await closed;
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
