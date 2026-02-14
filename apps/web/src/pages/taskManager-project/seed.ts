import type { z } from "zod";
import {
  type TaskStatus,
  tasksCollection,
} from "../../shared/taskManager/collections/task";

const seedStatusCycle: TaskStatus[] = ["todo", "doing", "done"];
const seedPriorityCycle = ["low", "medium", "high", "urgent"] as const;

const buildSeedTasks = (
  count: number,
): z.infer<typeof tasksCollection.createSchema>[] => {
  const now = Date.now();
  return Array.from({ length: count }, (_, index) => {
    const status = seedStatusCycle[index % seedStatusCycle.length] ?? "todo";
    const priority =
      seedPriorityCycle[index % seedPriorityCycle.length] ?? "medium";
    const dueAt = new Date(now + (index % 21) * 24 * 60 * 60 * 1000);
    const labels =
      index % 3 === 0 ? ["UI"] : index % 3 === 1 ? ["API"] : ["改善"];

    // createdAt/updatedAtはonCreate/onWriteで自動生成されるためここでは含めない
    return {
      title: `サンプルタスク ${index + 1}`,
      description: `サンプル説明 ${index + 1}`,
      status,
      priority,
      labels,
      dueAt,
      deletedAt: null,
    };
  });
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const populateSeed = async (
  createTask: (
    data: z.infer<typeof tasksCollection.createSchema>,
  ) => Promise<void>,
  count: number,
  onComplete: () => void,
): Promise<void> => {
  if (count <= 0) return;

  const seedTasksData = buildSeedTasks(count);

  try {
    console.info(`Seeding ${count} tasks...`);
    for (const task of seedTasksData) {
      await createTask(task);
      await wait(100);
    }
    console.info("Seeding completed.");
  } catch (error) {
    console.error("Failed to seed tasks:", error);
  } finally {
    onComplete();
  }
};
