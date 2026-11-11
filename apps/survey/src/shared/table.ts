import { physicalTable } from "@zodapp/zod-dynamodb";

/**
 * 単一テーブルの物理レイアウト。すべての Table定義がこのテーブルとスロットを共有する。
 * テーブルの作成（scripts と本番の CDK）は、この定義から行う。
 */
export const appTable = physicalTable({
  name: "survey",
  primary: { pk: "PK", sk: "SK" },
  indexes: {
    GSI1: { pk: "GSI1PK", sk: "GSI1SK", projection: "ALL" },
    GSI2: { pk: "GSI2PK", sk: "GSI2SK", projection: "ALL" },
  },
});
