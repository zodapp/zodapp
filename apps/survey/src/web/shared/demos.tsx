import { IconClipboardList } from "@tabler/icons-react";
import type { LinkOptions } from "@tanstack/react-router";
import type React from "react";

import { workspacesRoute } from "../pages/survey-top/workspaces.route";

/** ヘッダーのバッジに出す、このサンプルの名前（zodapp のデモ一覧の名残） */
export interface Demo extends Pick<LinkOptions, "to"> {
  label: string;
  title: string;
  icon: React.ReactNode;
  description: string;
  color?: string;
}

export const surveyDemo: Demo = {
  label: "アンケート × DynamoDB",
  title: "アンケート",
  to: workspacesRoute.to,
  icon: <IconClipboardList size={16} />,
  color: "grape",
  description:
    "質問の定義をデータとして保存し、実行時にフォームと表を組み立てるサンプル。回答の一覧はリアルタイムで更新される。",
};

export const demos: Demo[] = [surveyDemo];
