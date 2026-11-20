import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/reactiveReadOnly";

/** form-demo の日本語の辞書（reactiveReadOnly） */
export const ja = {
  "formDemo.page.reactiveReadOnly.title": "閲覧専用の表示 (Reactive)",
  "formDemo.page.reactiveReadOnly.description":
    "reactiveComponentLibrary によるreadOnlyモード。非対応型（bigint, tuple, array, discriminatedUnion）は除外。",
  "formDemo.reactiveReadOnly.hobbyLiterals.reading": "読書",
  "formDemo.reactiveReadOnly.hobbyLiterals.sports": "スポーツ",
  "formDemo.reactiveReadOnly.hobbyLiterals.music": "音楽",
  "formDemo.reactiveReadOnly.hobbyLiterals.gaming": "ゲーム",
  "formDemo.reactiveReadOnly.firstName": "名(string)",
  "formDemo.reactiveReadOnly.lastName": "姓（string, 必須）",
  "formDemo.reactiveReadOnly.frequency":
    "1週間にお酒を飲む日数(number, slider)",
  "formDemo.reactiveReadOnly.age": "年齢(number)",
  "formDemo.reactiveReadOnly.birthday": "誕生日(date)",
  "formDemo.reactiveReadOnly.isMember": "会員(boolean)",
  "formDemo.reactiveReadOnly.favoriteColor": "固定データ(literal)",
  "formDemo.reactiveReadOnly.isConfirmed.literal": "承認してください",
  "formDemo.reactiveReadOnly.isConfirmed":
    "承認済(literal型+booleanコンポーネントを強制)",
  "formDemo.reactiveReadOnly.favoriteHobby": "一番好きな趣味(enum)",
  "formDemo.reactiveReadOnly.message.compute":
    "これはReactive版のreadOnlyモードサンプルです",
} satisfies MessagesOf<typeof en>;
