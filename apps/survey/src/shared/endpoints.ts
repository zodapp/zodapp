import { defineEndpoints } from "./context";
import { memberOps } from "./tables/member";
import { responseOps } from "./tables/response";
import { surveyOps } from "./tables/survey";
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
  surveys: [
    { op: surveyOps.get, path: "/surveys/get" },
    { op: surveyOps.active, path: "/surveys/active", live: true },
    { op: surveyOps.deleted, path: "/surveys/deleted", live: true },
    { op: surveyOps.create, path: "/surveys/create" },
    { op: surveyOps.put, path: "/surveys/put" },
    { op: surveyOps.update, path: "/surveys/update" },
    { op: surveyOps.publish, path: "/surveys/publish" },
    { op: surveyOps.close, path: "/surveys/close" },
    { op: surveyOps.reopen, path: "/surveys/reopen" },
    { op: surveyOps.softDelete, path: "/surveys/soft-delete" },
    { op: surveyOps.restore, path: "/surveys/restore" },
    { op: surveyOps.remove, path: "/surveys/remove" },
  ],
  responses: [
    { op: responseOps.get, path: "/responses/get" },
    { op: responseOps.all, path: "/responses/all", live: true },
    { op: responseOps.bySurvey, path: "/responses/by-survey", live: true },
    { op: responseOps.create, path: "/responses/create" },
    { op: responseOps.remove, path: "/responses/remove" },
  ],
});

export type Endpoints = typeof endpoints;
