import { defineEndpoints } from "./context";
import { columnSettingOps } from "./tables/columnSetting";
import { memberOps } from "./tables/member";
import { projectOps } from "./tables/project";
import { taskOps } from "./tables/task";
import { workspaceOps } from "./tables/workspace";

/**
 * 公開する操作の登録簿。ブラウザの API（zod-dynamodb-client）、Express の router、
 * Realtime Gateway が、すべてこれから作られる。`live` を付けたクエリはリアルタイムで購読できる。
 */
export const endpoints = defineEndpoints({
  workspaces: [
    { op: workspaceOps.get, path: "/workspaces/get" },
    { op: workspaceOps.update, path: "/workspaces/update" },
    { op: workspaceOps.create },
  ],
  members: [
    { op: memberOps.get, path: "/members/get" },
    { op: memberOps.list, path: "/members/list", live: true },
    { op: memberOps.mine, path: "/members/mine", live: true },
    { op: memberOps.add, path: "/members/add" },
    { op: memberOps.update, path: "/members/update" },
    { op: memberOps.updateProfile, path: "/members/update-profile" },
    { op: memberOps.remove, path: "/members/remove" },
  ],
  projects: [
    { op: projectOps.get, path: "/projects/get" },
    { op: projectOps.byStatus, path: "/projects/by-status", live: true },
    { op: projectOps.create, path: "/projects/create" },
    { op: projectOps.update, path: "/projects/update" },
  ],
  tasks: [
    { op: taskOps.get, path: "/tasks/get" },
    { op: taskOps.active, path: "/tasks/active", live: true },
    { op: taskOps.activeByStatus, path: "/tasks/active-by-status", live: true },
    { op: taskOps.deleted, path: "/tasks/deleted", live: true },
    { op: taskOps.create, path: "/tasks/create" },
    { op: taskOps.update, path: "/tasks/update" },
    { op: taskOps.softDelete, path: "/tasks/soft-delete" },
    { op: taskOps.restore, path: "/tasks/restore" },
    { op: taskOps.archive, path: "/tasks/archive" },
    { op: taskOps.setDueDate, path: "/tasks/set-due-date" },
    { op: taskOps.changeStatus, path: "/tasks/change-status" },
    { op: taskOps.assignTo, path: "/tasks/assign-to" },
    { op: taskOps.remove, path: "/tasks/remove" },
  ],
  columnSettings: [
    { op: columnSettingOps.get, path: "/column-settings/get" },
    { op: columnSettingOps.byTable, path: "/column-settings/by-table" },
    { op: columnSettingOps.create, path: "/column-settings/create" },
    { op: columnSettingOps.update, path: "/column-settings/update" },
    { op: columnSettingOps.remove, path: "/column-settings/remove" },
  ],
});

export type Endpoints = typeof endpoints;
