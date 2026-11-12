import type { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import type { ChangeListener } from "@zodapp/zod-dynamodb";
import { createRepository } from "@zodapp/zod-dynamodb-node";
import {
  appTable,
  columnSettings,
  members,
  projects,
  revocations,
  tasks,
  workspaces,
} from "../shared";
import { config } from "./env";
import { overrides } from "./overrides";

export const tables = {
  workspaces,
  members,
  projects,
  tasks,
  columnSettings,
  revocations,
};

export const createAppRepository = (options: {
  dynamodb: DynamoDBClient;
  tableName?: string;
  listener?: ChangeListener;
}) =>
  createRepository({
    tables,
    dynamodb: options.dynamodb,
    tableNames: {
      [appTable.name]:
        options.tableName ?? `${config.dynamodb.tablePrefix}${appTable.name}`,
    },
    cursorSecret: config.cursorSecret,
    listener: options.listener,
    // サーバーだけの上書き（src/server/overrides.ts）
    overrides,
  });

export type AppRepository = ReturnType<typeof createAppRepository>;
