import {
  IconChecklist,
  IconClipboardList,
  IconForms,
} from "@tabler/icons-react";
import type { LinkOptions } from "@tanstack/react-router";
import type React from "react";

import { formListRoute } from "../pages/form/list.route";
import { workspacesRoute } from "../pages/taskManager-top/workspaces.route";
import { surveyWorkspacesRoute } from "../pages/survey-top/workspaces.route";

/**
 * 収録デモの一覧。
 *
 * トップページのカードと、各画面のヘッダーに出す「いまどのデモにいるか」の
 * 表示で同じ定義を使う。デモを増やしたらここに 1 件足せば両方に反映される。
 */
export interface Demo extends Pick<LinkOptions, "to"> {
  /** ヘッダーのバッジに出す短い名前 */
  label: string;
  /** トップページのカードに出す名前 */
  title: string;
  icon: React.ReactNode;
  description: string;
  /** ヘッダーのバッジカラー（Mantine color） */
  color?: string;
}

export const formDemo: Demo = {
  label: "フォーム",
  title: "フォームデモ",
  to: formListRoute.to,
  icon: <IconForms size={16} />,
  color: "cyan",
  description:
    "1 つの Zod スキーマから生成されるフォーム UI のカタログ。入力型・レイアウト・カスタムウィジェット・動的スキーマなど。",
};

export const taskManagerDemo: Demo = {
  label: "タスク管理",
  title: "タスク管理デモ",
  to: workspacesRoute.to,
  icon: <IconChecklist size={16} />,
  color: "green",
  description:
    "マルチテナントの CRUD アプリ。一覧・検索（URL 連動）・CSV 入出力・列設定プロファイル・一括操作・権限制御。",
};

export const surveyDemo: Demo = {
  label: "アンケート",
  title: "アンケートデモ",
  to: surveyWorkspacesRoute.to,
  icon: <IconClipboardList size={16} />,
  color: "violet",
  description:
    "質問定義をデータとして保存し、実行時にスキーマを組み立てて回答フォームを生成。設定 + プレビューの 2 カラムビルダーと、回答のアンケート横断一覧。",
};

export const demos: Demo[] = [formDemo, taskManagerDemo, surveyDemo];
