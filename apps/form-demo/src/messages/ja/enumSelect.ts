import type { MessagesOf } from "@zodapp/i18n-messages";
import type { en } from "../en/enumSelect";

/** form-demo の日本語の辞書（enumSelect） */
export const ja = {
  "formDemo.page.enumSelect.description":
    "決まった選択肢から、ラベル付きで選ぶ",
  "formDemo.enumSelect.hobbyLiterals.reading": "読書",
  "formDemo.enumSelect.hobbyLiterals.sports": "スポーツ",
  "formDemo.enumSelect.hobbyLiterals.music": "音楽",
  "formDemo.enumSelect.hobbyLiterals.gaming": "ゲーム",
  "formDemo.enumSelect.hobbyLiterals.travel": "旅行",
  "formDemo.enumSelect.hobbyLiterals.cooking": "料理",
  "formDemo.enumSelect.hobbyLiterals.baking": "お菓子作り",
  "formDemo.enumSelect.hobbyLiterals.photography": "写真",
  "formDemo.enumSelect.hobbyLiterals.movies": "映画",
  "formDemo.enumSelect.hobbyLiterals.anime": "アニメ",
  "formDemo.enumSelect.hobbyLiterals.hiking": "ハイキング",
  "formDemo.enumSelect.hobbyLiterals.camping": "キャンプ",
  "formDemo.enumSelect.hobbyLiterals.fishing": "釣り",
  "formDemo.enumSelect.hobbyLiterals.cycling": "サイクリング",
  "formDemo.enumSelect.hobbyLiterals.running": "ランニング",
  "formDemo.enumSelect.hobbyLiterals.yoga": "ヨガ",
  "formDemo.enumSelect.hobbyLiterals.drawing": "イラスト",
  "formDemo.enumSelect.hobbyLiterals.crafts": "ハンドメイド",
  "formDemo.enumSelect.hobbyLiterals.programming": "プログラミング",
  "formDemo.enumSelect.hobbyLiterals.boardgames": "ボードゲーム",
  "formDemo.enumSelect.hobbyLiterals.karaoke": "カラオケ",
  "formDemo.enumSelect.favoriteHobby": "一番好きな趣味(uiType: badge)",
  "formDemo.enumSelect.favoriteHobbyRequired": "一番好きな趣味(必須）",
  "formDemo.enumSelect.hobbies": "趣味(uiType: multipleEnumBadge)",
  "formDemo.enumSelect.hobbiesRequired": "趣味(必須)",
  "formDemo.enumSelect.message.compute":
    "zf.enumで1つの選択肢を、zf.array(zf.enum())で複数選択を表現します",
} satisfies MessagesOf<typeof en>;
