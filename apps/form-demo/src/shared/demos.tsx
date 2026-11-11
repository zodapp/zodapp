import { IconForms } from "@tabler/icons-react";
import type { LinkOptions } from "@tanstack/react-router";
import type React from "react";

import { formListRoute } from "../pages/form/list.route";

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

export const demos: Demo[] = [formDemo];
