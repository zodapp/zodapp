import { IconChecklist } from "@tabler/icons-react";
import type { LinkOptions } from "@tanstack/react-router";
import type React from "react";

import { workspacesRoute } from "../pages/taskManager-top/workspaces.route";

/** ヘッダーのバッジに出す、このサンプルの名前（zodapp のデモ一覧の名残） */
export interface Demo extends Pick<LinkOptions, "to"> {
  label: string;
  title: string;
  icon: React.ReactNode;
  description: string;
  color?: string;
}

export const taskManagerDemo: Demo = {
  label: "タスク管理 × DynamoDB",
  title: "タスク管理",
  to: workspacesRoute.to,
  icon: <IconChecklist size={16} />,
  color: "green",
  description:
    "zodapp のタスク管理デモを zod-dynamodb で動かすサンプル。一覧はリアルタイムで更新される。",
};

export const demos: Demo[] = [taskManagerDemo];
