import type { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import type { ChangeListener } from "@zodapp/zod-dynamodb";
import { createRepository } from "@zodapp/zod-dynamodb-node";
import {
  appTable,
  columnSettings,
  members,
  projects,
  tasks,
  workspaces,
} from "../shared";
import { config } from "./env";

export const tables = { workspaces, members, projects, tasks, columnSettings };

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
  });

export type AppRepository = ReturnType<typeof createAppRepository>;
