import {
  createMemoryHistory,
  createRouter,
  type RouterHistory,
} from "@tanstack/react-router";
import {
  encodeSearchParams,
  searchParamsToParamsTree,
} from "@zodapp/zod-searchparams";

import { homeRoute } from "./top/home/index.route";
import { formRoute } from "./form/index.route";
import { formDetailRoute } from "./form/detail.route";
import { formListRoute } from "./form/list.route";
import { taskManagerRoute } from "./taskManager-top/index.route";
// non-member routes (public)
import { nonMemberLayoutRoute } from "./taskManager-nonmember/layout.route";
import { loginRoute } from "./taskManager-nonmember/login.route";
import { passwordResetRoute } from "./taskManager-nonmember/passwordReset.route";
// top level routes
import { topLayoutRoute } from "./taskManager-top/layout.route";
import { workspacesRoute } from "./taskManager-top/workspaces.route";
// workspace level routes
import { workspaceLayoutRoute } from "./taskManager-workspace/layout.route";
import { workspaceDetailRoute } from "./taskManager-workspace/detail.route";
import { projectsRoute } from "./taskManager-workspace/projects.route";
import { membersRoute } from "./taskManager-workspace/members.route";
import { memberDetailRoute } from "./taskManager-workspace/member/detail.route";
// project level routes
import { projectLayoutRoute } from "./taskManager-project/layout.route";
import { projectDetailRoute } from "./taskManager-project/detail.route";
import { tasksRoute } from "./taskManager-project/tasks.route";
import { taskDetailRoute } from "./taskManager-project/task/detail.route";
import { taskTestDataRoute } from "./taskManager-project/testData.route";
// survey routes
import { surveyRoute } from "./survey-top/index.route";
import { surveyTopLayoutRoute } from "./survey-top/layout.route";
import { surveyWorkspacesRoute } from "./survey-top/workspaces.route";
import { surveyWorkspaceLayoutRoute } from "./survey-workspace/layout.route";
import { surveysRoute } from "./survey-workspace/surveys.route";
import { responsesRoute } from "./survey-workspace/responses.route";
import { surveyTestDataRoute } from "./survey-workspace/testData.route";
import { responseDetailRoute } from "./survey-workspace/response/detail.route";
import { surveyEditRoute } from "./survey-workspace/survey/edit.route";
// 回答者向け（管理画面のサイドバーを出さない）ルート
import { surveyPublicLayoutRoute } from "./survey-public/layout.route";
import { surveyAnswerRoute } from "./survey-public/answer.route";
import { rootRoute } from "./index.route";
import { topRoute } from "./top/index.route";

const routeTree = rootRoute.addChildren([
  topRoute.addChildren([homeRoute]),
  formRoute.addChildren([formListRoute, formDetailRoute]),
  taskManagerRoute.addChildren([
    // non-member routes (public - no auth required)
    nonMemberLayoutRoute.addChildren([loginRoute, passwordResetRoute]),
    // protected routes (auth required)
    topLayoutRoute.addChildren([workspacesRoute]),
    workspaceLayoutRoute.addChildren([
      workspaceDetailRoute,
      projectsRoute,
      membersRoute,
      memberDetailRoute,
    ]),
    projectLayoutRoute.addChildren([
      projectDetailRoute,
      tasksRoute,
      taskDetailRoute,
      taskTestDataRoute,
    ]),
  ]),
  surveyRoute.addChildren([
    // 回答者向け（管理画面ではないのでサイドバーなし）
    surveyPublicLayoutRoute.addChildren([surveyAnswerRoute]),
    // 管理画面
    surveyTopLayoutRoute.addChildren([surveyWorkspacesRoute]),
    surveyWorkspaceLayoutRoute.addChildren([
      surveysRoute,
      surveyEditRoute,
      responsesRoute,
      responseDetailRoute,
      surveyTestDataRoute,
    ]),
  ]),
]);

const NotFound = () => <div>Not Found</div>;

export const createAppRouter = (history: RouterHistory) =>
  createRouter({
    routeTree,
    history,
    defaultNotFoundComponent: NotFound,
    stringifySearch: (search) => {
      const str = encodeSearchParams(search).toString();
      return str ? `?${str}` : "";
    },
    parseSearch: (searchStr) => {
      return searchParamsToParamsTree(new URLSearchParams(searchStr));
    },
  });

export const router = createAppRouter(createMemoryHistory());

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
