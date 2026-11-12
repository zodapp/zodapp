import { physicalTable } from "@zodapp/zod-dynamodb";

/**
 * 単一テーブルの物理レイアウト。すべての Table定義がこのテーブルとスロットを共有する。
 * テーブルの作成（scripts と本番の CDK）は、この定義から行う。
 */
/**
 * DynamoDB の TTL に使う属性の名前（revocations が使う）。
 * テーブルの作成（src/server/dynamo.ts と本番の CDK）で有効にする
 */
export const TTL_ATTRIBUTE = "ttl";

export const appTable = physicalTable({
  name: "taskmanager",
  primary: { pk: "PK", sk: "SK" },
  indexes: {
    GSI1: { pk: "GSI1PK", sk: "GSI1SK", projection: "ALL" },
    GSI2: { pk: "GSI2PK", sk: "GSI2SK", projection: "ALL" },
  },
});
