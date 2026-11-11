import { z } from "zod";
import {
  defineContext,
  physicalTable,
  tableConfig,
} from "@zodapp/zod-dynamodb";

const { createOps } = defineContext<{ userId: string }>();

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
    note: z.string().optional(),
    views: z.int().optional(),
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

export const noteDef = {
  table: appTable,
  entity: "Note",
  item: z.strictObject({ id: z.string(), title: z.string(), body: z.string() }),
  create: z.object({ title: z.string(), body: z.string() }),
  key: { partition: ["id"] as const },
};

export const notes = tableConfig(noteDef);

export const taskQueries = createOps(tasks, (o) => ({
  byStatus: o.query({
    index: "byStatus",
    params: z.object({
      workspaceId: z.string(),
      status: z.enum(["todo", "doing", "done"]),
      minPriority: z.int().default(0),
    }),
    where: (p) => ({
      partition: { workspaceId: p.workspaceId, status: p.status },
      sort: { priority: { gte: p.minPriority } },
    }),
    direction: "desc",
  }),
  byAssignee: o.query({
    index: "byAssignee",
    params: z.object({
      workspaceId: z.string(),
      assignee: z.string().nullable(),
    }),
    where: (p) => ({
      partition: { workspaceId: p.workspaceId, assignee: p.assignee },
    }),
  }),
  byAssigneeKeys: o.query({
    index: "byAssignee",
    params: z.object({
      workspaceId: z.string(),
      assignee: z.string().nullable(),
    }),
    select: "projection",
    where: (p) => ({
      partition: { workspaceId: p.workspaceId, assignee: p.assignee },
    }),
  }),
  dueBefore: o.query({
    index: "byDue",
    params: z.object({ workspaceId: z.string(), before: z.date() }),
    select: "projection",
    where: (p) => ({
      partition: { workspaceId: p.workspaceId },
      sort: { dueDate: { lt: p.before } },
    }),
  }),
  all: o.query({
    params: z.object({ workspaceId: z.string() }),
    where: (p) => ({ partition: { workspaceId: p.workspaceId } }),
  }),
}));

export const taskMutations = createOps(tasks, (o) => ({
  setStatus: o.mutation({
    params: z.object({ status: z.enum(["todo", "doing", "done"]) }),
    patch: (p) => ({ status: p.status }),
  }),
  rename: o.mutation({
    params: z.object({ title: z.string() }),
    patch: (p) => ({ title: p.title }),
    where: (_p, ctx) => ({ assignee: ctx.userId }),
  }),
  bumpViews: o.mutation({
    params: z.object({ delta: z.int() }),
    add: (p) => ({ views: p.delta }),
  }),
  bumpPriority: o.mutation({
    params: z.object({ delta: z.int() }),
    add: (p) => ({ priority: p.delta }),
  }),
}));
