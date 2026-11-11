import { randomUUID } from "node:crypto";
import {
  CreateTableCommand,
  DeleteTableCommand,
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import type { PhysicalTable } from "@zodapp/zod-dynamodb";

/** DynamoDB Local（`pnpm emulator:start`）に接続する */
export const localClient = () =>
  new DynamoDBClient({
    endpoint: process.env.DYNAMODB_ENDPOINT ?? "http://127.0.0.1:8000",
    region: "local",
    credentials: { accessKeyId: "local", secretAccessKey: "local" },
  });

/**
 * 物理レイアウトからテスト用のテーブルを作る。ベクトルインデックスはDynamoDB Localが
 * 対応していないため作らない。
 */
export const createTestTable = async (
  client: DynamoDBClient,
  layout: PhysicalTable,
): Promise<{ name: string; drop: () => Promise<void> }> => {
  const name = `${layout.name}-${randomUUID()}`;
  const attrs = new Set<string>([layout.primary.pk, layout.primary.sk]);
  const gsis = Object.entries(layout.indexes).map(([slot, def]) => {
    attrs.add(def.pk);
    attrs.add(def.sk);
    return {
      IndexName: slot,
      KeySchema: [
        { AttributeName: def.pk, KeyType: "HASH" as const },
        { AttributeName: def.sk, KeyType: "RANGE" as const },
      ],
      Projection:
        def.projection === "ALL" || def.projection === "KEYS_ONLY"
          ? { ProjectionType: def.projection }
          : {
              ProjectionType: "INCLUDE" as const,
              NonKeyAttributes: [...def.projection.include],
            },
    };
  });
  await client.send(
    new CreateTableCommand({
      TableName: name,
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [...attrs].map((a) => ({
        AttributeName: a,
        AttributeType: "S",
      })),
      KeySchema: [
        { AttributeName: layout.primary.pk, KeyType: "HASH" },
        { AttributeName: layout.primary.sk, KeyType: "RANGE" },
      ],
      ...(gsis.length ? { GlobalSecondaryIndexes: gsis } : {}),
    }),
  );
  return {
    name,
    drop: async () => {
      await client.send(new DeleteTableCommand({ TableName: name }));
    },
  };
};
