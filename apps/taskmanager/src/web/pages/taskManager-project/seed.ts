import type { z } from "zod";
import type { TaskStatus, taskBodySchema } from "../../../shared";

type TaskInput = z.input<typeof taskBodySchema>;

const seedStatusCycle: TaskStatus[] = ["todo", "doing", "done"];
const seedPriorityCycle = ["low", "medium", "high", "urgent"] as const;

/** ダミータスクを count 件作る。offset は通し番号の開始位置 */
export const buildSeedTasks = (count: number, offset = 0): TaskInput[] => {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => {
    const index = offset + i;
    const status = seedStatusCycle[index % seedStatusCycle.length] ?? "todo";
    const priority =
      seedPriorityCycle[index % seedPriorityCycle.length] ?? "medium";
    const dueAt = new Date(now + (index % 21) * 24 * 60 * 60 * 1000);
    const labels =
      index % 3 === 0 ? ["UI"] : index % 3 === 1 ? ["API"] : ["改善"];

    // createdAt / updatedAt / deletedAt はテーブル定義の onCreate / onWrite が付ける
    return {
      title: `サンプルタスク ${index + 1}`,
      description: `サンプル説明 ${index + 1}`,
      status,
      priority,
      labels,
      dueAt,
    };
  });
};

export const wait = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
