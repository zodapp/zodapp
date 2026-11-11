import { z } from "zod";
import { physicalTable } from "../physical";
import { tableConfig } from "../table";

export const appTable = physicalTable({
  name: "app",
  primary: { pk: "PK", sk: "SK" },
  indexes: {
    GSI1: { pk: "PK1", sk: "SK1", projection: "ALL" },
    GSI2: { pk: "PK2", sk: "SK2", projection: "KEYS_ONLY" },
    GSI3: {
      pk: "PK3",
      sk: "SK3",
      projection: { include: ["createdAt", "updatedAt"] },
    },
  },
});

const taskKeyFields = z.object({
  workspaceId: z.string(),
  taskId: z.string(),
});

const taskBody = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("todo"),
    title: z.string(),
    status: z.enum(["todo", "doing", "done"]),
    assignee: z.string().nullable(),
    priority: z.int().min(0).max(9),
  }),
  z.object({
    kind: z.literal("milestone"),
    title: z.string(),
    dueDate: z.date(),
  }),
]);

const timestamps = z.object({
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const tasks = tableConfig({
  table: appTable,
  entity: "Task",
  item: taskKeyFields.and(taskBody).and(timestamps),
  create: taskBody,
  key: { partition: ["workspaceId"], sort: ["taskId"] },
  indexes: {
    byStatus: {
      slot: "GSI1",
      partition: ["workspaceId", "status"],
      sort: ["priority", "updatedAt"],
    },
    byAssignee: {
      slot: "GSI2",
      partition: ["workspaceId", "assignee"],
      sort: ["updatedAt"],
    },
    byDue: { slot: "GSI3", partition: ["workspaceId"], sort: ["dueDate"] },
  },
  onCreate: ({ now }) => ({ createdAt: now }),
  onWrite: ({ now }) => ({ updatedAt: now }),
});
