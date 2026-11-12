/**
 * サーバーだけの上書き（`override()`）。共有の定義（src/shared）はブラウザにも出るので、
 * ブラウザに見せる必要のない規則や、ブラウザの `can` では判定しなくてよい規則をここに書く。
 */
import { override, taskOps } from "../shared";

export const overrides = [
  // 完全削除は、ゴミ箱にあるタスク（deletedAt が入っているもの）だけにする。
  // 共有の定義の remove には where がないので、置き換えになる（共有の where は shared で呼べる）
  override(taskOps.remove, {
    where: () => ({ deletedAt: { ne: null } }),
  }),
];
