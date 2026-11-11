import {
  CreateTableCommand,
  DescribeTableCommand,
  DynamoDBClient,
  ResourceNotFoundException,
} from "@aws-sdk/client-dynamodb";
import type { PhysicalTable } from "@zodapp/zod-dynamodb";
import { config } from "./env";

export const createDynamoClient = () =>
  new DynamoDBClient({
    region: config.dynamodb.region,
    ...(config.dynamodb.endpoint
      ? {
          endpoint: config.dynamodb.endpoint,
          // DynamoDB Local は認証情報を検査しない
          credentials: { accessKeyId: "local", secretAccessKey: "local" },
        }
      : {}),
  });

/** 物理レイアウトの名前を、実際のテーブル名に読み替える */
export const tableNameOf = (layout: PhysicalTable) =>
  `${config.dynamodb.tablePrefix}${layout.name}`;

/**
 * 物理レイアウトからテーブルを作る（なければ）。本番では CDK が同じ定義から作る。
 * キーの属性はすべて文字列（zod-dynamodb のキーのエンコーディング）。
 */
export const ensureTable = async (
  client: DynamoDBClient,
  layout: PhysicalTable,
  tableName = tableNameOf(layout),
): Promise<"created" | "exists"> => {
  try {
    await client.send(new DescribeTableCommand({ TableName: tableName }));
    return "exists";
  } catch (error) {
    if (!(error instanceof ResourceNotFoundException)) throw error;
  }
  const attributes = new Set<string>([layout.primary.pk, layout.primary.sk]);
  const gsis = Object.entries(layout.indexes).map(([slot, def]) => {
    attributes.add(def.pk);
    attributes.add(def.sk);
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
      TableName: tableName,
      BillingMode: "PAY_PER_REQUEST",
      AttributeDefinitions: [...attributes].map((name) => ({
        AttributeName: name,
        AttributeType: "S",
      })),
      KeySchema: [
        { AttributeName: layout.primary.pk, KeyType: "HASH" },
        { AttributeName: layout.primary.sk, KeyType: "RANGE" },
      ],
      ...(gsis.length > 0 ? { GlobalSecondaryIndexes: gsis } : {}),
    }),
  );
  return "created";
};
